import { Position } from '../src/engine/core.js'
import { Searcher, formatScore, moveToUci } from '../src/engine/search.js'
import { materialOf } from '../src/engine/evaluate.js'

const s = new Searcher()

// Posições clássicas do conjunto "Win At Chess"
const wac = [
  ['WAC.001', '2rr3k/pp3pp1/1nnqbN1p/3pN3/2pP4/2P3Q1/PPB4P/R4RK1 w - - 0 1', 'g3g6'],
  ['WAC.002', '8/7p/5k2/5p2/p1p2P2/Pr1pPK2/1P1R3P/8 b - - 0 1', 'b3b2'],
  ['WAC.003', '5rk1/1ppb3p/p1pb4/6q1/3P1p1r/2P1R2P/PP1BQ1P1/5RKN w - - 0 1', 'e3g3'],
  ['WAC.004', 'r1bq2rk/pp3pbp/2p1p1pQ/7P/3P4/2PB1N2/PP3PPP/R3K2R w KQ - 0 1', 'h6h7'],
  ['WAC.005', '5k2/6pp/p1qN4/1p1p4/3P4/2PKP2Q/PP3r2/3R4 b - - 0 1', 'c6c4'],
  ['WAC.006', '7k/p7/1R5K/6r1/6p1/6P1/8/8 w - - 0 1', 'b6b7'],
  ['WAC.007', 'rnbqkb1r/pppp1ppp/8/4P3/6n1/7P/PPPNPPP1/R1BQKBNR b KQkq - 0 1', 'g4e3'],
  ['WAC.008', 'r4q1k/p2bR1rp/2p2Q1N/5p2/5p2/2P5/PP3PPP/R5K1 w - - 0 1', 'e7f7'],
  ['WAC.010', 'r1b1kb1r/3q1ppp/pBp1pn2/8/Np3P2/5B2/PPP3PP/R2Q1RK1 w kq - 0 1', 'f3c6'],
  ['WAC.011', 'r1b2rk1/2q1b1pp/p2ppn2/1p6/4P3/1BN1BP2/PPP3PP/R2Q1RK1 w - - 0 1', 'e3a7'],
]

let acertos = 0
for (const [id, fen, best] of wac) {
  const pos = new Position(fen)
  const t = Date.now()
  const r = s.searchPosition(pos, { maxDepth: 8, timeMs: 3000 })
  const got = moveToUci(r.lines[0].move)
  const ok = got === best
  if (ok) acertos++
  console.log(
    `${ok ? 'ok   ' : 'errou'} ${id}: ${got} (esperado ${best}) ${formatScore(r.lines[0].score)} ` +
      `prof ${r.depth} ${r.nodes} nós ${Date.now() - t}ms`,
  )
}
console.log(`\nTáticas: ${acertos}/${wac.length}\n`)

// Confronto entre profundidades: a busca profunda tem de vencer a rasa
function jogar(depthA, depthB, maxLances = 100) {
  const pos = new Position()
  const sa = new Searcher()
  const sb = new Searcher()
  for (let i = 0; i < maxLances; i++) {
    if (!pos.legalMoves().length) {
      return pos.inCheck() ? (pos.turn === 0 ? 'pretas vencem' : 'brancas vencem') : 'afogamento'
    }
    if (pos.halfmove >= 100) return 'empate por 50 lances'
    const branco = pos.turn === 0
    const searcher = branco ? sa : sb
    const depth = branco ? depthA : depthB
    const r = searcher.searchPosition(pos, { maxDepth: depth, timeMs: 800 })
    pos.makeMove(r.lines[0].move)
  }
  const mat = materialOf(pos, 0) - materialOf(pos, 1)
  return `sem mate em ${maxLances} lances, material brancas ${mat > 0 ? '+' : ''}${mat / 100}`
}

console.log('Profundidade 5 (brancas) x profundidade 1 (pretas):', jogar(5, 1, 70))
console.log('Profundidade 1 (brancas) x profundidade 5 (pretas):', jogar(1, 5, 70))
console.log('Profundidade 4 (brancas) x profundidade 2 (pretas):', jogar(4, 2, 70))
