import React, { useMemo, useRef, useState } from 'react';
import {
  Play,
  Plus,
  FolderOpen,
  Trash2,
  Download,
  Upload,
  ArrowLeft,
  Shield,
  Trophy,
  Wallet,
  Search,
  Check,
  AlertTriangle,
  MapPin,
} from 'lucide-react';
import {
  INITIAL_CLUBS,
  INITIAL_STANDINGS_A,
  INITIAL_STANDINGS_B,
} from '../data/initialDatabase';
import {
  CareerSaveData,
  CareerSlotIndex,
  Club,
} from '../types/football';
import { formatCompactBRL } from '../utils/formatters';
import { ClubBadge } from './ClubBadge';
import {
  CAREER_SLOTS,
  formatSavedTimestamp,
  parseCareerBackup,
  serializeCareerBackup,
} from '../utils/saveManager';

type HubViewMode = 'landing' | 'saves' | 'new_game';
type DivisionFilter = 'A' | 'B' | 'ALL';

interface CareerHubScreenProps {
  slots: Array<CareerSaveData | null>;
  onStartNewCareer: (
    slotIndex: CareerSlotIndex,
    clubId: string,
    managerName: string
  ) => void;
  onLoadCareer: (slotIndex: CareerSlotIndex) => void;
  onDeleteCareer: (slotIndex: CareerSlotIndex) => void;
  onImportCareer: (saveData: CareerSaveData) => void;
  activeCareerSlot: CareerSlotIndex | null;
  onReturnToActiveCareer?: () => void;
}

export const CareerHubScreen: React.FC<CareerHubScreenProps> = ({
  slots,
  onStartNewCareer,
  onLoadCareer,
  onDeleteCareer,
  onImportCareer,
  activeCareerSlot,
  onReturnToActiveCareer,
}) => {
  const savedCareers = useMemo(
    () => slots.filter((s): s is CareerSaveData => s !== null),
    [slots]
  );

  const latestSave = useMemo(() => {
    if (savedCareers.length === 0) return null;
    return [...savedCareers].sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    )[0];
  }, [savedCareers]);

  const firstEmptySlot = useMemo<CareerSlotIndex>(() => {
    const emptyIdx = slots.findIndex((s) => s === null);
    return emptyIdx !== -1 ? ((emptyIdx + 1) as CareerSlotIndex) : 1;
  }, [slots]);

  const [viewMode, setViewMode] = useState<HubViewMode>('landing');
  const [selectedSlot, setSelectedSlot] =
    useState<CareerSlotIndex>(firstEmptySlot);
  const [selectedClubId, setSelectedClubId] = useState<string>(
    INITIAL_CLUBS[0].id
  );
  const [managerName, setManagerName] = useState<string>('Treinador Silva');
  const [clubSearch, setClubSearch] = useState<string>('');
  const [divisionFilter, setDivisionFilter] = useState<DivisionFilter>('A');
  const [confirmDeleteSlot, setConfirmDeleteSlot] =
    useState<CareerSlotIndex | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState<boolean>(false);
  const [importFeedback, setImportFeedback] = useState<{
    type: 'ok' | 'error';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedClub = useMemo(
    () => INITIAL_CLUBS.find((c) => c.id === selectedClubId) || INITIAL_CLUBS[0],
    [selectedClubId]
  );

  const getClubInitialRank = (club: Club): number => {
    const table =
      club.division === 'B' ? INITIAL_STANDINGS_B : INITIAL_STANDINGS_A;
    return table.findIndex((row) => row.clubId === club.id) + 1;
  };

  const selectedClubInitialRank = getClubInitialRank(selectedClub);
  const slotCurrentlyOccupied = slots[selectedSlot - 1] !== null;

  const filteredClubs = useMemo(() => {
    const q = clubSearch.trim().toLowerCase();
    return INITIAL_CLUBS.filter((club) => {
      if (divisionFilter !== 'ALL' && club.division !== divisionFilter) {
        return false;
      }
      if (!q) return true;
      return (
        club.name.toLowerCase().includes(q) ||
        club.shortName.toLowerCase().includes(q) ||
        club.city.toLowerCase().includes(q) ||
        club.state.toLowerCase().includes(q)
      );
    });
  }, [clubSearch, divisionFilter]);

  const openNewGameForSlot = (slotIdx?: CareerSlotIndex) => {
    const target = slotIdx ?? firstEmptySlot;
    setSelectedSlot(target);
    setConfirmOverwrite(false);
    setViewMode('new_game');
  };

  const handleExportSave = (save: CareerSaveData) => {
    const json = serializeCareerBackup(save);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prancheta-pro-slot${save.slotIndex}-${save.clubAbbr.toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const targetSlot = firstEmptySlot;
      const parsed = parseCareerBackup(text, targetSlot);
      if (!parsed) {
        setImportFeedback({
          type: 'error',
          text: 'Arquivo inválido.',
        });
      } else {
        onImportCareer(parsed);
        setImportFeedback({
          type: 'ok',
          text: `${parsed.clubShortName} importado no Slot 0${targetSlot}.`,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCreateSubmit = () => {
    if (slotCurrentlyOccupied && !confirmOverwrite) {
      setConfirmOverwrite(true);
      return;
    }
    onStartNewCareer(selectedSlot, selectedClub.id, managerName);
  };

  const renderSlotCard = (slotIdx: CareerSlotIndex, compact = false) => {
    const save = slots[slotIdx - 1];
    const isConfirmingDelete = confirmDeleteSlot === slotIdx;

    if (!save) {
      return (
        <div
          key={slotIdx}
          className="rounded-[24px] border border-dashed border-white/15 bg-[#14171f]/60 p-4 sm:p-5 flex flex-col justify-between gap-4 hover:border-[#b5ff00]/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400">
              Slot 0{slotIdx}
            </span>
            <span className="text-[10px] font-mono uppercase text-zinc-500">
              Vazio
            </span>
          </div>

          <div className="font-display text-xl font-extrabold uppercase tracking-tight text-zinc-300">
            Nova Carreira
          </div>

          <button
            type="button"
            onClick={() => openNewGameForSlot(slotIdx)}
            className="w-full py-2.5 px-4 rounded-full text-xs font-bold bg-white/[0.08] hover:bg-[#b5ff00] text-white hover:text-[#090a0f] transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Iniciar no Slot {slotIdx}</span>
          </button>
        </div>
      );
    }

    return (
      <div
        key={slotIdx}
        className="rounded-[24px] border border-white/10 bg-[#14171f] p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <ClubBadge
              clubId={save.userClubId}
              abbr={save.clubAbbr}
              name={save.clubName}
              primaryColor={save.clubPrimaryColor}
              size="md"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#b5ff00]">
                  Slot 0{slotIdx} · Série {save.division} ·{' '}
                  {save.currentYear || 2026}
                </span>
                {activeCareerSlot === slotIdx && (
                  <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-full bg-[#b5ff00]/15 text-[#b5ff00]">
                    Ativo
                  </span>
                )}
              </div>
              <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white truncate">
                {save.clubShortName}
              </h3>
              <div className="text-xs text-zinc-400 truncate">
                {save.managerName}
              </div>
            </div>
          </div>

          <span className="text-[10px] font-mono text-zinc-400 shrink-0">
            {formatSavedTimestamp(save.savedAt)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 bg-[#0b0c10] rounded-2xl p-2.5 border border-white/[0.06] text-xs">
          <div>
            <div className="text-[10px] text-zinc-400">Rodada</div>
            <div className="font-mono font-bold text-white tabular-nums mt-0.5">
              {save.currentRound}ª
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-400">Posição</div>
            <div className="font-mono font-bold text-[#b5ff00] tabular-nums mt-0.5">
              {save.userRank}º
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-400">Caixa</div>
            <div className="font-mono font-bold text-white tabular-nums mt-0.5 truncate">
              {formatCompactBRL(save.cashBalance)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onLoadCareer(slotIdx)}
            className="flex-1 py-2.5 px-4 rounded-full text-xs font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shadow-md"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Carregar</span>
          </button>

          {!compact && (
            <button
              type="button"
              onClick={() => handleExportSave(save)}
              title="Exportar JSON"
              aria-label={`Exportar backup do Slot ${slotIdx}`}
              className="p-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          {!isConfirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDeleteSlot(slotIdx)}
              title="Excluir save"
              aria-label={`Excluir save do Slot ${slotIdx}`}
              className="p-2.5 rounded-full bg-white/[0.06] hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onDeleteCareer(slotIdx);
                  setConfirmDeleteSlot(null);
                }}
                className="px-3 py-2 rounded-full text-[11px] font-bold bg-rose-500 hover:bg-rose-400 text-white transition-colors"
              >
                Excluir
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteSlot(null)}
                className="px-2.5 py-2 rounded-full text-[11px] font-semibold bg-white/[0.08] text-zinc-300 hover:text-white transition-colors"
              >
                Não
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-zinc-100 flex flex-col">
      {/* Top Brand Header */}
      <header className="h-14 sm:h-16 border-b border-white/[0.07] bg-[#111319]/90 px-4 sm:px-8 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#b5ff00] flex items-center justify-center font-display font-extrabold text-[#090a0f] text-sm sm:text-base shadow-md shrink-0">
            FM
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg sm:text-xl font-extrabold uppercase tracking-tight text-white leading-none truncate">
              Prancheta Pro
            </div>
            <div className="text-[11px] text-[#b5ff00] font-mono mt-0.5 leading-none">
              Brasileirão Série A & B · 2026
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-full text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 transition-colors flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5 text-[#b5ff00]" />
            <span className="hidden sm:inline">Importar Save</span>
            <span className="sm:hidden">Importar</span>
          </button>

          {activeCareerSlot && onReturnToActiveCareer && (
            <button
              type="button"
              onClick={onReturnToActiveCareer}
              className="px-4 py-2 rounded-full text-xs font-extrabold bg-white text-[#090a0f] hover:bg-[#b5ff00] transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-7">
        {importFeedback && (
          <div
            className={`rounded-2xl px-4 py-2.5 text-xs font-semibold flex items-center justify-between border ${
              importFeedback.type === 'ok'
                ? 'bg-[#b5ff00]/10 border-[#b5ff00]/30 text-[#b5ff00]'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{importFeedback.text}</span>
            <button
              type="button"
              onClick={() => setImportFeedback(null)}
              className="text-xs underline ml-4"
            >
              Fechar
            </button>
          </div>
        )}

        {/* VIEW 1: PRIMEIRA PÁGINA ENXUTA */}
        {viewMode === 'landing' && (
          <div className="space-y-7">
            <section className="rounded-[28px] border border-white/10 bg-[#14171f] overflow-hidden shadow-2xl">
              <div className="grid grid-cols-1 lg:grid-cols-12">
                {/* Left Hero Actions */}
                <div className="lg:col-span-7 p-6 sm:p-9 flex flex-col justify-between gap-6">
                  <div className="space-y-2.5">
                    <span className="block text-xs font-mono font-bold uppercase tracking-wider text-[#b5ff00]">
                      Série A & Série B · 40 Clubes · Elencos Reais
                    </span>
                    <h1 className="font-display text-4xl sm:text-6xl font-extrabold uppercase tracking-tight text-white leading-[0.94]">
                      BRASILEIRÃO 2026
                    </h1>
                  </div>

                  {/* Primary Buttons: Always "Novo Jogo", and conditionally "Continuar Jogo" when saves exist */}
                  <div className="flex flex-wrap items-center gap-3">
                    {savedCareers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setViewMode('saves')}
                        className="px-6 py-3.5 rounded-full text-sm font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center gap-2 shadow-lg"
                      >
                        <FolderOpen className="w-4 h-4" />
                        <span>
                          Continuar Jogo ({savedCareers.length})
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openNewGameForSlot(firstEmptySlot)}
                      className={`px-6 py-3.5 rounded-full text-sm font-extrabold transition-colors flex items-center gap-2 shadow-lg ${
                        savedCareers.length > 0
                          ? 'bg-white hover:bg-zinc-200 text-[#090a0f]'
                          : 'bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f]'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Novo Jogo</span>
                    </button>
                  </div>
                </div>

                {/* Right Highlight Card: Latest Save Resume OR Compact KPI Strip */}
                <div className="lg:col-span-5 bg-gradient-to-br from-[#b5ff00] to-[#8fd400] text-[#090a0f] p-6 sm:p-8 flex flex-col justify-between gap-5">
                  {latestSave ? (
                    <>
                      <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase opacity-80">
                        <span>
                          Slot 0{latestSave.slotIndex} · Série {latestSave.division}
                        </span>
                        <span>{formatSavedTimestamp(latestSave.savedAt)}</span>
                      </div>

                      <div className="flex items-center gap-4">
                        <ClubBadge
                          clubId={latestSave.userClubId}
                          abbr={latestSave.clubAbbr}
                          name={latestSave.clubName}
                          primaryColor={latestSave.clubPrimaryColor}
                          size="lg"
                          surface="light"
                        />
                        <div className="min-w-0">
                          <h2 className="font-display text-3xl font-extrabold uppercase tracking-tight leading-none truncate">
                            {latestSave.clubName}
                          </h2>
                          <div className="text-xs font-bold opacity-80 mt-1">
                            {latestSave.managerName}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-[#0b0c10] text-white rounded-2xl p-3">
                        <div>
                          <div className="text-[10px] text-zinc-400">Rodada</div>
                          <div className="font-mono font-bold text-sm tabular-nums">
                            {latestSave.currentRound}ª
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-400">Tabela</div>
                          <div className="font-mono font-bold text-sm text-[#b5ff00] tabular-nums">
                            {latestSave.userRank}º
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-zinc-400">
                            Confiança
                          </div>
                          <div className="font-mono font-bold text-sm tabular-nums">
                            {latestSave.boardConfidence}%
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onLoadCareer(latestSave.slotIndex)}
                        className="w-full py-3 px-5 rounded-full text-sm font-extrabold bg-[#090a0f] hover:bg-zinc-900 text-[#b5ff00] transition-colors flex items-center justify-center gap-2 shadow-xl"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Retomar {latestSave.clubShortName}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase opacity-80">
                        <span>Temporada 2026</span>
                        <span>Série A & Série B</span>
                      </div>

                      <div className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight leading-none">
                        40 CLUBES REAIS
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-[#0b0c10] text-white rounded-2xl p-3.5 text-center">
                        <div>
                          <div className="font-display text-2xl font-extrabold text-[#b5ff00]">
                            20+20
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            Série A e B
                          </div>
                        </div>
                        <div>
                          <div className="font-display text-2xl font-extrabold text-white">
                            880
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            Atletas Reais
                          </div>
                        </div>
                        <div>
                          <div className="font-display text-2xl font-extrabold text-[#b5ff00]">
                            4
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            Slots Save
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* 4 Career Slots */}
            <section className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white">
                  Slots de Carreira ({savedCareers.length}/4)
                </h2>
                {savedCareers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setViewMode('saves')}
                    className="text-xs font-bold text-[#b5ff00] hover:underline"
                  >
                    Ver Todos os Saves →
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {CAREER_SLOTS.map((slotIdx) => renderSlotCard(slotIdx, true))}
              </div>
            </section>
          </div>
        )}

        {/* VIEW 2: CONTINUAR JOGO — LISTA COMPLETA DE SAVES */}
        {viewMode === 'saves' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode('landing')}
                  className="p-2.5 rounded-full bg-[#14171f] border border-white/10 hover:bg-white/[0.08] text-white transition-colors"
                  aria-label="Voltar à tela inicial"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-white leading-none">
                  Meus Saves ({savedCareers.length}/4)
                </h1>
              </div>

              <button
                type="button"
                onClick={() => openNewGameForSlot(firstEmptySlot)}
                className="px-5 py-2.5 rounded-full text-xs font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Jogo</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {CAREER_SLOTS.map((slotIdx) => renderSlotCard(slotIdx, false))}
            </div>
          </div>
        )}

        {/* VIEW 3: CONFIGURAR NOVA CARREIRA (SLOT + TÉCNICO + SÉRIE A/B) */}
        {viewMode === 'new_game' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode('landing')}
                  className="p-2.5 rounded-full bg-[#14171f] border border-white/10 hover:bg-white/[0.08] text-white transition-colors"
                  aria-label="Voltar à tela inicial"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-white leading-none">
                  Novo Jogo
                </h1>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left Column: Manager Setup, Target Slot & Selected Club Summary */}
              <div className="xl:col-span-5 space-y-5">
                <div className="rounded-[28px] border border-white/10 bg-[#14171f] p-5 space-y-4">
                  <div>
                    <label
                      htmlFor="manager-name-input"
                      className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5"
                    >
                      Técnico
                    </label>
                    <input
                      id="manager-name-input"
                      type="text"
                      maxLength={32}
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      placeholder="Nome do técnico..."
                      className="w-full px-4 py-2.5 rounded-2xl bg-[#0b0c10] border border-white/10 focus:border-[#b5ff00] focus:outline-none text-sm font-semibold text-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      <span>Slot Destino</span>
                      <span className="font-mono text-[#b5ff00]">
                        Slot 0{selectedSlot}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {CAREER_SLOTS.map((slotIdx) => {
                        const existing = slots[slotIdx - 1];
                        const isChosen = selectedSlot === slotIdx;
                        return (
                          <button
                            key={slotIdx}
                            type="button"
                            onClick={() => {
                              setSelectedSlot(slotIdx);
                              setConfirmOverwrite(false);
                            }}
                            className={`py-2 px-2 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-0.5 ${
                              isChosen
                                ? 'bg-[#b5ff00] text-[#090a0f] border-[#b5ff00]'
                                : 'bg-[#0b0c10] text-zinc-300 border-white/10 hover:border-white/25'
                            }`}
                          >
                            <span className="font-mono">Slot {slotIdx}</span>
                            <span
                              className={`text-[10px] truncate max-w-full ${
                                isChosen ? 'text-[#090a0f]/80' : 'text-zinc-500'
                              }`}
                            >
                              {existing ? existing.clubAbbr : 'Livre'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {slotCurrentlyOccupied && (
                      <div className="mt-2.5 rounded-2xl bg-amber-500/10 border border-amber-400/30 p-2.5 flex items-center gap-2 text-xs text-amber-200">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                          Substituir save de{' '}
                          <strong>{slots[selectedSlot - 1]?.clubShortName}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected Club Ticket Preview */}
                <div className="rounded-[28px] overflow-hidden border border-white/10 bg-[#14171f] shadow-2xl">
                  <div className="bg-gradient-to-b from-[#b5ff00] to-[#8fd400] p-5 text-[#090a0f]">
                    <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase opacity-75 mb-2.5">
                      <span>Série {selectedClub.division}</span>
                      <span>
                        {selectedClub.city} · {selectedClub.state}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <ClubBadge
                        clubId={selectedClub.id}
                        abbr={selectedClub.abbr}
                        name={selectedClub.name}
                        primaryColor={selectedClub.primaryColor}
                        size="lg"
                        surface="light"
                      />
                      <div className="min-w-0">
                        <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight leading-none truncate">
                          {selectedClub.name}
                        </h2>
                        <div className="text-xs font-semibold opacity-80 mt-1 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{selectedClub.stadium}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-3.5">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-[#0b0c10] rounded-2xl p-2.5 border border-white/[0.06]">
                        <div className="text-[10px] text-zinc-400">Ataque</div>
                        <div className="font-mono font-bold text-base text-[#b5ff00] tabular-nums">
                          {Math.round(selectedClub.overallAttack)}
                        </div>
                      </div>
                      <div className="bg-[#0b0c10] rounded-2xl p-2.5 border border-white/[0.06]">
                        <div className="text-[10px] text-zinc-400">Meio</div>
                        <div className="font-mono font-bold text-base text-white tabular-nums">
                          {Math.round(selectedClub.overallMidfield)}
                        </div>
                      </div>
                      <div className="bg-[#0b0c10] rounded-2xl p-2.5 border border-white/[0.06]">
                        <div className="text-[10px] text-zinc-400">Defesa</div>
                        <div className="font-mono font-bold text-base text-white tabular-nums">
                          {Math.round(selectedClub.overallDefense)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs bg-[#0b0c10] rounded-2xl p-2.5 border border-white/[0.06]">
                      <div>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <Trophy className="w-3 h-3 text-[#b5ff00]" />
                          Posição
                        </div>
                        <div className="font-mono font-bold text-white mt-0.5">
                          {selectedClubInitialRank}º
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <Wallet className="w-3 h-3 text-[#b5ff00]" />
                          Caixa
                        </div>
                        <div className="font-mono font-bold text-[#b5ff00] mt-0.5">
                          {formatCompactBRL(selectedClub.cashBalance)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <Shield className="w-3 h-3 text-[#b5ff00]" />
                          Esquema
                        </div>
                        <div className="font-mono font-bold text-white mt-0.5">
                          {selectedClub.formation}
                        </div>
                      </div>
                    </div>

                    {selectedClub.starPlayers.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedClub.starPlayers.slice(0, 2).map((sp, i) => (
                          <div
                            key={i}
                            className="bg-[#0b0c10] border border-white/[0.06] rounded-xl px-3 py-2 flex items-center justify-between text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-white truncate">
                                {sp.name}
                              </div>
                              <div className="text-[10px] text-zinc-400">
                                {sp.position} · {sp.highlightAttribute}
                              </div>
                            </div>
                            <span className="font-mono font-bold text-[#b5ff00] ml-2">
                              {Math.round(sp.overall)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleCreateSubmit}
                      className={`w-full py-3.5 px-5 rounded-full text-sm font-extrabold transition-colors flex items-center justify-center gap-2 shadow-lg ${
                        slotCurrentlyOccupied && confirmOverwrite
                          ? 'bg-amber-400 hover:bg-amber-300 text-[#090a0f]'
                          : 'bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f]'
                      }`}
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        {slotCurrentlyOccupied && confirmOverwrite
                          ? `Confirmar Slot 0${selectedSlot}`
                          : `Iniciar com ${selectedClub.shortName}`}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: All 40 Série A & Série B Clubs */}
              <div className="xl:col-span-7 rounded-[28px] border border-white/10 bg-[#14171f] p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight text-white">
                    Clubes ({filteredClubs.length})
                  </h3>

                  <div className="relative sm:w-56">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={clubSearch}
                      onChange={(e) => setClubSearch(e.target.value)}
                      placeholder="Buscar clube..."
                      className="w-full pl-9 pr-3.5 py-2 rounded-full bg-[#0b0c10] border border-white/10 focus:border-[#b5ff00] focus:outline-none text-xs text-white"
                    />
                  </div>
                </div>

                {/* Division Filter Pills: Série A (20), Série B (20), Todos (40) */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'A', label: 'Série A (20)' },
                      { id: 'B', label: 'Série B (20)' },
                      { id: 'ALL', label: 'Todos (40)' },
                    ] as const
                  ).map((pill) => (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => setDivisionFilter(pill.id)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                        divisionFilter === pill.id
                          ? 'bg-[#b5ff00] text-[#090a0f]'
                          : 'bg-[#0b0c10] text-zinc-400 hover:text-white border border-white/[0.07]'
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                {/* Clubs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
                  {filteredClubs.map((club: Club) => {
                    const isSelected = club.id === selectedClub.id;
                    const avgOvr = Math.round(
                      (club.overallAttack +
                        club.overallMidfield +
                        club.overallDefense) /
                        3
                    );
                    const clubRank = getClubInitialRank(club);

                    return (
                      <button
                        key={club.id}
                        type="button"
                        onClick={() => {
                          setSelectedClubId(club.id);
                          setConfirmOverwrite(false);
                        }}
                        className={`text-left rounded-2xl p-3.5 border transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-[#b5ff00]/12 border-[#b5ff00] shadow-md'
                            : 'bg-[#0b0c10] border-white/[0.06] hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <ClubBadge
                            clubId={club.id}
                            abbr={club.abbr}
                            name={club.name}
                            primaryColor={club.primaryColor}
                            size="md"
                          />
                          <div className="min-w-0">
                            <div className="font-display font-extrabold text-base uppercase tracking-tight text-white truncate">
                              {club.shortName}
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate">
                              Série {club.division} · {club.city}/{club.state} · {clubRank}º
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-2">
                          <div>
                            <div className="font-mono font-bold text-xs text-[#b5ff00] tabular-nums">
                              OVR {avgOvr}
                            </div>
                            <div className="font-mono text-[10px] text-zinc-400 tabular-nums">
                              {formatCompactBRL(club.cashBalance)}
                            </div>
                          </div>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-[#b5ff00] text-[#090a0f] flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
