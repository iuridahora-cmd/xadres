/**
 * Busca: negamax com alfa-beta, aprofundamento iterativo, tabela de
 * transposição, busca de quietude, poda de lance nulo, redução de lances
 * tardios, matadores e heurística de histórico.
 *
 * `searchPosition` devolve TODAS as linhas da raiz com nota, que é o que
 * alimenta os botões "Melhor jogada" e "Jogadas" da interface.
 */

import {
  MAX_MOVES,
  PAWN,
  KING,
  QUEEN,
  typeOf,
  moveFrom,
  moveTo,
  movePromo,
  isCapture,
  isEnPassant,
  see,
  algebraic,
  SEE_VALUES,
} from './core.js'
import { evaluate } from './evaluate.js'

export const MATE_SCORE = 30000
export const MATE_BOUND = MATE_SCORE - 1000
const INF = 50000

const TT_BITS = 20
const TT_SIZE = 1 << TT_BITS
const TT_MASK = TT_SIZE - 1

const FLAG_EXACT = 0
const FLAG_LOWER = 1
const FLAG_UPPER = 2

export class Searcher {
  constructor() {
    this.ttKey = new Int32Array(TT_SIZE)
    this.ttMove = new Int32Array(TT_SIZE)
    this.ttScore = new Int32Array(TT_SIZE)
    this.ttDepth = new Int8Array(TT_SIZE)
    this.ttFlag = new Int8Array(TT_SIZE)
    this.ttUsed = new Uint8Array(TT_SIZE)
    this.killers = new Int32Array(256 * 2)
    this.history = new Int32Array(15 * 128)
    this.nodes = 0
    this.stopped = false
    this.deadline = Infinity
    // heurísticas ligáveis: além de calibrar níveis, permitem comparar a
    // busca com um minimax puro nos testes
    this.opts = {
      quiescence: true,
      nullMove: true,
      futility: true,
      lmr: true,
      checkExtension: true,
      tt: true,
    }
  }

  configure(opts = {}) {
    this.opts = { ...this.opts, ...opts }
  }

  clearTables() {
    this.ttUsed.fill(0)
    this.killers.fill(0)
    this.history.fill(0)
  }

  softClear() {
    this.killers.fill(0)
    for (let i = 0; i < this.history.length; i++) this.history[i] >>= 3
  }

  checkTime() {
    if (this.stopped) return true
    if ((this.nodes & 2047) === 0 && Date.now() > this.deadline) {
      this.stopped = true
    }
    return this.stopped
  }

  /* ---------------------------------------------------------------- */
  /* Ordenação                                                         */
  /* ---------------------------------------------------------------- */

  scoreMove(pos, move, ttMove, ply) {
    if (move === ttMove) return 10_000_000
    const to = moveTo(move)
    const from = moveFrom(move)
    const promo = movePromo(move)
    if (isCapture(move)) {
      const victim = isEnPassant(move) ? PAWN : typeOf(pos.board[to])
      const attacker = typeOf(pos.board[from])
      return 1_000_000 + SEE_VALUES[victim] * 16 - SEE_VALUES[attacker]
    }
    if (promo) return 900_000 + SEE_VALUES[promo]
    if (this.killers[ply * 2] === move) return 800_000
    if (this.killers[ply * 2 + 1] === move) return 799_000
    return this.history[pos.board[from] * 128 + to]
  }

  orderMoves(pos, moves, count, ttMove, ply) {
    const scores = new Int32Array(count)
    for (let i = 0; i < count; i++) scores[i] = this.scoreMove(pos, moves[i], ttMove, ply)
    // ordenação por inserção: listas curtas, ganha do sort genérico
    for (let i = 1; i < count; i++) {
      const m = moves[i]
      const s = scores[i]
      let j = i - 1
      while (j >= 0 && scores[j] < s) {
        moves[j + 1] = moves[j]
        scores[j + 1] = scores[j]
        j--
      }
      moves[j + 1] = m
      scores[j + 1] = s
    }
  }

  /* ---------------------------------------------------------------- */
  /* Busca de quietude                                                 */
  /* ---------------------------------------------------------------- */

  quiescence(pos, alpha, beta, ply) {
    this.nodes++
    if (this.checkTime()) return 0
    if (ply >= 60 || pos.ply >= 118) return evaluate(pos) * (pos.turn === 0 ? 1 : -1)

    const standPat = evaluate(pos) * (pos.turn === 0 ? 1 : -1)
    if (standPat >= beta) return standPat
    if (standPat > alpha) alpha = standPat

    // poda delta: se nem capturando uma dama chega perto de alfa, para
    if (standPat + 1000 < alpha) return alpha

    const count = pos.generateMoves(pos.ply, true)
    const base = pos.ply * MAX_MOVES
    const moves = pos.moveBuf.slice(base, base + count)
    this.orderMoves(pos, moves, count, 0, ply)

    let best = standPat
    for (let i = 0; i < count; i++) {
      const move = moves[i]
      if (isCapture(move) && !isEnPassant(move)) {
        // ignora capturas que perdem material
        if (see(pos, move) < 0) continue
        const victim = SEE_VALUES[typeOf(pos.board[moveTo(move)])]
        if (standPat + victim + 200 < alpha) continue
      }
      if (!pos.makeMove(move)) continue
      const score = -this.quiescence(pos, -beta, -alpha, ply + 1)
      pos.undoMove()
      if (this.stopped) return 0
      if (score > best) best = score
      if (score > alpha) alpha = score
      if (alpha >= beta) break
    }
    return best
  }

  /* ---------------------------------------------------------------- */
  /* Negamax                                                           */
  /* ---------------------------------------------------------------- */

  negamax(pos, depth, alpha, beta, ply, allowNull = true) {
    if (this.checkTime()) return 0
    this.nodes++
    if (pos.ply >= 118) return evaluate(pos) * (pos.turn === 0 ? 1 : -1)

    const inCheck = pos.inCheck()
    if (inCheck && this.opts.checkExtension) depth++ // extensão de xeque

    if (depth <= 0) {
      return this.opts.quiescence
        ? this.quiescence(pos, alpha, beta, ply)
        : evaluate(pos) * (pos.turn === 0 ? 1 : -1)
    }

    if (ply > 0) {
      if (pos.isRepetition() || pos.halfmove >= 100) return 0
      // poda por distância de mate
      const mateAlpha = Math.max(alpha, -MATE_SCORE + ply)
      const mateBeta = Math.min(beta, MATE_SCORE - ply - 1)
      if (mateAlpha >= mateBeta) return mateAlpha
    }

    const isPv = beta - alpha > 1
    const index = (pos.hashLo >>> 0) & TT_MASK
    let ttMove = 0
    if (this.opts.tt && this.ttUsed[index] && this.ttKey[index] === pos.hashHi) {
      ttMove = this.ttMove[index]
      if (!isPv && this.ttDepth[index] >= depth) {
        let score = this.ttScore[index]
        if (score > MATE_BOUND) score -= ply
        else if (score < -MATE_BOUND) score += ply
        const flag = this.ttFlag[index]
        if (flag === FLAG_EXACT) return score
        if (flag === FLAG_LOWER && score >= beta) return score
        if (flag === FLAG_UPPER && score <= alpha) return score
      }
    }

    const staticEval = evaluate(pos) * (pos.turn === 0 ? 1 : -1)

    // poda de futilidade rasa
    if (this.opts.futility && !isPv && !inCheck && depth <= 3 && Math.abs(beta) < MATE_BOUND) {
      const margin = 120 * depth
      if (staticEval - margin >= beta) return staticEval - margin
    }

    // poda de lance nulo
    if (
      this.opts.nullMove &&
      allowNull &&
      !isPv &&
      !inCheck &&
      depth >= 3 &&
      pos.countMaterial() > 0 &&
      staticEval >= beta
    ) {
      const r = 2 + (depth > 6 ? 1 : 0)
      pos.makeNullMove()
      const score = -this.negamax(pos, depth - 1 - r, -beta, -beta + 1, ply + 1, false)
      pos.undoNullMove()
      if (this.stopped) return 0
      if (score >= beta && Math.abs(score) < MATE_BOUND) return beta
    }

    const count = pos.generateMoves(pos.ply)
    const base = pos.ply * MAX_MOVES
    const moves = pos.moveBuf.slice(base, base + count)
    this.orderMoves(pos, moves, count, ttMove, ply)

    let best = -INF
    let bestMove = 0
    let legal = 0
    let flag = FLAG_UPPER
    const originalAlpha = alpha

    for (let i = 0; i < count; i++) {
      const move = moves[i]
      const capture = isCapture(move) || movePromo(move)
      if (!pos.makeMove(move)) continue
      legal++

      let score
      if (legal === 1) {
        score = -this.negamax(pos, depth - 1, -beta, -alpha, ply + 1)
      } else {
        // redução de lances tardios
        let reduction = 0
        if (this.opts.lmr && depth >= 3 && legal > 3 && !capture && !inCheck && !pos.inCheck()) {
          reduction = legal > 6 ? 2 : 1
          if (reduction >= depth) reduction = depth - 1
        }
        score = -this.negamax(pos, depth - 1 - reduction, -alpha - 1, -alpha, ply + 1)
        if (score > alpha && reduction > 0) {
          score = -this.negamax(pos, depth - 1, -alpha - 1, -alpha, ply + 1)
        }
        if (score > alpha && score < beta) {
          score = -this.negamax(pos, depth - 1, -beta, -alpha, ply + 1)
        }
      }
      pos.undoMove()
      if (this.stopped) return 0

      if (score > best) {
        best = score
        bestMove = move
        if (score > alpha) {
          alpha = score
          flag = FLAG_EXACT
          if (alpha >= beta) {
            if (!capture) {
              const k = ply * 2
              if (this.killers[k] !== move) {
                this.killers[k + 1] = this.killers[k]
                this.killers[k] = move
              }
              this.history[pos.board[moveFrom(move)] * 128 + moveTo(move)] += depth * depth
            }
            flag = FLAG_LOWER
            break
          }
        }
      }
    }

    if (legal === 0) {
      return inCheck ? -MATE_SCORE + ply : 0
    }

    let stored = best
    if (stored > MATE_BOUND) stored += ply
    else if (stored < -MATE_BOUND) stored -= ply
    this.ttUsed[index] = 1
    this.ttKey[index] = pos.hashHi
    this.ttMove[index] = bestMove
    this.ttScore[index] = stored
    this.ttDepth[index] = depth
    this.ttFlag[index] = alpha > originalAlpha && flag !== FLAG_LOWER ? FLAG_EXACT : flag

    return best
  }

  /* ---------------------------------------------------------------- */
  /* Raiz                                                              */
  /* ---------------------------------------------------------------- */

  extractPv(pos, firstMove, maxLen = 12) {
    const pv = []
    const made = []
    let move = firstMove
    for (let i = 0; i < maxLen; i++) {
      if (!move) break
      const legal = pos.legalMoves()
      if (!legal.includes(move)) break
      pv.push(move)
      pos.makeMove(move)
      made.push(true)
      const index = (pos.hashLo >>> 0) & TT_MASK
      if (!this.ttUsed[index] || this.ttKey[index] !== pos.hashHi) break
      move = this.ttMove[index]
    }
    for (let i = made.length - 1; i >= 0; i--) pos.undoMove()
    return pv
  }

  /**
   * Aprofundamento iterativo na raiz, pontuando todos os lances legais.
   *
   * @returns {{lines: {move:number, score:number, pv:number[]}[], depth:number, nodes:number, completed:boolean}}
   */
  searchPosition(pos, { maxDepth = 6, timeMs = 2000, onProgress = null } = {}) {
    this.nodes = 0
    this.stopped = false
    this.deadline = Date.now() + timeMs
    this.softClear()

    const rootMoves = pos.legalMoves()
    if (rootMoves.length === 0) {
      return { lines: [], depth: 0, nodes: 0, completed: true }
    }

    let lines = rootMoves.map((move) => ({ move, score: -INF, pv: [move] }))
    let completedDepth = 0

    for (let depth = 1; depth <= maxDepth; depth++) {
      const current = []
      let alpha = -INF
      const beta = INF
      let aborted = false

      for (let i = 0; i < lines.length; i++) {
        const move = lines[i].move
        pos.makeMove(move)
        let score
        if (i === 0) {
          score = -this.negamax(pos, depth - 1, -beta, -alpha, 1)
        } else {
          // janela nula primeiro; só reabre se de fato superar o melhor
          score = -this.negamax(pos, depth - 1, -alpha - 1, -alpha, 1)
          if (score > alpha && !this.stopped) {
            score = -this.negamax(pos, depth - 1, -beta, -alpha, 1)
          }
        }
        pos.undoMove()
        if (this.stopped) {
          aborted = true
          break
        }
        const pv = this.extractPv(pos, move)
        current.push({ move, score, pv: pv.length ? pv : [move] })
        if (score > alpha) alpha = score
      }

      if (aborted) break

      current.sort((a, b) => b.score - a.score)
      lines = current
      completedDepth = depth
      if (onProgress) onProgress({ depth, lines, nodes: this.nodes })

      // mate encontrado: não adianta cavar mais
      if (Math.abs(lines[0].score) > MATE_BOUND) break
      if (Date.now() > this.deadline) break
    }

    return { lines, depth: completedDepth, nodes: this.nodes, completed: !this.stopped }
  }

  /**
   * Pontua todos os lances com janela cheia (sem cortes entre irmãos).
   * Mais lento, porém devolve nota confiável para cada opção: é o que a
   * aba "Jogadas" e a análise da IA usam.
   */
  analyzePosition(pos, { maxDepth = 5, timeMs = 2500 } = {}) {
    this.nodes = 0
    this.stopped = false
    this.deadline = Date.now() + timeMs
    this.softClear()

    const rootMoves = pos.legalMoves()
    if (rootMoves.length === 0) return { lines: [], depth: 0, nodes: 0 }

    let lines = rootMoves.map((move) => ({ move, score: -INF, pv: [move] }))
    let completedDepth = 0

    for (let depth = 1; depth <= maxDepth; depth++) {
      const current = []
      let aborted = false
      for (const line of lines) {
        pos.makeMove(line.move)
        const score = -this.negamax(pos, depth - 1, -INF, INF, 1)
        pos.undoMove()
        if (this.stopped) {
          aborted = true
          break
        }
        const pv = this.extractPv(pos, line.move)
        current.push({ move: line.move, score, pv: pv.length ? pv : [line.move] })
      }
      if (aborted) break
      current.sort((a, b) => b.score - a.score)
      lines = current
      completedDepth = depth
      if (Math.abs(lines[0].score) > MATE_BOUND) break
      if (Date.now() > this.deadline) break
    }

    return { lines, depth: completedDepth, nodes: this.nodes }
  }
}

/** Converte a nota em texto ("+1.4" ou "M3"). */
export function formatScore(score, pov = 1) {
  const s = score * pov
  if (Math.abs(s) > MATE_BOUND) {
    const plies = MATE_SCORE - Math.abs(s)
    const moves = Math.ceil(plies / 2)
    return `${s > 0 ? '' : '-'}M${moves}`
  }
  return `${s > 0 ? '+' : s < 0 ? '' : ''}${(s / 100).toFixed(2)}`
}

export function moveToUci(move) {
  const promo = movePromo(move)
  const letters = ['', 'p', 'n', 'b', 'r', 'q', 'k']
  return algebraic(moveFrom(move)) + algebraic(moveTo(move)) + (promo ? letters[promo] : '')
}
