import React, { useState } from 'react';
import {
  Sliders,
  Shield,
  Zap,
  Target,
  ArrowUpRight,
  ArrowDownLeft,
  MoveHorizontal,
  UserCheck,
  Eye,
} from 'lucide-react';
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

  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(5); // Default to central midfielder / DM

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
      <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-2.5">
        <div className="text-[11px] font-semibold text-slate-400 mb-2 pb-1 border-b border-slate-800">
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
                className={`flex items-center justify-between gap-1 px-1.5 py-1 rounded text-[11px] transition-colors ${
                  isKey
                    ? 'bg-emerald-950/75 border border-emerald-500/50 text-emerald-200 font-semibold'
                    : isSecondary
                    ? 'bg-amber-950/45 border border-amber-500/35 text-amber-200 font-medium'
                    : 'text-slate-300 border border-transparent'
                }`}
              >
                <span className="whitespace-nowrap">{ATTRIBUTE_LABELS[key]}</span>
                <span
                  className={`font-mono tabular-nums shrink-0 ${
                    isKey
                      ? 'text-emerald-300 font-bold'
                      : isSecondary
                      ? 'text-amber-300 font-semibold'
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
      {/* Top Bar: Formations + Collective Instructions + Team Tactical Ratings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Formation & Collective Instructions */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Esquema Tático */}
          <div>
            <span className="block text-[11px] text-slate-400 font-medium mb-1.5">
              Esquema Tático (Formação)
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {(['4-3-3', '4-2-3-1', '4-4-2', '3-5-2'] as FormationType[]).map(
                (fmt) => (
                  <button
                    key={fmt}
                    onClick={() => onChangeFormation(fmt)}
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-mono font-semibold transition-colors whitespace-nowrap ${
                      formation === fmt
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {fmt}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Mentalidade Coletiva */}
          <div>
            <span className="block text-[11px] text-slate-400 font-medium mb-1.5">
              Mentalidade da Equipe
            </span>
            <div className="flex flex-col gap-1">
              {(
                ['Cautelosa', 'Equilibrada', 'Ofensiva'] as MentalityType[]
              ).map((ment) => (
                <button
                  key={ment}
                  onClick={() =>
                    onChangeInstructions({ ...instructions, mentality: ment })
                  }
                  className={`py-1 px-2.5 rounded text-xs font-medium text-left transition-colors flex items-center justify-between ${
                    instructions.mentality === ment
                      ? ment === 'Ofensiva'
                        ? 'bg-emerald-600 text-white'
                        : ment === 'Equilibrada'
                        ? 'bg-sky-600 text-white'
                        : 'bg-amber-600 text-slate-950 font-semibold'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span>{ment}</span>
                  {instructions.mentality === ment && (
                    <span className="text-[10px] font-mono">Ativa</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Linha Defensiva */}
          <div>
            <span className="block text-[11px] text-slate-400 font-medium mb-1.5">
              Altura da Linha Defensiva
            </span>
            <div className="flex flex-col gap-1">
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
                    className={`py-1 px-2.5 rounded text-xs font-medium text-left transition-colors flex items-center justify-between ${
                      instructions.defensiveLine === line
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span>Linha {line}</span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Intensidade de Pressão */}
          <div>
            <span className="block text-[11px] text-slate-400 font-medium mb-1.5">
              Intensidade de Pressão
            </span>
            <div className="flex flex-col gap-1">
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
                  className={`py-1 px-2.5 rounded text-xs font-medium text-left transition-colors flex items-center justify-between ${
                    instructions.pressingIntensity === press
                      ? press === 'Extrema'
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'bg-emerald-600 text-white'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span>Pressão {press}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Tactical Synergy & Sector Ratings */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="text-xs font-semibold text-slate-200">
              Avaliação Tática Coletiva ({formation})
            </span>
            <span className="text-xs font-mono tabular-nums text-emerald-400 font-bold">
              Sinergia: {teamRatings.synergy}%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 my-2">
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
              <div className="text-[11px] text-slate-400">Ataque</div>
              <div className="text-lg font-bold font-mono tabular-nums text-emerald-400">
                {teamRatings.attack.toFixed(1)}
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
              <div className="text-[11px] text-slate-400">Meio-Campo</div>
              <div className="text-lg font-bold font-mono tabular-nums text-sky-400">
                {teamRatings.midfield.toFixed(1)}
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
              <div className="text-[11px] text-slate-400">Defesa</div>
              <div className="text-lg font-bold font-mono tabular-nums text-amber-400">
                {teamRatings.defense.toFixed(1)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
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
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    instructions.passingStyle === style
                      ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {style.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Split: 2D Interactive Pitch (Left 7 cols) + Role/Duty & Key Attribute Inspector (Right 5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left: Interactive 2D Tactical Pitch */}
        <div className="xl:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Prancheta Tática 2D — Clique em um Jogador no Campo
              </h2>
              <p className="text-xs text-slate-400">
                Direção de ataque: Esquerda → Direita · Linha Defensiva:{' '}
                <strong className="text-emerald-400">
                  {instructions.defensiveLine}
                </strong>
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
              <span className="text-sky-400">● Defender</span>
              <span className="text-emerald-400">● Apoiar</span>
              <span className="text-amber-400">● Atacar</span>
            </div>
          </div>

          {/* 2D SVG Pitch with interactive player nodes */}
          <div className="relative w-full aspect-[16/10] bg-emerald-950 rounded-xl overflow-hidden border border-emerald-500/30 select-none">
            <svg
              viewBox="0 0 1000 625"
              className="w-full h-full block"
              aria-label="Campo tático 2D interativo"
            >
              {/* Turf Stripes */}
              {Array.from({ length: 10 }).map((_, i) => (
                <rect
                  key={i}
                  x={i * 100}
                  y={0}
                  width={100}
                  height={625}
                  fill={i % 2 === 0 ? '#064e3b' : '#065f46'}
                  opacity={0.75}
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
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray="8 6"
                opacity="0.55"
              />

              {/* Pitch Outer Lines */}
              <rect
                x="25"
                y="25"
                width="950"
                height="575"
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="2.5"
              />
              {/* Halfway Line & Center Circle */}
              <line
                x1="500"
                y1="25"
                x2="500"
                y2="600"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="2"
              />
              <circle
                cx="500"
                cy="312.5"
                r="75"
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="2"
              />
              <circle cx="500" cy="312.5" r="4" fill="rgba(255,255,255,0.5)" />

              {/* Left Penalty Area (Home Goal) */}
              <rect
                x="25"
                y="145"
                width="145"
                height="335"
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="2"
              />
              <rect
                x="25"
                y="225"
                width="55"
                height="175"
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="2"
              />

              {/* Right Penalty Area (Opponent Goal) */}
              <rect
                x="830"
                y="145"
                width="145"
                height="335"
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="2"
              />
              <rect
                x="920"
                y="225"
                width="55"
                height="175"
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="2"
              />

              {/* Tactical Connection Lines between adjacent sectors */}
              {slots.map((slotA, i) =>
                slots.slice(i + 1).map((slotB, j) => {
                  const dist = Math.hypot(slotA.x - slotB.x, slotA.y - slotB.y);
                  if (dist > 34) return null;
                  return (
                    <line
                      key={`${i}-${j}`}
                      x1={slotA.x * 10}
                      y1={(slotA.y / 100) * 625}
                      x2={slotB.x * 10}
                      y2={(slotB.y / 100) * 625}
                      stroke="rgba(16, 185, 129, 0.22)"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                  );
                })
              )}
            </svg>

            {/* Interactive HTML Button Nodes for the 11 Starters on the Pitch */}
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

              const dutyBorder =
                player.assignedDuty === 'Atacar'
                  ? 'border-amber-400'
                  : player.assignedDuty === 'Apoiar'
                  ? 'border-emerald-400'
                  : 'border-sky-400';

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
                  {/* Circle Token */}
                  <div
                    className={`w-10 h-10 rounded-full flex flex-col items-center justify-center font-mono font-bold shadow-lg border-2 transition-colors ${dutyBorder} ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-400/40'
                        : 'bg-slate-950/95 text-slate-100 group-hover:bg-slate-900'
                    }`}
                  >
                    <span className="text-xs leading-none">
                      {player.number}
                    </span>
                    <span className="text-[9px] leading-none opacity-85 mt-0.5">
                      {role.shortCode}
                    </span>
                  </div>

                  {/* Name & Role Tag */}
                  <div
                    className={`mt-1 px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap shadow ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-950/90 text-slate-200 border border-slate-800'
                    }`}
                  >
                    {lastName} · {fit.score}%
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bench Quick Swap Bar */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>
                Substituir{' '}
                <strong className="text-emerald-400">
                  #{selectedPlayer?.number} {selectedPlayer?.name}
                </strong>{' '}
                por jogador do banco de reservas:
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
                    className="shrink-0 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg px-3 py-1.5 text-left transition-colors"
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-mono text-emerald-400 font-semibold">
                        {res.position}
                      </span>
                      <span className="font-medium text-slate-200">
                        {res.name}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono tabular-nums text-slate-400 mt-0.5">
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
        <div className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          {selectedPlayer && (
            <>
              <div className="space-y-4">
                {/* Player Header */}
                <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        #{selectedPlayer.number} · {selectedSlot.label}
                      </span>
                      <h3 className="text-base font-bold text-slate-100">
                        {selectedPlayer.name}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
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
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Ficha Completa
                  </button>
                </div>

                {/* Role & Duty Selector */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="tactical-role-select"
                        className="block text-[11px] font-medium text-slate-400 mb-1"
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
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                      >
                        {TACTICAL_ROLES.map((r) => (
                          <option key={r.id} value={r.id}>
                            [{r.sector}] {r.name} ({r.shortCode})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="block text-[11px] font-medium text-slate-400 mb-1">
                        Tarefa Tática (Duty)
                      </span>
                      <div className="flex items-center gap-1">
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
                              className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                                active
                                  ? 'bg-emerald-600 text-white'
                                  : allowed
                                  ? 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                                  : 'bg-slate-950 text-slate-600 border border-slate-900 cursor-not-allowed'
                              }`}
                            >
                              {duty}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">
                      {selectedRole.name} — {selectedPlayer.assignedDuty}
                    </span>
                    <span className="font-mono tabular-nums text-emerald-400 font-bold">
                      Adequação: {suitability.score}% (Média{' '}
                      {suitability.avgAttribute})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {selectedRole.description}
                  </p>
                </div>

                {/* Highlighted 18 Attributes for the Selected Role */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300 font-semibold">
                      Atributos Exigidos para {selectedRole.name}:
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 font-medium">
                        ■ Chave
                      </span>
                      <span className="text-amber-300 font-medium">
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};
