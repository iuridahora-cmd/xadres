/**
 * Aberturas: nome da linha jogada e um livro curto para o bot variar.
 *
 * Sem livro, o motor repete o mesmo lance sempre que a posição se repete, e
 * toda partida no mesmo nível começa igual. As chaves são a sequência de
 * lances em notação inglesa (a que a chess.js produz), separada por espaço.
 */

const NOMES = {
  e4: 'Abertura do Peão do Rei',
  'e4 e5': 'Jogo Aberto',
  'e4 e5 Nf3': 'Abertura do Cavalo do Rei',
  'e4 e5 Nf3 Nc6': 'Jogo Aberto',
  'e4 e5 Nf3 Nc6 Bb5': 'Abertura Espanhola (Ruy López)',
  'e4 e5 Nf3 Nc6 Bc4': 'Abertura Italiana',
  'e4 e5 Nf3 Nc6 Bc4 Bc5': 'Giuoco Piano',
  'e4 e5 Nf3 Nc6 Bc4 Nf6': 'Defesa dos Dois Cavalos',
  'e4 e5 Nf3 Nc6 d4': 'Gambito Escocês',
  'e4 e5 Nf3 Nf6': 'Defesa Petrov',
  'e4 e5 Nf3 d6': 'Defesa Philidor',
  'e4 e5 Nc3': 'Abertura Vienense',
  'e4 e5 f4': 'Gambito do Rei',
  'e4 e5 Bc4': 'Abertura do Bispo',
  'e4 c5': 'Defesa Siciliana',
  'e4 c5 Nf3': 'Siciliana Aberta',
  'e4 c5 Nf3 d6': 'Siciliana, variante Najdorf/Scheveningen',
  'e4 c5 Nf3 Nc6': 'Siciliana, variante Clássica',
  'e4 c5 Nf3 e6': 'Siciliana, variante Paulsen',
  'e4 c5 Nc3': 'Siciliana Fechada',
  'e4 c5 c3': 'Siciliana, variante Alapin',
  'e4 e6': 'Defesa Francesa',
  'e4 e6 d4 d5': 'Francesa, linha principal',
  'e4 e6 d4 d5 Nc3': 'Francesa, variante Paulsen',
  'e4 e6 d4 d5 e5': 'Francesa, variante do Avanço',
  'e4 e6 d4 d5 exd5': 'Francesa, variante de Troca',
  'e4 c6': 'Defesa Caro-Kann',
  'e4 c6 d4 d5': 'Caro-Kann, linha principal',
  'e4 c6 d4 d5 e5': 'Caro-Kann, variante do Avanço',
  'e4 d5': 'Defesa Escandinava',
  'e4 d6': 'Defesa Pirc',
  'e4 g6': 'Defesa Moderna',
  'e4 Nf6': 'Defesa Alekhine',
  d4: 'Abertura do Peão da Dama',
  'd4 d5': 'Jogo Fechado',
  'd4 d5 c4': 'Gambito da Dama',
  'd4 d5 c4 e6': 'Gambito da Dama Recusado',
  'd4 d5 c4 dxc4': 'Gambito da Dama Aceito',
  'd4 d5 c4 c6': 'Defesa Eslava',
  'd4 d5 Nf3': 'Sistema de Londres / Zukertort',
  'd4 d5 Bf4': 'Sistema de Londres',
  'd4 Nf6': 'Defesa Índia',
  'd4 Nf6 c4': 'Índia, linha principal',
  'd4 Nf6 c4 g6': 'Defesa Índia do Rei',
  'd4 Nf6 c4 e6': 'Índia da Dama / Nimzo-Índia',
  'd4 Nf6 c4 e6 Nc3 Bb4': 'Defesa Nimzo-Índia',
  'd4 Nf6 c4 e6 Nf3 b6': 'Defesa Índia da Dama',
  'd4 Nf6 c4 c5': 'Defesa Benoni',
  'd4 Nf6 Bf4': 'Sistema de Londres',
  'd4 Nf6 Nf3': 'Abertura Índia',
  'd4 f5': 'Defesa Holandesa',
  c4: 'Abertura Inglesa',
  'c4 e5': 'Inglesa, Siciliana invertida',
  'c4 c5': 'Inglesa Simétrica',
  'c4 Nf6': 'Inglesa, defesa Índia',
  Nf3: 'Abertura Réti',
  'Nf3 d5': 'Réti, linha principal',
  'Nf3 Nf6': 'Abertura Réti',
  b3: 'Abertura Larsen',
  g3: 'Abertura Benko',
  f4: 'Abertura Bird',
  Nc3: 'Abertura Dunst',
}

/**
 * Nome da abertura pelo prefixo mais longo que casar.
 * @param {string[]} sans lances em notação inglesa, na ordem
 */
export function nomeDaAbertura(sans) {
  const limite = Math.min(sans.length, 12)
  for (let n = limite; n > 0; n--) {
    const chave = sans.slice(0, n).join(' ')
    if (NOMES[chave]) return { nome: NOMES[chave], lances: n }
  }
  return null
}

/**
 * Livro do bot. Cada chave leva às respostas plausíveis daquela posição.
 * Só vale nos primeiros lances e a escolha é sorteada, então cada partida
 * começa diferente.
 */
const LIVRO = {
  '': ['e4', 'e4', 'd4', 'd4', 'c4', 'Nf3'],
  e4: ['e5', 'c5', 'c5', 'e6', 'c6', 'd5'],
  d4: ['d5', 'Nf6', 'Nf6', 'e6', 'f5'],
  c4: ['e5', 'Nf6', 'c5', 'e6'],
  Nf3: ['d5', 'Nf6', 'c5'],
  'e4 e5': ['Nf3', 'Nf3', 'Nf3', 'Nc3', 'Bc4', 'f4'],
  'e4 e5 Nf3': ['Nc6', 'Nc6', 'Nc6', 'Nf6', 'd6'],
  'e4 e5 Nf3 Nc6': ['Bb5', 'Bc4', 'Bc4', 'd4', 'Nc3'],
  'e4 e5 Nf3 Nc6 Bb5': ['a6', 'a6', 'Nf6', 'f5'],
  'e4 e5 Nf3 Nc6 Bb5 a6': ['Ba4', 'Ba4', 'Bxc6'],
  'e4 e5 Nf3 Nc6 Bc4': ['Bc5', 'Nf6', 'Nf6'],
  'e4 e5 Nf3 Nc6 Bc4 Bc5': ['c3', 'd3', 'b4'],
  'e4 e5 Nf3 Nc6 Bc4 Nf6': ['Ng5', 'd3', 'd4'],
  'e4 e5 Nf3 Nc6 d4': ['exd4'],
  'e4 e5 Nc3': ['Nf6', 'Nc6'],
  'e4 c5': ['Nf3', 'Nf3', 'Nf3', 'Nc3', 'c3'],
  'e4 c5 Nf3': ['d6', 'Nc6', 'e6'],
  'e4 c5 Nf3 d6': ['d4', 'd4', 'Bb5+'],
  'e4 c5 Nf3 Nc6': ['d4', 'd4', 'Bb5'],
  'e4 c5 Nf3 e6': ['d4', 'd4', 'c3'],
  'e4 c5 Nf3 d6 d4': ['cxd4'],
  'e4 c5 Nf3 Nc6 d4': ['cxd4'],
  'e4 e6': ['d4', 'd4', 'd4', 'Nc3'],
  'e4 e6 d4': ['d5'],
  'e4 e6 d4 d5': ['Nc3', 'Nd2', 'e5', 'exd5'],
  'e4 c6': ['d4', 'd4', 'Nc3'],
  'e4 c6 d4': ['d5'],
  'e4 c6 d4 d5': ['Nc3', 'e5', 'exd5'],
  'e4 d5': ['exd5'],
  'e4 d5 exd5': ['Qxd5', 'Nf6'],
  'e4 Nf6': ['e5', 'Nc3'],
  'e4 d6': ['d4', 'Nf3'],
  'e4 g6': ['d4', 'Nf3'],
  'd4 d5': ['c4', 'c4', 'c4', 'Nf3', 'Bf4'],
  'd4 d5 c4': ['e6', 'c6', 'c6', 'dxc4', 'Nf6'],
  'd4 d5 c4 e6': ['Nc3', 'Nf3'],
  'd4 d5 c4 c6': ['Nf3', 'Nc3'],
  'd4 d5 c4 dxc4': ['Nf3', 'e3', 'e4'],
  'd4 Nf6': ['c4', 'c4', 'c4', 'Nf3', 'Bf4'],
  'd4 Nf6 c4': ['e6', 'g6', 'g6', 'c5'],
  'd4 Nf6 c4 e6': ['Nc3', 'Nf3', 'g3'],
  'd4 Nf6 c4 e6 Nc3': ['Bb4', 'd5'],
  'd4 Nf6 c4 g6': ['Nc3', 'Nf3'],
  'd4 Nf6 c4 g6 Nc3': ['Bg7', 'd5'],
  'd4 Nf6 c4 g6 Nc3 Bg7': ['e4', 'Nf3'],
  'd4 f5': ['g3', 'c4', 'Nf3'],
  'c4 e5': ['Nc3', 'g3'],
  'c4 Nf6': ['Nc3', 'd4', 'g3'],
  'c4 c5': ['Nf3', 'Nc3'],
  'Nf3 d5': ['d4', 'g3', 'c4'],
  'Nf3 Nf6': ['c4', 'd4', 'g3'],
}

/**
 * Lance de livro para a posição, ou null.
 * @param {string[]} sans histórico em notação inglesa
 * @param {string[]} legais lances legais em notação inglesa
 * @param {number} maximo até que lance o livro vale
 */
export function lanceDeLivro(sans, legais, maximo = 8, random = Math.random) {
  if (sans.length >= maximo) return null
  const opcoes = LIVRO[sans.join(' ')]
  if (!opcoes) return null
  const validas = opcoes.filter((san) => legais.includes(san))
  if (!validas.length) return null
  return validas[Math.floor(random() * validas.length)]
}
