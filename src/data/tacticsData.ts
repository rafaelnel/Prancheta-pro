import {
  AttributeKey,
  FormationSlot,
  FormationType,
  TacticalRoleDefinition,
} from '../types/football';

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  // Técnicos (6)
  passe: 'Passe',
  finalizacao: 'Finalização',
  drible: 'Drible',
  desarme: 'Desarme',
  primeiroToque: 'Primeiro Toque',
  cruzamento: 'Cruzamento',
  // Mentais (6)
  decisoes: 'Decisões',
  visaoDeJogo: 'Visão de Jogo',
  compostura: 'Compostura',
  semBola: 'Sem Bola',
  posicionamento: 'Posicionamento',
  indiceDeTrabalho: 'Índice de Trabalho',
  // Físicos (6)
  velocidade: 'Velocidade',
  aceleracao: 'Aceleração',
  resistencia: 'Resistência',
  forca: 'Força',
  impulsao: 'Impulsão',
  agilidade: 'Agilidade',
};

export const TECHNICAL_KEYS: AttributeKey[] = [
  'passe',
  'finalizacao',
  'drible',
  'desarme',
  'primeiroToque',
  'cruzamento',
];

export const MENTAL_KEYS: AttributeKey[] = [
  'decisoes',
  'visaoDeJogo',
  'compostura',
  'semBola',
  'posicionamento',
  'indiceDeTrabalho',
];

export const PHYSICAL_KEYS: AttributeKey[] = [
  'velocidade',
  'aceleracao',
  'resistencia',
  'forca',
  'impulsao',
  'agilidade',
];

export const TACTICAL_ROLES: TacticalRoleDefinition[] = [
  // GOLEIROS
  {
    id: 'goleiro-libero',
    name: 'Goleiro Líbero',
    shortCode: 'GL',
    sector: 'GOL',
    allowedDuties: ['Defender', 'Apoiar'],
    description:
      'Atua fora da pequena área para interceptar bolas nas costas da defesa e inicia a construção curta com os pés.',
    keyAttributes: ['posicionamento', 'decisoes', 'passe', 'compostura'],
    secondaryAttributes: ['aceleracao', 'visaoDeJogo', 'agilidade', 'primeiroToque'],
  },
  {
    id: 'goleiro-tradicional',
    name: 'Goleiro Tradicional',
    shortCode: 'GT',
    sector: 'GOL',
    allowedDuties: ['Defender'],
    description:
      'Prioriza a proteção segura debaixo das traves, domínio aéreo na pequena área e reposições diretas sem riscos.',
    keyAttributes: ['posicionamento', 'agilidade', 'impulsao', 'compostura'],
    secondaryAttributes: ['decisoes', 'forca'],
  },

  // DEFENSORES
  {
    id: 'zagueiro-construtor',
    name: 'Zagueiro Construtor',
    shortCode: 'ZC',
    sector: 'DEF',
    allowedDuties: ['Defender', 'Apoiar'],
    description:
      'Quebra linhas de pressão adversárias com passes verticais precisos e conduz a bola até o meio-campo quando há espaço.',
    keyAttributes: ['passe', 'visaoDeJogo', 'compostura', 'desarme', 'posicionamento'],
    secondaryAttributes: ['primeiroToque', 'decisoes', 'forca', 'impulsao'],
  },
  {
    id: 'zagueiro-central',
    name: 'Zagueiro Central',
    shortCode: 'ZAG',
    sector: 'DEF',
    allowedDuties: ['Defender'],
    description:
      'Focado na contenção direta dos atacantes rivais, cobertura da área, duelos aéreos e cortes sem hesitação.',
    keyAttributes: ['desarme', 'posicionamento', 'forca', 'impulsao'],
    secondaryAttributes: ['decisoes', 'compostura', 'velocidade'],
  },
  {
    id: 'lateral-completo',
    name: 'Lateral Completo',
    shortCode: 'LC',
    sector: 'DEF',
    allowedDuties: ['Apoiar', 'Atacar'],
    description:
      'Combina obrigações defensivas no corredor com ultrapassagens constantes até a linha de fundo para cruzar.',
    keyAttributes: ['cruzamento', 'resistencia', 'velocidade', 'indiceDeTrabalho', 'desarme'],
    secondaryAttributes: ['aceleracao', 'drible', 'semBola', 'posicionamento'],
  },
  {
    id: 'ala-invertido',
    name: 'Ala Invertido',
    shortCode: 'AI',
    sector: 'DEF',
    allowedDuties: ['Defender', 'Apoiar'],
    description:
      'Desloca-se da lateral para o corredor central durante a posse de bola, gerando superioridade numérica no meio-campo.',
    keyAttributes: ['passe', 'decisoes', 'posicionamento', 'desarme', 'visaoDeJogo'],
    secondaryAttributes: ['primeiroToque', 'compostura', 'indiceDeTrabalho'],
  },

  // MEIO-CAMPISTAS
  {
    id: 'armador-recuado',
    name: 'Armador Recuado',
    shortCode: 'AR',
    sector: 'MEI',
    allowedDuties: ['Defender', 'Apoiar'],
    description:
      'Atua no espaço entre a defesa e o meio-campo, ditando o ritmo da equipe com passes precisos e inversões de jogo.',
    keyAttributes: ['passe', 'visaoDeJogo', 'primeiroToque', 'compostura', 'decisoes'],
    secondaryAttributes: ['posicionamento', 'desarme', 'semBola'],
  },
  {
    id: 'volante-recuperador',
    name: 'Volante Recuperador',
    shortCode: 'VRB',
    sector: 'MEI',
    allowedDuties: ['Defender', 'Apoiar'],
    description:
      'Pressiona incansavelmente o portador da bola para recuperar a posse e entregá-la rapidamente aos jogadores mais criativos.',
    keyAttributes: ['desarme', 'indiceDeTrabalho', 'resistencia', 'posicionamento', 'forca'],
    secondaryAttributes: ['aceleracao', 'decisoes', 'passe'],
  },
  {
    id: 'meia-area-a-area',
    name: 'Meia Área-a-Área',
    shortCode: 'MAA',
    sector: 'MEI',
    allowedDuties: ['Apoiar'],
    description:
      'Dinamismo total para auxiliar na proteção da própria área e infiltrar de surpresa na área adversária para finalizar.',
    keyAttributes: ['resistencia', 'indiceDeTrabalho', 'passe', 'semBola', 'desarme'],
    secondaryAttributes: ['finalizacao', 'primeiroToque', 'decisoes', 'forca'],
  },
  {
    id: 'armador-avancado',
    name: 'Armador Avançado',
    shortCode: 'AA',
    sector: 'MEI',
    allowedDuties: ['Apoiar', 'Atacar'],
    description:
      'Opera nas entrelinhas da defesa adversária buscando o último passe decisivo ou finalizações da entrada da área.',
    keyAttributes: ['passe', 'visaoDeJogo', 'primeiroToque', 'drible', 'decisoes'],
    secondaryAttributes: ['semBola', 'compostura', 'agilidade'],
  },
  {
    id: 'mezzala',
    name: 'Mezzala',
    shortCode: 'MEZ',
    sector: 'MEI',
    allowedDuties: ['Apoiar', 'Atacar'],
    description:
      'Meio-campista interior que ataca os meios-espaços laterais, combinando condução agressiva e infiltrações diagonais.',
    keyAttributes: ['passe', 'drible', 'semBola', 'aceleracao', 'indiceDeTrabalho'],
    secondaryAttributes: ['visaoDeJogo', 'primeiroToque', 'finalizacao'],
  },

  // ATACANTES E EXTREMOS
  {
    id: 'extremo-invertido',
    name: 'Extremo Invertido',
    shortCode: 'EI',
    sector: 'ATA',
    allowedDuties: ['Apoiar', 'Atacar'],
    description:
      'Corta da ponta em direção ao centro do campo para abrir espaço aos laterais e buscar finalizações ou passes em diagonal.',
    keyAttributes: ['drible', 'finalizacao', 'aceleracao', 'velocidade', 'semBola'],
    secondaryAttributes: ['primeiroToque', 'passe', 'agilidade', 'compostura'],
  },
  {
    id: 'ponta-classico',
    name: 'Ponta Clássico',
    shortCode: 'PC',
    sector: 'ATA',
    allowedDuties: ['Apoiar', 'Atacar'],
    description:
      'Mantém a amplitude máxima junto à linha lateral para superar o marcador no mano a mano e abastecer a área com cruzamentos.',
    keyAttributes: ['cruzamento', 'velocidade', 'aceleracao', 'drible'],
    secondaryAttributes: ['agilidade', 'semBola', 'primeiroToque'],
  },
  {
    id: 'atacante-completo',
    name: 'Atacante Completo',
    shortCode: 'AC',
    sector: 'ATA',
    allowedDuties: ['Apoiar', 'Atacar'],
    description:
      'Combina capacidade técnica de pivô, mobilidade para cair pelos lados e letalidade clínica dentro da grande área.',
    keyAttributes: ['finalizacao', 'compostura', 'semBola', 'primeiroToque', 'forca'],
    secondaryAttributes: ['drible', 'aceleracao', 'impulsao', 'decisoes'],
  },
  {
    id: 'ponta-de-lanca',
    name: 'Ponta de Lança',
    shortCode: 'PL',
    sector: 'ATA',
    allowedDuties: ['Atacar'],
    description:
      'Atua no limite da linha de impedimento adversária, focado em atacar as costas dos zagueiros e finalizar em um toque.',
    keyAttributes: ['finalizacao', 'semBola', 'aceleracao', 'velocidade', 'compostura'],
    secondaryAttributes: ['primeiroToque', 'decisoes'],
  },
  {
    id: 'falso-nove',
    name: 'Falso Nove',
    shortCode: 'F9',
    sector: 'ATA',
    allowedDuties: ['Apoiar'],
    description:
      'Recua da referência central para atrair os zagueiros rivais, abrindo espaço para a infiltração dos extremos.',
    keyAttributes: ['passe', 'visaoDeJogo', 'primeiroToque', 'drible', 'decisoes'],
    secondaryAttributes: ['compostura', 'semBola', 'agilidade'],
  },
];

export const FORMATIONS: Record<FormationType, FormationSlot[]> = {
  '4-3-3': [
    { slotIndex: 0, label: 'GOL', sector: 'GOL', defaultRole: 'goleiro-libero', defaultDuty: 'Defender', x: 8, y: 50 },
    { slotIndex: 1, label: 'LD', sector: 'DEF', defaultRole: 'lateral-completo', defaultDuty: 'Apoiar', x: 26, y: 84 },
    { slotIndex: 2, label: 'ZAG', sector: 'DEF', defaultRole: 'zagueiro-construtor', defaultDuty: 'Defender', x: 22, y: 63 },
    { slotIndex: 3, label: 'ZAG', sector: 'DEF', defaultRole: 'zagueiro-central', defaultDuty: 'Defender', x: 22, y: 37 },
    { slotIndex: 4, label: 'LE', sector: 'DEF', defaultRole: 'ala-invertido', defaultDuty: 'Apoiar', x: 26, y: 16 },
    { slotIndex: 5, label: 'VOL', sector: 'MEI', defaultRole: 'armador-recuado', defaultDuty: 'Defender', x: 43, y: 50 },
    { slotIndex: 6, label: 'MC', sector: 'MEI', defaultRole: 'meia-area-a-area', defaultDuty: 'Apoiar', x: 56, y: 68 },
    { slotIndex: 7, label: 'MC', sector: 'MEI', defaultRole: 'mezzala', defaultDuty: 'Atacar', x: 56, y: 32 },
    { slotIndex: 8, label: 'PD', sector: 'ATA', defaultRole: 'extremo-invertido', defaultDuty: 'Atacar', x: 78, y: 80 },
    { slotIndex: 9, label: 'PE', sector: 'ATA', defaultRole: 'extremo-invertido', defaultDuty: 'Apoiar', x: 78, y: 20 },
    { slotIndex: 10, label: 'ATA', sector: 'ATA', defaultRole: 'atacante-completo', defaultDuty: 'Atacar', x: 86, y: 50 },
  ],
  '4-2-3-1': [
    { slotIndex: 0, label: 'GOL', sector: 'GOL', defaultRole: 'goleiro-libero', defaultDuty: 'Defender', x: 8, y: 50 },
    { slotIndex: 1, label: 'LD', sector: 'DEF', defaultRole: 'lateral-completo', defaultDuty: 'Apoiar', x: 25, y: 84 },
    { slotIndex: 2, label: 'ZAG', sector: 'DEF', defaultRole: 'zagueiro-construtor', defaultDuty: 'Defender', x: 22, y: 63 },
    { slotIndex: 3, label: 'ZAG', sector: 'DEF', defaultRole: 'zagueiro-central', defaultDuty: 'Defender', x: 22, y: 37 },
    { slotIndex: 4, label: 'LE', sector: 'DEF', defaultRole: 'lateral-completo', defaultDuty: 'Apoiar', x: 25, y: 16 },
    { slotIndex: 5, label: 'VOL', sector: 'MEI', defaultRole: 'volante-recuperador', defaultDuty: 'Defender', x: 42, y: 64 },
    { slotIndex: 6, label: 'VOL', sector: 'MEI', defaultRole: 'armador-recuado', defaultDuty: 'Apoiar', x: 42, y: 36 },
    { slotIndex: 7, label: 'MEI', sector: 'MEI', defaultRole: 'armador-avancado', defaultDuty: 'Atacar', x: 64, y: 50 },
    { slotIndex: 8, label: 'PD', sector: 'ATA', defaultRole: 'extremo-invertido', defaultDuty: 'Atacar', x: 72, y: 82 },
    { slotIndex: 9, label: 'PE', sector: 'ATA', defaultRole: 'ponta-classico', defaultDuty: 'Apoiar', x: 72, y: 18 },
    { slotIndex: 10, label: 'ATA', sector: 'ATA', defaultRole: 'ponta-de-lanca', defaultDuty: 'Atacar', x: 86, y: 50 },
  ],
  '4-4-2': [
    { slotIndex: 0, label: 'GOL', sector: 'GOL', defaultRole: 'goleiro-tradicional', defaultDuty: 'Defender', x: 8, y: 50 },
    { slotIndex: 1, label: 'LD', sector: 'DEF', defaultRole: 'lateral-completo', defaultDuty: 'Apoiar', x: 25, y: 84 },
    { slotIndex: 2, label: 'ZAG', sector: 'DEF', defaultRole: 'zagueiro-construtor', defaultDuty: 'Defender', x: 22, y: 63 },
    { slotIndex: 3, label: 'ZAG', sector: 'DEF', defaultRole: 'zagueiro-central', defaultDuty: 'Defender', x: 22, y: 37 },
    { slotIndex: 4, label: 'LE', sector: 'DEF', defaultRole: 'lateral-completo', defaultDuty: 'Apoiar', x: 25, y: 16 },
    { slotIndex: 5, label: 'MC', sector: 'MEI', defaultRole: 'volante-recuperador', defaultDuty: 'Defender', x: 50, y: 62 },
    { slotIndex: 6, label: 'MC', sector: 'MEI', defaultRole: 'meia-area-a-area', defaultDuty: 'Apoiar', x: 50, y: 38 },
    { slotIndex: 7, label: 'PD', sector: 'MEI', defaultRole: 'ponta-classico', defaultDuty: 'Atacar', x: 58, y: 84 },
    { slotIndex: 8, label: 'PE', sector: 'MEI', defaultRole: 'ponta-classico', defaultDuty: 'Apoiar', x: 58, y: 16 },
    { slotIndex: 9, label: 'ATA', sector: 'ATA', defaultRole: 'falso-nove', defaultDuty: 'Apoiar', x: 82, y: 62 },
    { slotIndex: 10, label: 'ATA', sector: 'ATA', defaultRole: 'ponta-de-lanca', defaultDuty: 'Atacar', x: 85, y: 38 },
  ],
  '3-5-2': [
    { slotIndex: 0, label: 'GOL', sector: 'GOL', defaultRole: 'goleiro-libero', defaultDuty: 'Defender', x: 8, y: 50 },
    { slotIndex: 1, label: 'ZAG', sector: 'DEF', defaultRole: 'zagueiro-construtor', defaultDuty: 'Apoiar', x: 23, y: 74 },
    { slotIndex: 2, label: 'ZAG', sector: 'DEF', defaultRole: 'zagueiro-central', defaultDuty: 'Defender', x: 20, y: 50 },
    { slotIndex: 3, label: 'ZAG', sector: 'DEF', defaultRole: 'zagueiro-construtor', defaultDuty: 'Defender', x: 23, y: 26 },
    { slotIndex: 4, label: 'LD', sector: 'DEF', defaultRole: 'lateral-completo', defaultDuty: 'Atacar', x: 52, y: 86 },
    { slotIndex: 5, label: 'LE', sector: 'DEF', defaultRole: 'lateral-completo', defaultDuty: 'Atacar', x: 52, y: 14 },
    { slotIndex: 6, label: 'VOL', sector: 'MEI', defaultRole: 'armador-recuado', defaultDuty: 'Defender', x: 42, y: 50 },
    { slotIndex: 7, label: 'MC', sector: 'MEI', defaultRole: 'meia-area-a-area', defaultDuty: 'Apoiar', x: 58, y: 65 },
    { slotIndex: 8, label: 'MC', sector: 'MEI', defaultRole: 'mezzala', defaultDuty: 'Atacar', x: 58, y: 35 },
    { slotIndex: 9, label: 'ATA', sector: 'ATA', defaultRole: 'atacante-completo', defaultDuty: 'Apoiar', x: 83, y: 62 },
    { slotIndex: 10, label: 'ATA', sector: 'ATA', defaultRole: 'ponta-de-lanca', defaultDuty: 'Atacar', x: 85, y: 38 },
  ],
};

export function getRoleById(roleId: string): TacticalRoleDefinition {
  return (
    TACTICAL_ROLES.find((r) => r.id === roleId) || TACTICAL_ROLES[0]
  );
}

export function getRolesForSector(sector: 'GOL' | 'DEF' | 'MEI' | 'ATA'): TacticalRoleDefinition[] {
  return TACTICAL_ROLES.filter((r) => r.sector === sector);
}
