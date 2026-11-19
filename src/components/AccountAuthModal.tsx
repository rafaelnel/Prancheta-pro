import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  CheckCircle2,
  Cloud,
  CloudUpload,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { CareerSaveData } from '../types/football';
import { formatSavedTimestamp } from '../utils/saveManager';

interface AccountAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  cloudSyncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncMessage: string | null;
  careerSlots: Array<CareerSaveData | null>;
  onManualSync: () => Promise<void>;
  onNotify: (message: string, tone?: 'emerald' | 'amber' | 'rose' | 'cyan') => void;
}

export const AccountAuthModal: React.FC<AccountAuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  cloudSyncStatus,
  lastSyncMessage,
  careerSlots,
  onManualSync,
  onNotify,
}) => {
  const [authTab, setAuthTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const formatFirebaseAuthError = (err: unknown): string => {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: string }).code)
        : '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'E-mail ou senha incorretos. Verifique seus dados ou crie uma nova conta.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'Este e-mail já está cadastrado. Mude para a aba "Entrar na Conta".';
    }
    if (code === 'auth/weak-password') {
      return 'A senha deve ter pelo menos 6 caracteres.';
    }
    if (code === 'auth/invalid-email') {
      return 'Formato de e-mail inválido.';
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Login por E-mail/Senha ainda não foi ativado no Console do Firebase (Authentication > Sign-in method > Email/Password). Você pode entrar agora mesmo com 1 clique usando sua Conta Google abaixo!';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Janela de login fechada antes da conclusão. Tente novamente.';
    }
    if (code === 'auth/unauthorized-domain') {
      return 'Domínio de preview ainda não autorizado para OAuth Popup. Use E-mail e Senha ou adicione o domínio no Console do Firebase.';
    }
    return err instanceof Error ? err.message : 'Não foi possível autenticar agora.';
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      onNotify(
        `Bem-vindo, ${cred.user.displayName || cred.user.email || 'Treinador'}! Sincronizando carreiras na nuvem...`,
        'emerald'
      );
    } catch (err) {
      setErrorMessage(formatFirebaseAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Preencha seu e-mail e sua senha.');
      return;
    }

    if (authTab === 'REGISTER') {
      if (password.length < 6) {
        setErrorMessage('A senha precisa ter pelo menos 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('As senhas digitadas não coincidem.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (authTab === 'REGISTER') {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const finalName = displayName.trim() || cleanEmail.split('@')[0] || 'Treinador';
        await updateProfile(cred.user, { displayName: finalName });
        onNotify(
          `Conta criada com sucesso! Seus slots de carreira estão sincronizados na nuvem.`,
          'emerald'
        );
      } else {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        onNotify(
          `Sessão iniciada como ${cred.user.displayName || cred.user.email}! Sincronizando saves...`,
          'emerald'
        );
      }
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setErrorMessage(formatFirebaseAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await signOut(auth);
      onNotify('Você saiu da sua conta. Seus saves locais permanecem salvos neste dispositivo.', 'amber');
    } catch (err) {
      setErrorMessage(formatFirebaseAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeSlotsCount = careerSlots.filter(Boolean).length;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#111621] border border-slate-700/80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3.5 bg-[#161D2A] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center">
              <Cloud className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 block">
                CONTA & SINCRONIZAÇÃO MULTI-DISPOSITIVO
              </span>
              <h2 className="text-sm sm:text-base font-bold text-white">
                {currentUser ? 'Perfil do Treinador na Nuvem' : 'Entrar ou Criar Conta'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-900/80 border border-slate-800 active:scale-95 transition-transform cursor-pointer"
            aria-label="Fechar modal de conta"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Benefit Callout */}
          <div className="p-3 bg-slate-900/80 border border-slate-800/90 flex items-start gap-2.5">
            <Smartphone className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-300 leading-relaxed">
              Acesse seus <strong className="text-white">4 Slots de Carreira</strong> no celular, tablet ou computador. Ao entrar na sua conta, seus saves locais e na nuvem são sincronizados automaticamente.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 leading-relaxed">
              {errorMessage}
            </div>
          )}

          {currentUser ? (
            <div className="space-y-4">
              {/* Authenticated User Card */}
              <div className="p-3.5 bg-[#161F30] border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    <UserCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white truncate">
                        {currentUser.displayName || 'Treinador'}
                      </span>
                      <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        CONECTADO
                      </span>
                    </div>
                    <p className="text-xs font-mono text-slate-400 truncate">
                      {currentUser.email || currentUser.uid}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isSubmitting}
                  className="px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sair da Conta
                </button>
              </div>

              {/* Cloud Sync Status & Manual Action */}
              <div className="p-3.5 bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                      STATUS DA NUVEM
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {cloudSyncStatus === 'syncing' ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                          <span className="text-xs font-bold text-cyan-300">
                            Sincronizando carreiras com a nuvem...
                          </span>
                        </>
                      ) : cloudSyncStatus === 'error' ? (
                        <span className="text-xs font-bold text-amber-300">
                          Salvo localmente (Toque para tentar reenviar à nuvem)
                        </span>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-xs font-bold text-emerald-300">
                            {lastSyncMessage || `${activeSlotsCount}/4 slots sincronizados na nuvem`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void onManualSync()}
                    disabled={cloudSyncStatus === 'syncing'}
                    className="px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shrink-0"
                  >
                    <CloudUpload className="w-3.5 h-3.5" />
                    Sincronizar Agora
                  </button>
                </div>

                {/* Slot Overview */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                  {[0, 1, 2, 3].map((idx) => {
                    const slotSave = careerSlots[idx];
                    return (
                      <div
                        key={idx}
                        className={`p-2 border ${
                          slotSave
                            ? 'bg-[#161D2A] border-slate-700/80'
                            : 'bg-slate-950/60 border-slate-800/50 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-cyan-400 font-bold">SLOT 0{idx + 1}</span>
                          {slotSave ? (
                            <span className="text-emerald-400">SINCRONIZADO</span>
                          ) : (
                            <span className="text-slate-500">VAZIO</span>
                          )}
                        </div>
                        {slotSave ? (
                          <div className="mt-1">
                            <p className="text-xs font-bold text-white truncate">
                              {slotSave.clubName}
                            </p>
                            <p className="text-[10px] font-mono text-slate-400 truncate">
                              Temp. {slotSave.currentYear ?? 2026} • Rod. {slotSave.currentRound} •{' '}
                              {formatSavedTimestamp(slotSave.savedAt)}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 mt-1">Sem carreira ativa</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 1-Click Google Login */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-lg active:scale-[0.99] transition-all cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Entrar / Cadastrar com Google (1 Clique)
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px bg-slate-800 flex-1" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  OU COM E-MAIL E SENHA
                </span>
                <div className="h-px bg-slate-800 flex-1" />
              </div>

              {/* Tabs: Login vs Cadastro */}
              <div className="grid grid-cols-2 border border-slate-800 bg-slate-950/80 p-1 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('LOGIN');
                    setErrorMessage(null);
                  }}
                  className={`py-2 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    authTab === 'LOGIN'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Entrar na Conta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('REGISTER');
                    setErrorMessage(null);
                  }}
                  className={`py-2 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    authTab === 'REGISTER'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Criar Cadastro
                </button>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-3">
                {authTab === 'REGISTER' && (
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                      Nome do Treinador
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Ex: Prof. Telê Santana"
                      maxLength={60}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                    E-mail da Conta
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="treinador@clube.com.br"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className={authTab === 'REGISTER' ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5' : ''}>
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                      Senha (mín. 6 caracteres)
                    </label>
                    <div className="relative">
                      <KeyRound className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••"
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {authTab === 'REGISTER' && (
                    <div>
                      <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                        Confirmar Senha
                      </label>
                      <div className="relative">
                        <KeyRound className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••"
                          className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-3 px-4 font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.99] transition-all cursor-pointer ${
                    authTab === 'REGISTER'
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  }`}
                >
                  {authTab === 'REGISTER' ? (
                    <>
                      <UserPlus className="w-4 h-4" />
                      {isSubmitting ? 'Criando Conta e Sincronizando...' : 'Criar Conta & Salvar na Nuvem'}
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      {isSubmitting ? 'Entrando e Baixando Saves...' : 'Entrar & Carregar Carreiras'}
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
