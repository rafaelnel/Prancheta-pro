import React, { useState } from 'react';
import {
  Download,
  Share,
  PlusSquare,
  X,
  Smartphone,
  MonitorDown,
  WifiOff,
  Maximize2,
  Copy,
  Check,
  MoreVertical,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'hub' | 'hero';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Already running as an installed standalone PWA -> hide button cleanly
  if (isInstalled) {
    return null;
  }

  const isEmbedded =
    typeof window !== 'undefined' && window.self !== window.top;
  const isAndroid =
    typeof navigator !== 'undefined' &&
    /android/i.test(navigator.userAgent);

  const handleTriggerInstall = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        setShowModal(false);
      }
      return;
    }
    setShowModal(true);
  };

  const handleCopyAppUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      setCopiedUrl(false);
    }
  };

  const buttonClasses =
    variant === 'hero'
      ? 'px-5 py-3.5 rounded-full text-sm font-extrabold bg-[#0b0c10] hover:bg-[#1a1f2b] text-[#b5ff00] border border-[#b5ff00]/45 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer active:scale-95 shadow-lg'
      : variant === 'hub'
      ? 'p-2 sm:px-3 sm:py-2 rounded-full text-xs font-extrabold bg-[#b5ff00]/15 hover:bg-[#b5ff00]/25 text-[#b5ff00] border border-[#b5ff00]/45 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-95 shadow-sm'
      : 'p-2 sm:px-3 sm:py-1.5 rounded-full text-xs font-extrabold bg-[#b5ff00]/15 hover:bg-[#b5ff00]/25 text-[#b5ff00] border border-[#b5ff00]/45 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-95';

  const labelClasses =
    variant === 'hero'
      ? 'inline'
      : variant === 'hub'
      ? 'hidden sm:inline'
      : 'hidden md:inline';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void handleTriggerInstall();
        }}
        data-testid={variant === 'hero' ? 'pwa-install-hero-btn' : 'pwa-install-btn'}
        aria-label="Baixar e instalar aplicativo Prancheta Pro"
        title="Baixar e instalar Prancheta Pro no seu dispositivo (PWA)"
        className={buttonClasses}
      >
        {isIOS ? (
          <Smartphone className={variant === 'hero' ? 'w-4 h-4 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
        ) : (
          <Download className={variant === 'hero' ? 'w-4 h-4 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
        )}
        <span className={labelClasses}>
          {variant === 'hero' ? 'Baixar / Instalar App' : 'Baixar App'}
        </span>
      </button>

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Instalar Prancheta Pro como Aplicativo"
          data-testid="pwa-install-modal"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-[#13151b] border border-white/10 p-5 sm:p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Official App Icon Preview */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <img
                  src="/pwa-192x192.png"
                  alt="Ícone do aplicativo Prancheta Pro"
                  className="w-14 h-14 rounded-2xl border border-[#b5ff00]/40 shadow-lg shrink-0"
                />
                <div>
                  <span className="inline-block text-[10px] font-mono font-bold uppercase tracking-wider text-[#b5ff00]">
                    PWA · Aplicativo Instalável
                  </span>
                  <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white leading-tight mt-0.5">
                    Instalar Prancheta Pro
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Jogue em tela cheia direto da sua tela inicial.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Fechar janela de instalação"
                className="p-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Key PWA Benefits */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[#0b0c10] border border-white/[0.06] px-3 py-2.5 flex items-center gap-2">
                <Maximize2 className="w-3.5 h-3.5 text-[#b5ff00] shrink-0" />
                <span className="text-[11px] font-medium text-zinc-200">
                  Tela cheia nativa
                </span>
              </div>
              <div className="rounded-xl bg-[#0b0c10] border border-white/[0.06] px-3 py-2.5 flex items-center gap-2">
                <WifiOff className="w-3.5 h-3.5 text-[#b5ff00] shrink-0" />
                <span className="text-[11px] font-medium text-zinc-200">
                  Funciona offline
                </span>
              </div>
            </div>

            {/* Contextual Install Instructions */}
            {isInstallable ? (
              <button
                type="button"
                onClick={() => {
                  void handleTriggerInstall();
                }}
                className="w-full py-3 rounded-full text-xs font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Instalar Aplicativo Agora</span>
              </button>
            ) : isIOS ? (
              <ol className="space-y-2.5 text-xs text-zinc-200">
                <li className="flex items-start gap-2.5 rounded-xl bg-[#0b0c10] border border-white/[0.06] p-3">
                  <Share className="w-4 h-4 text-[#b5ff00] shrink-0 mt-0.5" />
                  <span>
                    1. Toque no botão <strong className="text-white">Compartilhar</strong>{' '}
                    na barra do Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2.5 rounded-xl bg-[#0b0c10] border border-white/[0.06] p-3">
                  <PlusSquare className="w-4 h-4 text-[#b5ff00] shrink-0 mt-0.5" />
                  <span>
                    2. Role e toque em{' '}
                    <strong className="text-white">Adicionar à Tela de Início</strong>.
                  </span>
                </li>
              </ol>
            ) : (
              <div className="space-y-2.5">
                {isEmbedded && (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-400/35 px-3.5 py-2.5 text-[11px] text-amber-200 leading-relaxed">
                    Para instalar o app na tela inicial ou área de trabalho, abra o link
                    diretamente em uma aba do navegador (fora da janela embutida).
                  </div>
                )}

                <ol className="space-y-2 text-xs text-zinc-200">
                  {isAndroid ? (
                    <>
                      <li className="flex items-start gap-2.5 rounded-xl bg-[#0b0c10] border border-white/[0.06] p-3">
                        <MoreVertical className="w-4 h-4 text-[#b5ff00] shrink-0 mt-0.5" />
                        <span>
                          1. Toque no menu <strong className="text-white">⋮</strong> no canto
                          superior do Chrome.
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5 rounded-xl bg-[#0b0c10] border border-white/[0.06] p-3">
                        <Download className="w-4 h-4 text-[#b5ff00] shrink-0 mt-0.5" />
                        <span>
                          2. Selecione{' '}
                          <strong className="text-white">Instalar aplicativo</strong> ou{' '}
                          <strong className="text-white">Adicionar à tela inicial</strong>.
                        </span>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-start gap-2.5 rounded-xl bg-[#0b0c10] border border-white/[0.06] p-3">
                        <MonitorDown className="w-4 h-4 text-[#b5ff00] shrink-0 mt-0.5" />
                        <span>
                          1. Clique no ícone de{' '}
                          <strong className="text-white">Instalar</strong> no canto direito da
                          barra de endereços do Chrome ou Edge.
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5 rounded-xl bg-[#0b0c10] border border-white/[0.06] p-3">
                        <Download className="w-4 h-4 text-[#b5ff00] shrink-0 mt-0.5" />
                        <span>
                          2. Ou abra o menu do navegador e escolha{' '}
                          <strong className="text-white">Instalar Prancheta Pro</strong>.
                        </span>
                      </li>
                    </>
                  )}
                </ol>

                {isEmbedded && (
                  <button
                    type="button"
                    onClick={() => {
                      void handleCopyAppUrl();
                    }}
                    className="w-full py-2.5 rounded-full text-xs font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Link copiado! Cole em uma nova aba</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar link para instalar no navegador</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="w-full py-2 rounded-full text-xs font-bold bg-white/[0.07] hover:bg-white/[0.12] text-zinc-200 transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
};
