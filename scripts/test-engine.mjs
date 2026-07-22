import { Position } from '../src/engine/core.js'
import { Searcher, formatScore, moveToUci } from '../src/engine/search.js'

const s = new Searcher()

const tactics = [
  // mate em 1 e 2 clássicos
  ['mate em 1 (encosto)', '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', ['a1a8']],
  ['mate do corredor', '5rk1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', ['e1e8']],
  ['mate do pastor', 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1', ['f3f7']],
  ['garfo de cavalo ganha dama', 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQ1RK1 b kq - 0 1', null],
  ['captura simples', 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', ['e4d5']],
]

for (const [name, fen, expect] of tactics) {
  const pos = new Position(fen)
  const t = Date.now()
  const r = s.searchPosition(pos, { maxDepth: 6, timeMs: 3000 })
  const best = r.lines[0]
  const uci = moveToUci(best.move)
  const ok = expect ? expect.includes(uci) : true
  console.log(
    `${expect ? (ok ? 'ok   ' : 'FALHA') : 'info '} ${name}: ${uci} ${formatScore(best.score)} ` +
      `prof ${r.depth} ${r.nodes} nós ${Date.now() - t}ms`,
  )
}

// velocidade a partir da posição inicial
console.log('\nDesempenho na posição inicial:')
for (const [depth, time] of [
  [2, 500],
  [3, 1000],
  [4, 2000],
  [5, 3000],
  [6, 5000],
]) {
  const pos = new Position()
  const t = Date.now()
  const r = s.searchPosition(pos, { maxDepth: depth, timeMs: time })
  const ms = Date.now() - t
  console.log(
    `  prof ${depth}: ${moveToUci(r.lines[0].move)} ${formatScore(r.lines[0].score)} ` +
      `${r.nodes} nós ${ms}ms (${Math.round(r.nodes / Math.max(1, ms))}k nps) alcançou ${r.depth}`,
  )
}

console.log('\nAnálise multi-linha (posição inicial, prof 4):')
const pos = new Position()
const t0 = Date.now()
const a = s.analyzePosition(pos, { maxDepth: 4, timeMs: 4000 })
console.log(`  ${a.nodes} nós em ${Date.now() - t0}ms, prof ${a.depth}`)
for (const line of a.lines.slice(0, 5)) {
  console.log(`   ${moveToUci(line.move).padEnd(6)} ${formatScore(line.score).padStart(6)}  ${line.pv.map(moveToUci).join(' ')}`)
}

// partida do motor contra ele mesmo, para caçar lances ilegais / travamentos
console.log('\nMotor contra ele mesmo (40 lances, prof 4):')
const g = new Position()
let moves = 0
const t1 = Date.now()
while (moves < 40) {
  const legal = g.legalMoves()
  if (!legal.length || g.halfmove >= 100) break
  const r = s.searchPosition(g, { maxDepth: 4, timeMs: 400 })
  if (!r.lines.length) break
  g.makeMove(r.lines[0].move)
  moves++
}
console.log(`  ${moves} lances em ${Date.now() - t1}ms, fen final: ${g.fen()}`)
