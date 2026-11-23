import { ClubDivision, NaturalPosition, PotentialStars } from '../types/football';

export type RealYouthProspectSeed = [
  name: string,
  age: number,
  nationality: string,
  position: NaturalPosition,
  currentOvr: number,
  potentialStars: PotentialStars,
];

/**
 * Jogadores reais em ascensão nas categorias de base (Sub-17 / Sub-20 / Equipe B)
 * calibrados para Setembro de 2026.
 */
export const REAL_YOUTH_ACADEMY_SEEDS: Record<string, RealYouthProspectSeed[]> = {
  // =========================================================================
  // BRASILEIRÃO SÉRIE A (20 CLUBES)
  // =========================================================================
  flamengo: [
    ['Lorran', 19, 'Brasil', 'MEI', 75, 4.5],
    ['Wallace Yan', 19, 'Brasil', 'ATA', 73, 4.0],
    ['João Victor', 18, 'Brasil', 'ZAG', 73, 4.5],
    ['Joshua', 18, 'Brasil', 'MEI', 72, 4.5],
    ['Ryan Roberto', 17, 'Brasil', 'PE', 71, 4.5],
  ],
  palmeiras: [
    ['Luighi', 19, 'Brasil', 'ATA', 74, 4.5],
    ['Riquelme Fillipi', 19, 'Brasil', 'PE', 73, 4.5],
    ['Figueiredo', 19, 'Brasil', 'MC', 73, 4.0],
    ['Erick Belé', 18, 'Brasil', 'MEI', 72, 4.5],
    ['Luis Pacheco', 17, 'Brasil', 'VOL', 71, 4.0],
  ],
  botafogo: [
    ['Kauê Leonardo', 19, 'Brasil', 'MC', 73, 4.0],
    ['Kayke', 19, 'Brasil', 'ATA', 73, 4.0],
    ['Yarlen', 19, 'Brasil', 'PE', 72, 4.0],
    ['Kauan Toledo', 18, 'Brasil', 'PD', 71, 4.0],
    ['Bernardo Valim', 19, 'Brasil', 'MEI', 71, 3.5],
  ],
  cruzeiro: [
    ['Tevis', 19, 'Brasil', 'PE', 73, 4.0],
    ['Kaique Kenji', 19, 'Brasil', 'ATA', 73, 4.5],
    ['Cauan Baptistella', 18, 'Brasil', 'MEI', 72, 4.5],
    ['Jhosefer', 19, 'Brasil', 'MC', 72, 4.0],
    ['Bruno Alves', 19, 'Brasil', 'ZAG', 71, 4.0],
  ],
  corinthians: [
    ['Gui Negão', 18, 'Brasil', 'ATA', 73, 4.5],
    ['Denner', 17, 'Brasil', 'LE', 72, 4.5],
    ['Luiz Eduardo', 18, 'Brasil', 'MEI', 72, 4.0],
    ['Dieguinho', 18, 'Brasil', 'PD', 72, 4.0],
    ['Bahia', 19, 'Brasil', 'VOL', 72, 4.0],
  ],
  'atletico-mg': [
    ['Gabriel Veneno', 16, 'Brasil', 'PD', 73, 5.0],
    ['Mateus Iseppe', 19, 'Brasil', 'MEI', 73, 4.5],
    ['Índio', 17, 'Brasil', 'MC', 72, 4.5],
    ['Louback', 19, 'Brasil', 'ATA', 72, 4.0],
    ['Pedro Ataíde', 18, 'Brasil', 'PE', 71, 4.0],
  ],
  internacional: [
    ['Luis Otávio', 18, 'Brasil', 'VOL', 73, 4.5],
    ['Gustavo Prado', 19, 'Brasil', 'MC', 73, 4.0],
    ['Yago Noal', 18, 'Brasil', 'MEI', 72, 4.0],
    ['Henrique Menke', 18, 'Brasil', 'GOL', 71, 4.0],
    ['Raykkonen', 17, 'Brasil', 'ATA', 71, 4.0],
  ],
  'sao-paulo': [
    ['Henrique Carmo', 19, 'Brasil', 'PD', 74, 4.5],
    ['Matheus Alves', 19, 'Brasil', 'MEI', 73, 4.0],
    ['Lucca Marques', 18, 'Brasil', 'PE', 72, 4.5],
    ['Igão', 18, 'Brasil', 'ZAG', 72, 4.0],
    ['Nicolas Bosshardt', 18, 'Brasil', 'LE', 71, 4.0],
  ],
  bahia: [
    ['Dell', 17, 'Brasil', 'ATA', 73, 4.5],
    ['Ruan Pablo', 17, 'Brasil', 'PE', 73, 4.5],
    ['Roger Gabriel', 18, 'Brasil', 'MEI', 72, 4.5],
    ['Sidney', 18, 'Brasil', 'VOL', 71, 4.0],
    ['Kauã Davi', 19, 'Brasil', 'ZAG', 71, 3.5],
  ],
  fluminense: [
    ['Riquelme Felipe', 18, 'Brasil', 'PD', 74, 4.5],
    ['Isaque', 18, 'Brasil', 'MEI', 73, 4.5],
    ['Wallace Davi', 18, 'Brasil', 'VOL', 72, 4.0],
    ['Matheus Reis', 18, 'Brasil', 'PE', 72, 4.0],
    ['Gorgulho', 17, 'Brasil', 'ZAG', 70, 4.0],
  ],
  gremio: [
    ['Gabriel Mec', 17, 'Brasil', 'MEI', 74, 5.0],
    ['Alysson Edward', 19, 'Brasil', 'PD', 73, 4.0],
    ['Tiaguinho', 17, 'Brasil', 'VOL', 72, 4.5],
    ['Luis Eduardo', 17, 'Brasil', 'ZAG', 72, 4.5],
    ['Jardiel', 19, 'Brasil', 'ATA', 72, 4.0],
  ],
  vasco: [
    ['Lukas Zuccarello', 18, 'Brasil', 'MEI', 72, 4.0],
    ['Bruno Lopes', 18, 'Brasil', 'ATA', 72, 4.0],
    ['Juninho', 18, 'Brasil', 'PE', 71, 4.0],
    ['Phillipe Gabriel', 19, 'Brasil', 'GOL', 71, 4.0],
    ['Avellar', 18, 'Brasil', 'LE', 70, 3.5],
  ],
  santos: [
    ['Robinho Jr.', 18, 'Brasil', 'MEI', 73, 4.5],
    ['Luca Meirelles', 18, 'Brasil', 'ATA', 73, 4.5],
    ['Nadson', 17, 'Brasil', 'PD', 72, 4.5],
    ['Mateus Xavier', 18, 'Brasil', 'PE', 71, 4.0],
    ['João Alencar', 18, 'Brasil', 'ZAG', 70, 3.5],
  ],
  bragantino: [
    ['Athyrson', 19, 'Brasil', 'ATA', 71, 4.0],
    ['Alexandre Pena', 18, 'Brasil', 'MEI', 70, 4.0],
    ['Marcelinho Braz', 18, 'Brasil', 'PE', 70, 3.5],
    ['Cauê Nascimento', 18, 'Brasil', 'VOL', 69, 3.5],
    ['Gustavo Reis', 18, 'Brasil', 'GOL', 69, 3.5],
  ],
  'athletico-pr': [
    ['Dudu Kogitzki', 19, 'Brasil', 'MEI', 72, 4.0],
    ['Sorriso', 19, 'Brasil', 'PE', 71, 4.0],
    ['Arthur Dias', 18, 'Brasil', 'ZAG', 71, 4.0],
    ['Lucas Marezi', 18, 'Brasil', 'VOL', 70, 3.5],
    ['Matheus Soares', 18, 'Brasil', 'GOL', 69, 3.5],
  ],
  coritiba: [
    ['Matheus Dias', 18, 'Brasil', 'MC', 70, 3.5],
    ['Ruan Assis', 19, 'Brasil', 'PE', 70, 3.5],
    ['Guilherme Aquino', 18, 'Brasil', 'ZAG', 69, 3.5],
    ['Kauan França', 18, 'Brasil', 'ATA', 69, 3.5],
    ['Henrique Melo', 18, 'Brasil', 'LD', 68, 3.5],
  ],
  vitoria: [
    ['Lawan', 19, 'Brasil', 'ATA', 71, 4.0],
    ['Fábio Soares', 19, 'Brasil', 'PE', 70, 3.5],
    ['Kauan Vitor', 18, 'Brasil', 'MEI', 70, 3.5],
    ['Andrei', 18, 'Brasil', 'ZAG', 69, 3.5],
    ['Davi Barbosa', 18, 'Brasil', 'GOL', 68, 3.5],
  ],
  mirassol: [
    ['Léo Lopes', 19, 'Brasil', 'ATA', 69, 3.5],
    ['Kauan Santana', 18, 'Brasil', 'MEI', 69, 3.5],
    ['Gabriel Tota', 19, 'Brasil', 'MC', 68, 3.5],
    ['Matheus Oliveira', 18, 'Brasil', 'ZAG', 68, 3.5],
    ['Pedro Henrique', 18, 'Brasil', 'LE', 67, 3.5],
  ],
  chapecoense: [
    ['Cacá', 19, 'Brasil', 'PE', 69, 3.5],
    ['Mailson', 19, 'Brasil', 'ATA', 69, 3.5],
    ['Bruno Vianna', 18, 'Brasil', 'MC', 68, 3.5],
    ['Kauan', 18, 'Brasil', 'ZAG', 68, 3.5],
    ['Vitor Hugo', 18, 'Brasil', 'GOL', 67, 3.5],
  ],
  remo: [
    ['Kauan', 19, 'Brasil', 'MC', 69, 3.5],
    ['Guty', 19, 'Brasil', 'LD', 68, 3.5],
    ['Tico', 18, 'Brasil', 'PE', 68, 3.5],
    ['Pedro Sena', 18, 'Brasil', 'ATA', 68, 3.5],
    ['Jonilson', 19, 'Brasil', 'VOL', 67, 3.5],
  ],

  // =========================================================================
  // DESTAQUES SÉRIE B (FORTALEZA, SPORT, CEARÁ, JUVENTUDE, GOIÁS, AMÉRICA-MG, ETC.)
  // =========================================================================
  fortaleza: [
    ['Kervin Andrade', 19, 'Venezuela', 'MEI', 73, 4.5],
    ['Kauê Canela', 18, 'Brasil', 'ATA', 70, 4.0],
    ['Lucca Prior', 19, 'Brasil', 'MEI', 70, 3.5],
    ['Amorim', 19, 'Brasil', 'MC', 69, 3.5],
    ['Geilson Souza', 18, 'Brasil', 'ZAG', 68, 3.5],
  ],
  sport: [
    ['Zé Lucas', 17, 'Brasil', 'VOL', 72, 4.5],
    ['Pedro Lima', 18, 'Brasil', 'LD', 71, 4.0],
    ['Dieguinho', 18, 'Brasil', 'PE', 70, 3.5],
    ['Micael', 19, 'Brasil', 'ATA', 69, 3.5],
    ['Kauan', 18, 'Brasil', 'ZAG', 68, 3.5],
  ],
  ceara: [
    ['João Gabriel', 18, 'Brasil', 'ATA', 70, 4.0],
    ['Caio Rafael', 19, 'Brasil', 'MEI', 70, 3.5],
    ['Melk', 18, 'Brasil', 'PE', 69, 3.5],
    ['Zé Neto', 19, 'Brasil', 'ZAG', 68, 3.5],
    ['Léo Agliardi', 18, 'Brasil', 'GOL', 67, 3.5],
  ],

  // =========================================================================
  // GIGANTES EUROPEUS & 6 LIGAS EUROPEIAS (SETEMBRO DE 2026)
  // =========================================================================
  'real-madrid': [
    ['Joan Martínez', 18, 'Espanha', 'ZAG', 75, 4.5],
    ['Jesús Fortea', 19, 'Espanha', 'LD', 74, 4.5],
    ['Daniel Yáñez', 18, 'Espanha', 'PD', 73, 4.5],
    ['Diego Aguado', 18, 'Espanha', 'ZAG', 73, 4.0],
    ['Thiago Pitarch', 18, 'Espanha', 'MC', 73, 4.0],
  ],
  barcelona: [
    ['Marc Bernal', 19, 'Espanha', 'VOL', 77, 4.5],
    ['Toni Fernández', 17, 'Espanha', 'MEI', 75, 4.5],
    ['Guille Fernández', 18, 'Espanha', 'MC', 75, 4.5],
    ['Héctor Fort', 19, 'Espanha', 'LD', 75, 4.0],
    ['Baba Kourouma', 16, 'Espanha', 'ZAG', 73, 4.5],
  ],
  'atletico-madrid': [
    ['Taufik Seidu', 17, 'Espanha', 'MC', 73, 4.5],
    ['Omar Janneh', 19, 'Espanha', 'ATA', 73, 4.0],
    ['Gerónimo Spina', 19, 'Argentina', 'ZAG', 73, 4.0],
    ['Rayane Belaid', 19, 'Espanha', 'MEI', 73, 4.0],
    ['Jano Monserrate', 19, 'Espanha', 'MEI', 72, 4.0],
  ],
  'man-city': [
    ['Divine Mukasa', 18, 'Inglaterra', 'MEI', 74, 4.5],
    ['Stephen Mfuni', 18, 'Inglaterra', 'ZAG', 73, 4.5],
    ['Ryan McAidoo', 17, 'Inglaterra', 'PD', 73, 4.5],
    ['Reigan Heskey', 18, 'Inglaterra', 'PE', 73, 4.0],
    ['Charlie Gray', 19, 'Inglaterra', 'VOL', 72, 4.0],
  ],
  liverpool: [
    ['Rio Ngumoha', 17, 'Inglaterra', 'PE', 76, 5.0],
    ['Trey Nyoni', 18, 'Inglaterra', 'MC', 75, 4.5],
    ['Jayden Danns', 19, 'Inglaterra', 'ATA', 74, 4.0],
    ['Amara Nallo', 19, 'Inglaterra', 'ZAG', 72, 4.0],
    ['Kornel Misciur', 18, 'Polônia', 'GOL', 71, 4.0],
  ],
  arsenal: [
    ['Max Dowman', 16, 'Inglaterra', 'MEI', 75, 5.0],
    ['Marli Salmon', 16, 'Inglaterra', 'ZAG', 73, 4.5],
    ['Tommy Setford', 19, 'Inglaterra', 'GOL', 73, 4.0],
    ['Andre Harriman-Annous', 18, 'Inglaterra', 'ATA', 72, 4.0],
    ['Jack Porter', 17, 'Inglaterra', 'GOL', 71, 4.0],
  ],
  chelsea: [
    ['Shumaira Mheuka', 18, 'Inglaterra', 'ATA', 74, 4.5],
    ['Reggie Walsh', 17, 'Inglaterra', 'MC', 73, 4.5],
    ['Ryan Kavuma-McQueen', 17, 'Inglaterra', 'PE', 73, 4.5],
    ['Genesis Antwi', 18, 'Suécia', 'LD', 73, 4.0],
    ['Harrison Murray-Campbell', 19, 'Inglaterra', 'ZAG', 72, 4.0],
  ],
  bayern: [
    ['Lennart Karl', 18, 'Alemanha', 'MEI', 76, 5.0],
    ['Wisdom Mike', 17, 'Alemanha', 'PE', 74, 4.5],
    ['Cassiano Kiala', 17, 'Alemanha', 'ZAG', 73, 4.5],
    ['Jonah Kusi-Asare', 18, 'Suécia', 'ATA', 73, 4.0],
    ['Javier Fernández', 19, 'Espanha', 'MC', 72, 4.0],
  ],
  'borussia-dortmund': [
    ['Kjell Wätjen', 19, 'Alemanha', 'MC', 74, 4.5],
    ['Samuele Inacio', 17, 'Itália', 'MEI', 73, 4.5],
    ['Mathis Albert', 16, 'EUA', 'PE', 72, 4.5],
    ['Cole Campbell', 19, 'EUA', 'PD', 73, 4.0],
    ['Almugera Kabar', 19, 'Alemanha', 'LE', 73, 4.0],
  ],
  'bayer-leverkusen': [
    ['Francis Onyeka', 18, 'Alemanha', 'MEI', 73, 4.5],
    ['Kerim Alajbegović', 18, 'Bósnia', 'PE', 73, 4.5],
    ['Artem Stepanov', 18, 'Ucrânia', 'ATA', 73, 4.0],
    ['Andrea Natali', 18, 'Itália', 'ZAG', 72, 4.0],
    ['Ben Hawighorst', 17, 'Alemanha', 'ZAG', 71, 4.0],
  ],
  psg: [
    ['Senny Mayulu', 19, 'França', 'MC', 76, 4.5],
    ['Noham Kamara', 18, 'França', 'ZAG', 73, 4.0],
    ['Yoram Zague', 19, 'França', 'LD', 74, 4.0],
    ['Axel Tape', 18, 'França', 'ZAG', 73, 4.0],
    ['Quentin Ndjantou', 18, 'França', 'PE', 72, 4.0],
  ],
  'inter-milan': [
    ['Francesco Pio Esposito', 19, 'Itália', 'ATA', 75, 4.5],
    ['Matteo Cocchi', 18, 'Itália', 'LE', 73, 4.5],
    ['Giacomo De Pieri', 18, 'Itália', 'PD', 73, 4.5],
    ['Thomas Berenbruch', 19, 'Itália', 'MC', 74, 4.0],
    ['Luka Topalović', 19, 'Eslovênia', 'MEI', 73, 4.0],
  ],
  'ac-milan': [
    ['Francesco Camarda', 18, 'Itália', 'ATA', 75, 5.0],
    ['Mattia Liberali', 18, 'Itália', 'MEI', 74, 4.5],
    ['Kevin Zeroli', 19, 'Itália', 'MC', 74, 4.0],
    ['Davide Bartesaghi', 19, 'Itália', 'LE', 74, 4.0],
    ['Lorenzo Torriani', 19, 'Itália', 'GOL', 73, 4.0],
  ],
  juventus: [
    ['Vasilije Adžić', 19, 'Montenegro', 'MEI', 75, 4.5],
    ['Javier Gil', 19, 'Espanha', 'ZAG', 73, 4.0],
    ['Alfonso Montero', 18, 'Uruguai', 'ZAG', 72, 4.0],
    ['Lorenzo Anghelè', 19, 'Itália', 'ATA', 72, 4.0],
    ['Patryk Mazur', 18, 'Polônia', 'VOL', 72, 4.0],
  ],
  benfica: [
    ['João Rego', 19, 'Portugal', 'MEI', 74, 4.5],
    ['Gonçalo Oliveira', 19, 'Portugal', 'ZAG', 73, 4.5],
    ['João Veloso', 19, 'Portugal', 'MC', 73, 4.0],
    ['Eduardo Fernandes', 18, 'Portugal', 'PE', 72, 4.0],
    ['Diogo Prioste', 19, 'Portugal', 'VOL', 73, 4.0],
  ],
  sporting: [
    ['João Simões', 19, 'Portugal', 'MC', 75, 4.5],
    ['Gabriel Silva', 18, 'Portugal', 'ATA', 73, 4.5],
    ['Rafael Nel', 19, 'Portugal', 'ATA', 73, 4.0],
    ['Alexandre Brito', 19, 'Portugal', 'VOL', 72, 4.0],
    ['Flávio Gonçalves', 18, 'Portugal', 'MEI', 72, 4.0],
  ],
  'fc-porto': [
    ['Gonçalo Sousa', 19, 'Portugal', 'PD', 74, 4.5],
    ['Martim Cunha', 18, 'Portugal', 'LE', 73, 4.0],
    ['André Oliveira', 19, 'Portugal', 'VOL', 73, 4.0],
    ['Tiago Andrade', 19, 'Portugal', 'PE', 73, 4.0],
    ['Gabriel Brás', 19, 'Portugal', 'ZAG', 73, 4.0],
  ],
  'sc-braga': [
    ['João Vasconcelos', 19, 'Portugal', 'MEI', 73, 4.0],
    ['Afonso Patrão', 18, 'Portugal', 'ATA', 72, 4.0],
    ['Jonatás Noro', 19, 'Portugal', 'ZAG', 72, 4.0],
    ['Diego Rodrigues', 19, 'Portugal', 'MC', 71, 4.0],
    ['Rúben Furtado', 18, 'Portugal', 'PE', 71, 4.0],
  ],
  'vitoria-sc': [
    ['José Ribeiro', 18, 'Portugal', 'GOL', 70, 3.5],
    ['Rodrigo Duarte', 18, 'Portugal', 'MEI', 71, 4.0],
    ['Diogo Sousa', 19, 'Portugal', 'MC', 71, 4.0],
    ['Noah Saviolo', 19, 'Bélgica', 'PE', 71, 4.0],
    ['Rui Silva Jr.', 18, 'Portugal', 'ZAG', 70, 3.5],
  ],
  tottenham: [
    ['Mikey Moore', 18, 'Inglaterra', 'PE', 76, 4.5],
    ['Luca Williams-Barnett', 17, 'Inglaterra', 'MEI', 73, 4.5],
    ['Will Lankshear', 19, 'Inglaterra', 'ATA', 73, 4.0],
    ['Callum Olusesi', 18, 'Inglaterra', 'MC', 72, 4.0],
    ['Jun\'ai Byfield', 17, 'Inglaterra', 'ZAG', 71, 4.0],
  ],
  'aston-villa': [
    ['Bradley Burrowes', 18, 'Inglaterra', 'PD', 73, 4.5],
    ['Rory Wilson', 19, 'Escócia', 'ATA', 73, 4.0],
    ['Jamaldeen Jimoh-Aloba', 18, 'Inglaterra', 'MEI', 72, 4.0],
    ['Triston Rowe', 18, 'Inglaterra', 'LD', 71, 4.0],
    ['Aidan Borland', 18, 'Escócia', 'MC', 71, 3.5],
  ],
  'newcastle-united': [
    ['Trevan Sanusi', 18, 'Inglaterra', 'PE', 73, 4.5],
    ['Leo Shahar', 18, 'Inglaterra', 'LD', 72, 4.0],
    ['Sean Neave', 18, 'Inglaterra', 'ATA', 72, 4.0],
    ['Travis Hernes', 19, 'Noruega', 'MC', 71, 3.5],
    ['Anthony Munda', 18, 'Inglaterra', 'MC', 71, 3.5],
  ],
  brighton: [
    ['Harry Howell', 17, 'Inglaterra', 'MEI', 73, 4.5],
    ['Freddie Simmonds', 18, 'Inglaterra', 'ZAG', 72, 4.0],
    ['Shane Nti', 18, 'Inglaterra', 'MEI', 71, 4.0],
    ['Charlie Tasker', 18, 'Inglaterra', 'LD', 71, 3.5],
    ['Jacob Slater', 19, 'Inglaterra', 'LE', 71, 3.5],
  ],
  'athletic-bilbao': [
    ['Peio Canales', 19, 'Espanha', 'MEI', 74, 4.5],
    ['Igor Oyono', 17, 'Espanha', 'ATA', 73, 4.5],
    ['Aingeru Olabarrieta', 19, 'Espanha', 'PD', 73, 4.0],
    ['Elijah Gift', 18, 'Espanha', 'PE', 72, 4.0],
    ['Beñat Larrea', 18, 'Espanha', 'ZAG', 71, 4.0],
  ],
  'real-sociedad': [
    ['Jon Martín', 19, 'Espanha', 'ZAG', 74, 4.5],
    ['Dani Díaz', 18, 'Espanha', 'PD', 73, 4.0],
    ['Arkaitz Mariezkurrena', 19, 'Espanha', 'ATA', 73, 4.0],
    ['Alex Marchal', 18, 'Espanha', 'PE', 72, 4.0],
    ['Luken Beitia', 19, 'Espanha', 'ZAG', 72, 3.5],
  ],
  'real-betis': [
    ['Rodrigo Marina', 19, 'Espanha', 'ATA', 73, 4.5],
    ['Pablo García', 18, 'Espanha', 'PD', 73, 4.5],
    ['Mateo Flores', 19, 'Espanha', 'MC', 73, 4.0],
    ['Dani Pérez', 19, 'Espanha', 'MEI', 72, 4.0],
    ['Elyaz Zidane', 19, 'França', 'ZAG', 71, 3.5],
  ],
  villarreal: [
    ['Hugo López', 18, 'Espanha', 'PE', 73, 4.5],
    ['Igor Tovar', 18, 'Espanha', 'MEI', 72, 4.0],
    ['Dani Budesca', 18, 'Espanha', 'LD', 72, 4.0],
    ['Víctor Moreno', 19, 'Espanha', 'PE', 71, 3.5],
    ['Jean Ives Valou', 19, 'Costa do Marfim', 'ZAG', 71, 3.5],
  ],
  sevilla: [
    ['Stanis Idumbo', 19, 'Bélgica', 'MEI', 73, 4.0],
    ['Mateo Mejía', 19, 'Colômbia', 'ATA', 72, 4.0],
    ['Manu Bueno', 19, 'Espanha', 'MC', 72, 4.0],
    ['Ramón Martínez', 19, 'Espanha', 'ZAG', 71, 3.5],
    ['Alexis Ciria', 17, 'Espanha', 'PE', 71, 4.0],
  ],
  valencia: [
    ['David Otorbi', 18, 'Espanha', 'PD', 73, 4.5],
    ['Iker Córdoba', 19, 'Espanha', 'ZAG', 72, 4.0],
    ['Warren Madrigal', 19, 'Costa Rica', 'ATA', 72, 4.0],
    ['Raúl Jiménez', 18, 'Espanha', 'GOL', 71, 4.0],
    ['Lucas Núñez', 18, 'Espanha', 'VOL', 71, 3.5],
  ],
  'rb-leipzig': [
    ['Viggo Gebel', 17, 'Alemanha', 'MEI', 73, 4.5],
    ['Faik Sakar', 17, 'Alemanha', 'MC', 72, 4.0],
    ['Nuha Jatta', 18, 'Alemanha', 'MEI', 72, 4.0],
    ['Winners Osawe', 18, 'Alemanha', 'VOL', 72, 4.0],
    ['Jonathan Norbye', 18, 'Noruega', 'ZAG', 71, 4.0],
  ],
  'eintracht-frankfurt': [
    ['Noah Fenyő', 19, 'Hungria', 'VOL', 72, 4.0],
    ['Anas Alaoui', 19, 'Alemanha', 'ATA', 72, 4.0],
    ['Kaan Inanoglu', 19, 'Turquia', 'ATA', 71, 3.5],
    ['Junior Awusi', 18, 'Espanha', 'ATA', 71, 4.0],
    ['Amil Siljevic', 18, 'Alemanha', 'GOL', 70, 3.5],
  ],
  'vfb-stuttgart': [
    ['Mirza Ćatović', 18, 'Bósnia', 'VOL', 72, 4.0],
    ['Eliot Bujupi', 18, 'Kosovo', 'ATA', 72, 4.0],
    ['Efe Korkut', 18, 'Turquia', 'MC', 71, 4.0],
    ['Lauri Penna', 18, 'Alemanha', 'MEI', 71, 3.5],
    ['Florian Hellstern', 18, 'Alemanha', 'GOL', 70, 3.5],
  ],
  napoli: [
    ['Matija Popović', 19, 'Sérvia', 'MEI', 73, 4.0],
    ['Lorenzo Russo', 19, 'Itália', 'MC', 72, 4.0],
    ['Emmanuele De Chiara', 18, 'Itália', 'VOL', 71, 4.0],
    ['Pasquale Gioielli', 19, 'Itália', 'MEI', 71, 3.5],
    ['Christian Garofalo', 18, 'Itália', 'ZAG', 70, 3.5],
  ],
  'as-roma': [
    ['Mattia Mannini', 19, 'Itália', 'MC', 73, 4.0],
    ['Alessandro Romano', 19, 'Suíça', 'VOL', 72, 4.0],
    ['Federico Nardin', 18, 'Itália', 'ZAG', 72, 4.0],
    ['Sergej Levak', 19, 'Croácia', 'MC', 71, 4.0],
    ['Marco Almaviva', 18, 'Itália', 'ATA', 71, 3.5],
  ],
  atalanta: [
    ['Dominic Vavassori', 19, 'Itália', 'ATA', 73, 4.0],
    ['Relja Obrić', 19, 'Eslovênia', 'ZAG', 72, 4.0],
    ['Lorenzo Riccio', 18, 'Itália', 'MC', 72, 4.0],
    ['Federico Steffanoni', 17, 'Itália', 'MC', 71, 4.0],
    ['Gabriel Ramaj', 18, 'Albânia', 'ZAG', 71, 3.5],
  ],
  fiorentina: [
    ['Tommaso Martinelli', 19, 'Itália', 'GOL', 73, 4.5],
    ['Maat Daniel Caprini', 19, 'Itália', 'ATA', 72, 4.0],
    ['Tommaso Rubino', 18, 'Itália', 'MEI', 72, 4.0],
    ['Jonas Harder', 19, 'Itália', 'MC', 71, 3.5],
    ['Lorenzo Sadotti', 18, 'Itália', 'ZAG', 71, 3.5],
  ],
  'como-1907': [
    ['Fellipe Jack', 19, 'Brasil', 'ZAG', 72, 4.0],
    ['Cristian Mazzara', 18, 'Itália', 'PE', 71, 4.0],
    ['Naj Razi', 18, 'Irlanda', 'MEI', 71, 4.0],
    ['Francesco Andrealli', 18, 'Itália', 'MC', 70, 3.5],
    ['Giuseppe Chinetti', 18, 'Itália', 'ATA', 70, 3.5],
  ],
  'as-monaco': [
    ['Saïmon Bouabré', 19, 'França', 'MEI', 74, 4.5],
    ['Joan Tincres', 18, 'França', 'ATA', 73, 4.5],
    ['Pape Cabral', 18, 'França', 'VOL', 72, 4.0],
    ['Bradel Kiwa', 19, 'França', 'ZAG', 72, 4.0],
    ['Mayssam Benama', 19, 'França', 'MC', 71, 3.5],
  ],
  'olympique-marseille': [
    ['Darryl Bakola', 18, 'França', 'MEI', 73, 4.5],
    ['Keyliane Abdallah', 19, 'França', 'ATA', 72, 4.0],
    ['Gaël Lafont', 19, 'França', 'MC', 72, 4.0],
    ['Yanis Sellami', 18, 'França', 'VOL', 71, 4.0],
    ['Koumba', 18, 'França', 'ZAG', 71, 3.5],
  ],
  'olympique-lyonnais': [
    ['Alejandro Gomes Rodríguez', 18, 'Inglaterra', 'ATA', 73, 4.5],
    ['Enzo Molebe', 18, 'França', 'ATA', 73, 4.5],
    ['Khalis Merah', 18, 'França', 'MEI', 72, 4.0],
    ['Mathys de Carvalho', 19, 'Portugal', 'VOL', 72, 4.0],
    ['Teo Barisic', 19, 'Croácia', 'LD', 71, 3.5],
  ],
  'lille-osc': [
    ['Kemryk Nagera', 18, 'França', 'MEI', 73, 4.5],
    ['Soriba Diaoune', 18, 'França', 'PE', 72, 4.0],
    ['Adeshina Ayodele', 18, 'Nigéria', 'ATA', 72, 4.0],
    ['Maxima Goffi', 18, 'França', 'ZAG', 71, 4.0],
    ['Lilían Baret', 18, 'França', 'MC', 71, 3.5],
  ],
  'stade-rennais': [
    ['Nordan Mukiele', 18, 'França', 'ATA', 72, 4.5],
    ['Joël Coulibaly', 18, 'França', 'PE', 72, 4.0],
    ['Lucas Rosier', 18, 'França', 'MEI', 71, 4.0],
    ['Ayoub Akabou', 18, 'França', 'GOL', 71, 3.5],
    ['Mervin Gbeme', 18, 'França', 'ZAG', 70, 3.5],
  ],
};

export interface CountryYouthNamePool {
  nationality: string;
  firstNames: string[];
  lastNames: string[];
}

export const YOUTH_NAME_POOLS_BY_COUNTRY: Record<string, CountryYouthNamePool> = {
  BRA: {
    nationality: 'Brasil',
    firstNames: [
      'Kauã', 'Rayan', 'Breno', 'Vitor', 'Lorah', 'Estêvão', 'Endrick', 'Ryan',
      'João', 'Lucas', 'Matheus', 'Gabriel', 'Pedro', 'Guilherme', 'Rafael',
      'Caio', 'Arthur', 'Davi', 'Enzo', 'Murilo', 'Yuri', 'Igor', 'Nathan', 'Wesley',
    ],
    lastNames: [
      'Silva', 'Santos', 'Oliveira', 'Ferreira', 'Costa', 'Rodrigues', 'Almeida',
      'Nascimento', 'Lima', 'Araújo', 'Ribeiro', 'Carvalho', 'Gomes', 'Martins',
      'Rocha', 'Barbosa', 'Teixeira', 'Mendes', 'Moreira', 'Cardoso', 'Moura',
    ],
  },
  ING: {
    nationality: 'Inglaterra',
    firstNames: [
      'Archie', 'Ethan', 'Myles', 'Kobie', 'Rio', 'Trey', 'Max', 'Jobe',
      'Liam', 'Harrison', 'Finley', 'Callum', 'Jayden', 'Oliver', 'Leo', 'Jack',
    ],
    lastNames: [
      'Gray', 'Wharton', 'Mainoo', 'Moore', 'Dowman', 'Nyoni', 'Wright', 'Palmer',
      'Walker', 'Hall', 'Colwill', 'Doyle', 'Morton', 'scanlon', 'Ramsay', 'Clarke',
    ],
  },
  ESP: {
    nationality: 'Espanha',
    firstNames: [
      'Pau', 'Marc', 'Fermín', 'Gavi', 'Lamine', 'Joan', 'Héctor', 'Dani',
      'Álex', 'Iker', 'Unai', 'Aitor', 'Mikel', 'Hugo', 'Mateo', 'Pablo',
    ],
    lastNames: [
      'Fernández', 'Martínez', 'García', 'López', 'Navarro', 'Serrano', 'Torres',
      'Ruiz', 'Moreno', 'Jiménez', 'Molina', 'Delgado', 'Ortiz', 'Domínguez',
    ],
  },
  ALE: {
    nationality: 'Alemanha',
    firstNames: [
      'Lennart', 'Paul', 'Kjell', 'Tom', 'Frans', 'Max', 'Noah', 'Finn',
      'Lukas', 'Jonas', 'Elias', 'Leon', 'Tim', 'Moritz', 'Jan', 'Niklas',
    ],
    lastNames: [
      'Wanner', 'Wätjen', 'Bischof', 'Karl', 'Krätzig', 'Ouedraogo', 'Weiper',
      'Gruda', 'Baur', 'Schäfer', 'Becker', 'Hoffmann', 'Richter', 'Wagner',
    ],
  },
  ITA: {
    nationality: 'Itália',
    firstNames: [
      'Francesco', 'Mattia', 'Lorenzo', 'Tommaso', 'Matteo', 'Davide', 'Simone',
      'Filippo', 'Edoardo', 'Giacomo', 'Niccolò', 'Pietro', 'Samuele', 'Luca',
    ],
    lastNames: [
      'Camarda', 'Liberali', 'Pafundi', 'Esposito', 'Kayode', 'Comuzzo', 'Pisilli',
      'Baldanzi', 'Fabbian', 'Raimondo', 'Zeroli', 'Bartesaghi', 'Colombo', 'Ricci',
    ],
  },
  FRA: {
    nationality: 'França',
    firstNames: [
      'Warren', 'Désiré', 'Senny', 'Leny', 'Eli', 'Mathys', 'Ayyoub', 'Rayan',
      'Saïmon', 'Ibrahim', 'Enzo', 'Yoram', 'Lucas', 'Kylian', 'Malo', 'Bradley',
    ],
    lastNames: [
      'Mayulu', 'Bouaddi', 'Kroupi', 'Yoro', 'Doué', 'Bouabré', 'Mbaye',
      'Zague', 'Atangana', 'Jacquet', 'Meïté', 'Bakola', 'Diop', 'Camara',
    ],
  },
  POR: {
    nationality: 'Portugal',
    firstNames: [
      'Geovany', 'Rodrigo', 'João', 'Martim', 'Gonçalo', 'Tiago', 'Diogo',
      'Afonso', 'Gustavo', 'Rafael', 'Tomás', 'Henrique', 'Francisco', 'Vasco',
    ],
    lastNames: [
      'Mora', 'Quenda', 'Simões', 'Rego', 'Fernandes', 'Ribeiro', 'Oliveira',
      'Sousa', 'Veloso', 'Essugo', 'Araújo', 'Inácio', 'Conceição', 'Teixeira',
    ],
  },
};

export function getYouthPoolForClub(
  clubId: string,
  division: ClubDivision
): CountryYouthNamePool {
  if (division === 'PL') return YOUTH_NAME_POOLS_BY_COUNTRY.ING;
  if (division === 'LALIGA') return YOUTH_NAME_POOLS_BY_COUNTRY.ESP;
  if (division === 'BUNDESLIGA') return YOUTH_NAME_POOLS_BY_COUNTRY.ALE;
  if (division === 'SERIE_A_IT') return YOUTH_NAME_POOLS_BY_COUNTRY.ITA;
  if (division === 'LIGUE_1') return YOUTH_NAME_POOLS_BY_COUNTRY.FRA;
  if (division === 'LIGA_PORTUGAL') return YOUTH_NAME_POOLS_BY_COUNTRY.POR;

  if (division === 'UCL') {
    if (['real-madrid', 'barcelona', 'atletico-madrid'].includes(clubId)) {
      return YOUTH_NAME_POOLS_BY_COUNTRY.ESP;
    }
    if (['man-city', 'liverpool', 'arsenal', 'chelsea'].includes(clubId)) {
      return YOUTH_NAME_POOLS_BY_COUNTRY.ING;
    }
    if (['bayern', 'borussia-dortmund', 'bayer-leverkusen'].includes(clubId)) {
      return YOUTH_NAME_POOLS_BY_COUNTRY.ALE;
    }
    if (['inter-milan', 'ac-milan', 'juventus'].includes(clubId)) {
      return YOUTH_NAME_POOLS_BY_COUNTRY.ITA;
    }
    if (['psg'].includes(clubId)) {
      return YOUTH_NAME_POOLS_BY_COUNTRY.FRA;
    }
    if (['benfica', 'sporting'].includes(clubId)) {
      return YOUTH_NAME_POOLS_BY_COUNTRY.POR;
    }
  }

  return YOUTH_NAME_POOLS_BY_COUNTRY.BRA;
}
