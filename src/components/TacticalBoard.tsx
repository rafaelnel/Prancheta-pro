import React, { useState } from 'react';
import { Eye } from 'lucide-react';
import {
  ATTRIBUTE_LABELS,
  FORMATIONS,
  MENTAL_KEYS,
  PHYSICAL_KEYS,
  TACTICAL_ROLES,
  TECHNICAL_KEYS,
  getRoleById,
} from '../data/tacticsData';
import {
  calculatePlayerOverall,
  calculateRoleSuitability,
  calculateTeamTacticalRatings,
} from '../engine/matchEngine';
import {
  AttributeKey,
  DefensiveLineType,
  FormationType,
  MentalityType,
  PassingStyleType,
  Player,
  PressingIntensityType,
  TacticalDuty,
  TeamInstructions,
} from '../types/football';
import {
  getAttributeColorClass,
  getConditionColor,
} from '../utils/formatters';

interface TacticalBoardProps {
  squad: Player[];
  formation: FormationType;
  instructions: TeamInstructions;
  onChangeFormation: (formation: FormationType) => void;
  onChangeInstructions: (instructions: TeamInstructions) => void;
  onUpdateRoleDuty: (
    playerId: string,
    roleId: string,
    duty: TacticalDuty
  ) => void;
  onSwapPlayers: (playerAId: string, playerBId: string) => void;
  onInspectPlayer: (player: Player) => void;
}

export const TacticalBoard: React.FC<TacticalBoardProps> = ({
  squad,
  formation,
  instructions,
  onChangeFormation,
  onChangeInstructions,
  onUpdateRoleDuty,
  onSwapPlayers,
  onInspectPlayer,
}) => {
  const starters = [...squad]
    .filter((p) => p.isStarter)
    .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));
  const reserves = squad.filter((p) => !p.isStarter);

  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(5);
  const [boardSubView, setBoardSubView] = useState<
    'tactics' | 'lineup' | 'stats'
  >('tactics');

  const slots = FORMATIONS[formation];
  const selectedPlayer =
    starters.find((p) => p.slotIndex === selectedSlotIndex) || starters[0];
  const selectedSlot = slots[selectedSlotIndex] || slots[0];
  const selectedRole = selectedPlayer
    ? getRoleById(selectedPlayer.assignedRole)
    : TACTICAL_ROLES[0];

  const teamRatings = calculateTeamTacticalRatings(
    squad,
    formation,
    instructions
  );

  const suitability = selectedPlayer
    ? calculateRoleSuitability(selectedPlayer, selectedRole)
    : { score: 80, avgAttribute: 14.0 };

  const renderHighlightedAttributeCategory = (
    categoryTitle: string,
    keys: AttributeKey[]
  ) => {
    if (!selectedPlayer) return null;
    return (
      <div className="bg-[#0b0c10] border border-white/[0.07] rounded-2xl p-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2 pb-1.5 border-b border-white/[0.06]">
          {categoryTitle}
        </div>
        <div className="space-y-1.5">
          {keys.map((key) => {
            const val = selectedPlayer.attributes[key];
            const isKey = selectedRole.keyAttributes.includes(key);
            const isSecondary = selectedRole.secondaryAttributes.includes(key);

            return (
              <div
                key={key}
                className={`flex items-center justify-between gap-1 px-2 py-1 rounded-lg text-[11px] transition-colors ${
                  isKey
                    ? 'bg-[#b5ff00]/15 border border-[#b5ff00]/50 text-white font-semibold'
                    : isSecondary
                    ? 'bg-white/[0.06] border border-white/20 text-zinc-200 font-medium'
                    : 'text-zinc-400 border border-transparent'
                }`}
              >
                <span className="whitespace-nowrap">
                  {ATTRIBUTE_LABELS[key]}
                </span>
                <span
                  className={`font-mono tabular-nums shrink-0 ${
                    isKey
                      ? 'text-[#b5ff00] font-bold'
                      : isSecondary
                      ? 'text-white font-semibold'
                      : getAttributeColorClass(val)
                  }`}
                >
                  {val}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Reference Screen 3 Header: "Explorar / TÁTICAS" + Formation Segmented Pills */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-2 border-b border-white/[0.07]">
        <div>
          <span className="block text-xs sm:text-sm font-normal text-zinc-400 tracking-wide">
            Explorar prancheta
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-[0.95] mt-0.5">
            TÁTICAS
          </h2>
        </div>

        {/* Formation Pill Selector (4-3-3, 4-2-3-1, 4-4-2, 3-5-2) */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-1.5 bg-[#151821] p-1.5 rounded-full border border-white/[0.07]"
            role="group"
            aria-label="Selecionar Esquema Tático"
          >
            {(['4-3-3', '4-2-3-1', '4-4-2', '3-5-2'] as FormationType[]).map(
              (fmt) => (
                <button
                  key={fmt}
                  onClick={() => onChangeFormation(fmt)}
                  className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold transition-colors whitespace-nowrap ${
                    formation === fmt
                      ? 'bg-[#b5ff00] text-[#090a0f] shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {fmt}
                </button>
              )
            )}
          </div>

          {/* Sub-view switcher inspired by Reference Screen 3 Bottom Bar (Lineup | Tactics | Stats) */}
          <div className="flex items-center gap-1 bg-[#151821] p-1.5 rounded-full border border-white/[0.07]">
            {(
              [
                { id: 'tactics', label: 'Prancheta 2D' },
                { id: 'lineup', label: '11 Titulares' },
                { id: 'stats', label: 'Instruções' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setBoardSubView(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
                  boardSubView === tab.id
                    ? 'bg-white text-[#090a0f] font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Collective Instructions Strip & Sector Ratings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bg-[#14171f] border border-white/[0.07] rounded-[24px] p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Mentalidade Coletiva */}
          <div>
            <span className="block text-[11px] text-zinc-400 font-medium mb-2">
              Mentalidade Coletiva
            </span>
            <div className="grid grid-cols-3 gap-1 bg-[#0b0c10] p-1 rounded-full border border-white/[0.06]">
              {(
                ['Cautelosa', 'Equilibrada', 'Ofensiva'] as MentalityType[]
              ).map((ment) => (
                <button
                  key={ment}
                  onClick={() =>
                    onChangeInstructions({ ...instructions, mentality: ment })
                  }
                  className={`py-1.5 px-1.5 rounded-full text-[11px] font-bold transition-colors text-center whitespace-nowrap ${
                    instructions.mentality === ment
                      ? 'bg-[#b5ff00] text-[#090a0f]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {ment}
                </button>
              ))}
            </div>
          </div>

          {/* Linha Defensiva */}
          <div>
            <span className="block text-[11px] text-zinc-400 font-medium mb-2">
              Linha Defensiva
            </span>
            <div className="grid grid-cols-3 gap-1 bg-[#0b0c10] p-1 rounded-full border border-white/[0.06]">
              {(['Baixa', 'Padrão', 'Alta'] as DefensiveLineType[]).map(
                (line) => (
                  <button
                    key={line}
                    onClick={() =>
                      onChangeInstructions({
                        ...instructions,
                        defensiveLine: line,
                      })
                    }
                    className={`py-1.5 px-1.5 rounded-full text-[11px] font-bold transition-colors text-center whitespace-nowrap ${
                      instructions.defensiveLine === line
                        ? 'bg-white text-[#090a0f]'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {line}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Intensidade de Pressão */}
          <div>
            <span className="block text-[11px] text-zinc-400 font-medium mb-2">
              Intensidade de Pressão
            </span>
            <div className="grid grid-cols-3 gap-1 bg-[#0b0c10] p-1 rounded-full border border-white/[0.06]">
              {(
                ['Contida', 'Moderada', 'Extrema'] as PressingIntensityType[]
              ).map((press) => (
                <button
                  key={press}
                  onClick={() =>
                    onChangeInstructions({
                      ...instructions,
                      pressingIntensity: press,
                    })
                  }
                  className={`py-1.5 px-1.5 rounded-full text-[11px] font-bold transition-colors text-center whitespace-nowrap ${
                    instructions.pressingIntensity === press
                      ? 'bg-[#b5ff00] text-[#090a0f]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {press}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Tactical Synergy & Sector Ratings */}
        <div className="lg:col-span-4 bg-[#14171f] border border-white/[0.07] rounded-[24px] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white uppercase font-display tracking-wide">
              Avaliação Coletiva ({formation})
            </span>
            <span className="text-xs font-mono tabular-nums text-[#b5ff00] font-bold">
              Sinergia: {teamRatings.synergy}%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#0b0c10] border border-white/[0.06] rounded-2xl p-2.5 text-center">
              <div className="text-[10px] text-zinc-400 uppercase font-mono">
                Ataque
              </div>
              <div className="font-display text-2xl font-extrabold tabular-nums text-[#b5ff00] leading-tight">
                {teamRatings.attack.toFixed(1)}
              </div>
            </div>
            <div className="bg-[#0b0c10] border border-white/[0.06] rounded-2xl p-2.5 text-center">
              <div className="text-[10px] text-zinc-400 uppercase font-mono">
                Meio
              </div>
              <div className="font-display text-2xl font-extrabold tabular-nums text-white leading-tight">
                {teamRatings.midfield.toFixed(1)}
              </div>
            </div>
            <div className="bg-[#0b0c10] border border-white/[0.06] rounded-2xl p-2.5 text-center">
              <div className="text-[10px] text-zinc-400 uppercase font-mono">
                Defesa
              </div>
              <div className="font-display text-2xl font-extrabold tabular-nums text-[#d9ff7a] leading-tight">
                {teamRatings.defense.toFixed(1)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-2.5 pt-2 border-t border-white/[0.06]">
            <span>Estilo de Passe:</span>
            <div className="flex items-center gap-1">
              {(
                [
                  'Curto e Apoiado',
                  'Misto',
                  'Direto Vertical',
                ] as PassingStyleType[]
              ).map((style) => (
                <button
                  key={style}
                  onClick={() =>
                    onChangeInstructions({
                      ...instructions,
                      passingStyle: style,
                    })
                  }
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                    instructions.passingStyle === style
                      ? 'bg-[#b5ff00] text-[#090a0f]'
                      : 'bg-[#0b0c10] text-zinc-400 hover:text-white'
                  }`}
                >
                  {style.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Split: Dark Obsidian Pitch with Jersey Icons (Left 7 cols) + Role/Duty & Key Attribute Inspector (Right 5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive 2D Tactical Pitch (Reference Screen 3 exact visual style) */}
        <div className="xl:col-span-7 bg-[#14171f] border border-white/[0.07] rounded-[28px] p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
                Prancheta Tática 2D — Clique em uma Camisa no Campo
              </h3>
              <p className="text-xs text-zinc-400">
                Direção de ataque: Esquerda → Direita · Linha Defensiva:{' '}
                <strong className="text-[#b5ff00]">
                  {instructions.defensiveLine}
                </strong>
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="text-[#b5ff00] font-bold">
                ■ Camisa Lima (Atacar / Apoiar)
              </span>
              <span className="text-white font-bold">
                ■ Camisa Branca (Defender)
              </span>
            </div>
          </div>

          {/* Dark Obsidian 2D SVG Pitch with Curved Dotted Tactical Links & Jersey Icons */}
          <div className="relative w-full aspect-[16/10] bg-[#101217] rounded-[24px] overflow-hidden border border-white/10 select-none shadow-inner">
            <svg
              viewBox="0 0 1000 625"
              className="w-full h-full block"
              aria-label="Campo tático 2D interativo"
            >
              {/* Subtle Dark Pitch Bands */}
              {Array.from({ length: 10 }).map((_, i) => (
                <rect
                  key={i}
                  x={i * 100}
                  y={0}
                  width={100}
                  height={625}
                  fill={i % 2 === 0 ? '#101217' : '#13161d'}
                />
              ))}

              {/* Defensive Line Indicator Overlay */}
              <line
                x1={
                  instructions.defensiveLine === 'Alta'
                    ? 340
                    : instructions.defensiveLine === 'Padrão'
                    ? 250
                    : 170
                }
                y1={25}
                x2={
                  instructions.defensiveLine === 'Alta'
                    ? 340
                    : instructions.defensiveLine === 'Padrão'
                    ? 250
                    : 170
                }
                y2={600}
                stroke="#b5ff00"
                strokeWidth="2"
                strokeDasharray="8 6"
                opacity="0.4"
              />

              {/* Pitch Outer Lines (Clean dark-mode hairlines matching Reference Screen 3) */}
              <rect
                x="25"
                y="25"
                width="950"
                height="575"
                rx="18"
                fill="none"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="2"
              />
              {/* Halfway Line & Center Circle */}
              <line
                x1="500"
                y1="25"
                x2="500"
                y2="600"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="2"
              />
              <circle
                cx="500"
                cy="312.5"
                r="75"
                fill="none"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="2"
              />
              <circle cx="500" cy="312.5" r="4" fill="rgba(181,255,0,0.5)" />

              {/* Left Penalty Area */}
              <rect
                x="25"
                y="145"
                width="145"
                height="335"
                fill="none"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="2"
              />
              <rect
                x="25"
                y="225"
                width="55"
                height="175"
                fill="none"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="2"
              />

              {/* Right Penalty Area */}
              <rect
                x="830"
                y="145"
                width="145"
                height="335"
                fill="none"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="2"
              />
              <rect
                x="920"
                y="225"
                width="55"
                height="175"
                fill="none"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="2"
              />

              {/* Curved Dotted Tactical Connection Arcs (Exact motif from Reference Screen 3) */}
              {slots.map((slotA, i) =>
                slots.slice(i + 1).map((slotB, j) => {
                  const dist = Math.hypot(slotA.x - slotB.x, slotA.y - slotB.y);
                  if (dist > 34) return null;
                  const x1 = slotA.x * 10;
                  const y1 = (slotA.y / 100) * 625;
                  const x2 = slotB.x * 10;
                  const y2 = (slotB.y / 100) * 625;
                  const mx = (x1 + x2) / 2;
                  const my = (y1 + y2) / 2 - 22;
                  const isHighlighted =
                    slotA.slotIndex === selectedSlotIndex ||
                    slotB.slotIndex === selectedSlotIndex;
                  return (
                    <path
                      key={`${i}-${j}`}
                      d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                      fill="none"
                      stroke={
                        isHighlighted
                          ? 'rgba(181, 255, 0, 0.65)'
                          : 'rgba(255, 255, 255, 0.14)'
                      }
                      strokeWidth={isHighlighted ? '2.5' : '1.5'}
                      strokeDasharray="5 5"
                    />
                  );
                })
              )}
            </svg>

            {/* Interactive Jersey Nodes for the 11 Starters on the Pitch (Reference Screen 3) */}
            {slots.map((slot) => {
              const player =
                starters.find((p) => p.slotIndex === slot.slotIndex) ||
                starters[slot.slotIndex];
              if (!player) return null;

              const role = getRoleById(player.assignedRole);
              const fit = calculateRoleSuitability(player, role);
              const isSelected = selectedSlotIndex === slot.slotIndex;
              const lastName =
                player.name.split(' ').slice(-1)[0] || player.name;

              // Match Reference Screen 3: Lime shirts for Attack/Support or Selected; White shirts for Defensive roles
              const isLimeShirt =
                isSelected ||
                player.assignedDuty === 'Atacar' ||
                player.assignedDuty === 'Apoiar';

              const shirtFill = isLimeShirt ? '#b5ff00' : '#ffffff';
              const collarFill = '#0b0c10';

              return (
                <button
                  key={slot.slotIndex}
                  type="button"
                  onClick={() => setSelectedSlotIndex(slot.slotIndex)}
                  aria-label={`Selecionar ${player.name} (${role.name} - ${player.assignedDuty})`}
                  style={{
                    left: `${slot.x}%`,
                    top: `${slot.y}%`,
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 group flex flex-col items-center focus:outline-none transition-transform ${
                    isSelected ? 'scale-110 z-20' : 'hover:scale-105 z-10'
                  }`}
                >
                  {/* Custom Football Jersey SVG Icon with Shirt Number */}
                  <div
                    className={`relative w-8 h-8 sm:w-10 sm:h-10 lg:w-11 lg:h-11 flex items-center justify-center rounded-xl transition-all ${
                      isSelected
                        ? 'ring-2 sm:ring-4 ring-[#b5ff00]/50 shadow-[0_0_20px_rgba(181,255,0,0.35)]'
                        : 'drop-shadow-md'
                    }`}
                  >
                    <svg
                      viewBox="0 0 36 32"
                      className="w-full h-full overflow-visible"
                      aria-hidden="true"
                    >
                      <path
                        d="M11 2 L25 2 L34 9 L29 15 L25 12 L25 30 L11 30 L11 12 L7 15 L2 9 Z"
                        fill={shirtFill}
                        stroke="#0b0c10"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14.5 2 Q18 6.5 21.5 2"
                        fill="none"
                        stroke={collarFill}
                        strokeWidth="2.2"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center font-mono font-extrabold text-[10px] sm:text-xs text-[#090a0f] pt-1">
                      {player.number}
                    </span>
                  </div>

                  {/* Player Name & Role Suitability Caption */}
                  <div
                    className={`mt-0.5 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold whitespace-nowrap transition-colors ${
                      isSelected
                        ? 'bg-[#b5ff00] text-[#090a0f] font-extrabold shadow'
                        : 'bg-[#0b0c10]/90 text-zinc-200 border border-white/10'
                    }`}
                  >
                    <span>{lastName}</span>
                    <span className="hidden sm:inline opacity-80">
                      {' '}
                      · {role.shortCode} ({fit.score}%)
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bench Quick Swap Bar */}
          <div className="pt-2 border-t border-white/[0.07]">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
              <span>
                Substituir{' '}
                <strong className="text-[#b5ff00]">
                  #{selectedPlayer?.number} {selectedPlayer?.name}
                </strong>{' '}
                por atleta do banco:
              </span>
              <span className="font-mono">11 Reservas disponíveis</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {reserves.map((res) => {
                const cond = getConditionColor(res.condition);
                return (
                  <button
                    key={res.id}
                    onClick={() => {
                      if (selectedPlayer) {
                        onSwapPlayers(selectedPlayer.id, res.id);
                      }
                    }}
                    className="shrink-0 bg-[#0b0c10] hover:bg-white/[0.06] border border-white/[0.07] rounded-2xl px-3.5 py-2 text-left transition-colors"
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-mono text-[#b5ff00] font-bold">
                        {res.position}
                      </span>
                      <span className="font-semibold text-zinc-100">
                        {res.name}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono tabular-nums text-zinc-400 mt-0.5">
                      Cond:{' '}
                      <span className={cond.text}>
                        {Math.round(res.condition)}%
                      </span>{' '}
                      · Geral:{' '}
                      {calculatePlayerOverall(
                        res.attributes,
                        res.position
                      ).toFixed(1)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Selected Player Role, Duty & Highlighted Key Attributes (5 cols) */}
        <div className="xl:col-span-5 bg-[#14171f] border border-white/[0.07] rounded-[28px] p-5 flex flex-col justify-between space-y-4">
          {selectedPlayer && (
            <div className="space-y-4">
              {/* Player Header */}
              <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-white/[0.07]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#b5ff00]">
                      #{selectedPlayer.number} · {selectedSlot.label}
                    </span>
                    <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight text-white">
                      {selectedPlayer.name}
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Posição Natural: {selectedPlayer.position} · Condição:{' '}
                    <strong
                      className={`font-mono ${
                        getConditionColor(selectedPlayer.condition).text
                      }`}
                    >
                      {Math.round(selectedPlayer.condition)}%
                    </strong>
                  </p>
                </div>

                <button
                  onClick={() => onInspectPlayer(selectedPlayer)}
                  className="px-3.5 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-xs font-bold text-white transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Eye className="w-3.5 h-3.5 text-[#b5ff00]" />
                  Ficha Completa
                </button>
              </div>

              {/* Role & Duty Selector */}
              <div className="bg-[#0b0c10] border border-white/[0.07] rounded-2xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="tactical-role-select"
                      className="block text-[11px] font-medium text-zinc-400 mb-1.5"
                    >
                      Função Individual (Role)
                    </label>
                    <select
                      id="tactical-role-select"
                      value={selectedPlayer.assignedRole}
                      onChange={(e) => {
                        const nextRole = getRoleById(e.target.value);
                        const nextDuty = nextRole.allowedDuties.includes(
                          selectedPlayer.assignedDuty
                        )
                          ? selectedPlayer.assignedDuty
                          : nextRole.allowedDuties[0];
                        onUpdateRoleDuty(
                          selectedPlayer.id,
                          nextRole.id,
                          nextDuty
                        );
                      }}
                      className="w-full bg-[#14171f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#b5ff00]"
                    >
                      {TACTICAL_ROLES.map((r) => (
                        <option key={r.id} value={r.id}>
                          [{r.sector}] {r.name} ({r.shortCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="block text-[11px] font-medium text-zinc-400 mb-1.5">
                      Tarefa Tática (Duty)
                    </span>
                    <div className="flex items-center gap-1 bg-[#14171f] p-1 rounded-full border border-white/[0.07]">
                      {(
                        ['Defender', 'Apoiar', 'Atacar'] as TacticalDuty[]
                      ).map((duty) => {
                        const allowed =
                          selectedRole.allowedDuties.includes(duty);
                        const active = selectedPlayer.assignedDuty === duty;
                        return (
                          <button
                            key={duty}
                            disabled={!allowed}
                            onClick={() =>
                              onUpdateRoleDuty(
                                selectedPlayer.id,
                                selectedRole.id,
                                duty
                              )
                            }
                            className={`flex-1 py-1.5 px-2 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                              active
                                ? 'bg-[#b5ff00] text-[#090a0f]'
                                : allowed
                                ? 'text-zinc-300 hover:text-white'
                                : 'text-zinc-600 cursor-not-allowed'
                            }`}
                          >
                            {duty}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-white/[0.07] flex items-center justify-between text-xs">
                  <span className="text-white font-semibold">
                    {selectedRole.name} — {selectedPlayer.assignedDuty}
                  </span>
                  <span className="font-mono tabular-nums text-[#b5ff00] font-bold">
                    Adequação: {suitability.score}% (Média{' '}
                    {suitability.avgAttribute})
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {selectedRole.description}
                </p>
              </div>

              {/* Highlighted 18 Attributes for the Selected Role */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-300 font-semibold">
                    Atributos Exigidos para {selectedRole.name}:
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[#b5ff00] font-bold">■ Chave</span>
                    <span className="text-white font-semibold">
                      ■ Secundário
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {renderHighlightedAttributeCategory(
                    'Técnicos',
                    TECHNICAL_KEYS
                  )}
                  {renderHighlightedAttributeCategory('Mentais', MENTAL_KEYS)}
                  {renderHighlightedAttributeCategory(
                    'Físicos',
                    PHYSICAL_KEYS
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
