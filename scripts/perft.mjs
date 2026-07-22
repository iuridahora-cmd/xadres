import { Position, MAX_MOVES } from '../src/engine/core.js'

function perft(pos, depth) {
  if (depth === 0) return 1
  const ply = pos.ply
  const n = pos.generateMoves(ply)
  const base = ply * MAX_MOVES
  const moves = pos.moveBuf.slice(base, base + n)
  let nodes = 0
  for (let i = 0; i < n; i++) {
    if (pos.makeMove(moves[i])) {
      nodes += perft(pos, depth - 1)
      pos.undoMove()
    }
  }
  return nodes
}

const suites = [
  ['startpos', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902, 197281, 4865609]],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862, 4085603]],
  ['pos3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238, 674624]],
  ['pos4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467, 422333]],
  ['pos5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379, 2103487]],
  ['pos6', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890, 3894594]],
]

let failures = 0
for (const [name, fen, expected] of suites) {
  const pos = new Position(fen)
  for (let d = 1; d <= expected.length; d++) {
    const t = Date.now()
    const got = perft(pos, d)
    const ok = got === expected[d - 1]
    if (!ok) failures++
    const ms = Date.now() - t
    const nps = ms > 0 ? Math.round(got / (ms / 1000) / 1000) : '-'
    console.log(
      `${ok ? 'ok  ' : 'FALHA'} ${name} d${d}: ${got}${ok ? '' : ` (esperado ${expected[d - 1]})`} [${ms}ms, ${nps}k nps]`,
    )
    if (!ok) break
  }
}
console.log(failures === 0 ? '\nTodos os perft bateram.' : `\n${failures} falha(s).`)
process.exit(failures ? 1 : 0)
