/**
 * Núcleo do motor de xadrez: tabuleiro 0x88, geração de lances,
 * make/unmake, Zobrist e SEE.
 *
 * Roda igual no navegador (Web Worker) e no Node (scripts de teste),
 * sem depender de nada externo.
 */

export const WHITE = 0
export const BLACK = 1

export const EMPTY = 0
export const PAWN = 1
export const KNIGHT = 2
export const BISHOP = 3
export const ROOK = 4
export const QUEEN = 5
export const KING = 6

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

// peça = tipo | (cor << 3)   → branca 1..6, preta 9..14
export const typeOf = (pc) => pc & 7
export const colorOf = (pc) => pc >> 3

// direitos de roque
export const CASTLE_WK = 1
export const CASTLE_WQ = 2
export const CASTLE_BK = 4
export const CASTLE_BQ = 8

// flags do lance (o lance cabe em um inteiro de 32 bits)
export const F_CAPTURE = 1 << 17
export const F_EP = 1 << 18
export const F_CASTLE = 1 << 19
export const F_DOUBLE = 1 << 20

export const makeMove32 = (from, to, promo, flags) => from | (to << 7) | (promo << 14) | flags
export const moveFrom = (m) => m & 0x7f
export const moveTo = (m) => (m >> 7) & 0x7f
export const movePromo = (m) => (m >> 14) & 7
export const isCapture = (m) => (m & F_CAPTURE) !== 0
export const isEnPassant = (m) => (m & F_EP) !== 0
export const isCastle = (m) => (m & F_CASTLE) !== 0

export const fileOf = (sq) => sq & 15
export const rankOf = (sq) => sq >> 4 // 0 = oitava fileira
export const onBoard = (sq) => (sq & 0x88) === 0
export const sq64 = (sq) => (sq >> 4) * 8 + (sq & 15)

export function algebraic(sq) {
  return String.fromCharCode(97 + (sq & 15)) + (8 - (sq >> 4))
}

export function squareFrom(name) {
  const f = name.charCodeAt(0) - 97
  const r = 8 - Number(name[1])
  return r * 16 + f
}

const KNIGHT_OFFSETS = [-33, -31, -18, -14, 14, 18, 31, 33]
const KING_OFFSETS = [-17, -16, -15, -1, 1, 15, 16, 17]
const BISHOP_OFFSETS = [-17, -15, 15, 17]
const ROOK_OFFSETS = [-16, -1, 1, 16]
const QUEEN_OFFSETS = KING_OFFSETS

const SLIDER_OFFSETS = [null, null, null, BISHOP_OFFSETS, ROOK_OFFSETS, QUEEN_OFFSETS, null]

/* ------------------------------------------------------------------ */
/* Zobrist                                                             */
/* ------------------------------------------------------------------ */

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand32 = (() => {
  const rng = mulberry32(0x5eed1234)
  return () => (rng() * 0x100000000) | 0
})()

const Z_PIECE_LO = new Int32Array(15 * 128)
const Z_PIECE_HI = new Int32Array(15 * 128)
const Z_CASTLE_LO = new Int32Array(16)
const Z_CASTLE_HI = new Int32Array(16)
const Z_EP_LO = new Int32Array(8)
const Z_EP_HI = new Int32Array(8)
const Z_SIDE_LO = rand32()
const Z_SIDE_HI = rand32()

for (let i = 0; i < Z_PIECE_LO.length; i++) {
  Z_PIECE_LO[i] = rand32()
  Z_PIECE_HI[i] = rand32()
}
for (let i = 0; i < 16; i++) {
  Z_CASTLE_LO[i] = rand32()
  Z_CASTLE_HI[i] = rand32()
}
for (let i = 0; i < 8; i++) {
  Z_EP_LO[i] = rand32()
  Z_EP_HI[i] = rand32()
}

/* ------------------------------------------------------------------ */
/* Posição                                                             */
/* ------------------------------------------------------------------ */

const MAX_PLY = 128
const MAX_MOVES = 256

export class Position {
  constructor(fen) {
    this.board = new Int8Array(128)
    this.kingSq = new Int32Array(2)
    this.turn = WHITE
    this.castling = 0
    this.ep = -1
    this.halfmove = 0
    this.fullmove = 1
    this.hashLo = 0
    this.hashHi = 0

    // pilha de desfazer
    this.ply = 0
    this.uCaptured = new Int32Array(MAX_PLY)
    this.uCastling = new Int32Array(MAX_PLY)
    this.uEp = new Int32Array(MAX_PLY)
    this.uHalf = new Int32Array(MAX_PLY)
    this.uHashLo = new Int32Array(MAX_PLY)
    this.uHashHi = new Int32Array(MAX_PLY)
    this.uMove = new Int32Array(MAX_PLY)

    // histórico de hashes para detectar repetição
    this.histLo = new Int32Array(1024)
    this.histHi = new Int32Array(1024)
    this.histCount = 0

    // buffers de lances por ply
    this.moveBuf = new Int32Array(MAX_PLY * MAX_MOVES)

    this.setFen(fen || START_FEN)
  }

  clone() {
    const p = new Position(this.fen())
    p.histCount = this.histCount
    p.histLo.set(this.histLo.subarray(0, this.histCount))
    p.histHi.set(this.histHi.subarray(0, this.histCount))
    return p
  }

  setFen(fen) {
    this.board.fill(0)
    const parts = fen.trim().split(/\s+/)
    const rows = parts[0].split('/')
    for (let r = 0; r < 8; r++) {
      let f = 0
      for (const ch of rows[r]) {
        if (ch >= '1' && ch <= '8') {
          f += Number(ch)
          continue
        }
        const lower = ch.toLowerCase()
        const type =
          lower === 'p' ? PAWN
          : lower === 'n' ? KNIGHT
          : lower === 'b' ? BISHOP
          : lower === 'r' ? ROOK
          : lower === 'q' ? QUEEN
          : KING
        const color = ch === lower ? BLACK : WHITE
        const sq = r * 16 + f
        this.board[sq] = type | (color << 3)
        if (type === KING) this.kingSq[color] = sq
        f++
      }
    }
    this.turn = parts[1] === 'b' ? BLACK : WHITE
    this.castling = 0
    if (parts[2] && parts[2] !== '-') {
      if (parts[2].includes('K')) this.castling |= CASTLE_WK
      if (parts[2].includes('Q')) this.castling |= CASTLE_WQ
      if (parts[2].includes('k')) this.castling |= CASTLE_BK
      if (parts[2].includes('q')) this.castling |= CASTLE_BQ
    }
    this.ep = parts[3] && parts[3] !== '-' ? squareFrom(parts[3]) : -1
    this.halfmove = parts[4] ? Number(parts[4]) : 0
    this.fullmove = parts[5] ? Number(parts[5]) : 1
    this.ply = 0
    this.histCount = 0
    this.computeHash()
    this.histLo[this.histCount] = this.hashLo
    this.histHi[this.histCount] = this.hashHi
    this.histCount++
  }

  fen() {
    let out = ''
    for (let r = 0; r < 8; r++) {
      let empty = 0
      for (let f = 0; f < 8; f++) {
        const pc = this.board[r * 16 + f]
        if (!pc) {
          empty++
          continue
        }
        if (empty) {
          out += empty
          empty = 0
        }
        const letters = ['', 'p', 'n', 'b', 'r', 'q', 'k']
        const ch = letters[typeOf(pc)]
        out += colorOf(pc) === WHITE ? ch.toUpperCase() : ch
      }
      if (empty) out += empty
      if (r < 7) out += '/'
    }
    let castle = ''
    if (this.castling & CASTLE_WK) castle += 'K'
    if (this.castling & CASTLE_WQ) castle += 'Q'
    if (this.castling & CASTLE_BK) castle += 'k'
    if (this.castling & CASTLE_BQ) castle += 'q'
    return [
      out,
      this.turn === WHITE ? 'w' : 'b',
      castle || '-',
      this.ep >= 0 ? algebraic(this.ep) : '-',
      this.halfmove,
      this.fullmove,
    ].join(' ')
  }

  computeHash() {
    let lo = 0
    let hi = 0
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) continue
      const pc = this.board[sq]
      if (!pc) continue
      lo ^= Z_PIECE_LO[pc * 128 + sq]
      hi ^= Z_PIECE_HI[pc * 128 + sq]
    }
    lo ^= Z_CASTLE_LO[this.castling]
    hi ^= Z_CASTLE_HI[this.castling]
    if (this.ep >= 0) {
      lo ^= Z_EP_LO[fileOf(this.ep)]
      hi ^= Z_EP_HI[fileOf(this.ep)]
    }
    if (this.turn === BLACK) {
      lo ^= Z_SIDE_LO
      hi ^= Z_SIDE_HI
    }
    this.hashLo = lo
    this.hashHi = hi
  }

  /* ---------------------------------------------------------------- */

  isSquareAttacked(sq, byColor) {
    const b = this.board
    // peões
    if (byColor === WHITE) {
      const a = sq + 15
      const c = sq + 17
      if (onBoard(a) && b[a] === (PAWN | (WHITE << 3))) return true
      if (onBoard(c) && b[c] === (PAWN | (WHITE << 3))) return true
    } else {
      const a = sq - 15
      const c = sq - 17
      if (onBoard(a) && b[a] === (PAWN | (BLACK << 3))) return true
      if (onBoard(c) && b[c] === (PAWN | (BLACK << 3))) return true
    }
    // cavalos
    const knight = KNIGHT | (byColor << 3)
    for (let i = 0; i < 8; i++) {
      const t = sq + KNIGHT_OFFSETS[i]
      if (onBoard(t) && b[t] === knight) return true
    }
    // rei
    const king = KING | (byColor << 3)
    for (let i = 0; i < 8; i++) {
      const t = sq + KING_OFFSETS[i]
      if (onBoard(t) && b[t] === king) return true
    }
    // bispo / dama nas diagonais
    for (let i = 0; i < 4; i++) {
      const d = BISHOP_OFFSETS[i]
      let t = sq + d
      while (onBoard(t)) {
        const pc = b[t]
        if (pc) {
          if (colorOf(pc) === byColor) {
            const ty = typeOf(pc)
            if (ty === BISHOP || ty === QUEEN) return true
          }
          break
        }
        t += d
      }
    }
    // torre / dama nas linhas
    for (let i = 0; i < 4; i++) {
      const d = ROOK_OFFSETS[i]
      let t = sq + d
      while (onBoard(t)) {
        const pc = b[t]
        if (pc) {
          if (colorOf(pc) === byColor) {
            const ty = typeOf(pc)
            if (ty === ROOK || ty === QUEEN) return true
          }
          break
        }
        t += d
      }
    }
    return false
  }

  inCheck(color = this.turn) {
    return this.isSquareAttacked(this.kingSq[color], color ^ 1)
  }

  /**
   * Gera lances pseudo-legais no buffer do ply informado.
   * Retorna a quantidade gerada. `capturesOnly` serve à busca de quietude.
   */
  generateMoves(ply, capturesOnly = false) {
    const b = this.board
    const us = this.turn
    const them = us ^ 1
    const base = ply * MAX_MOVES
    const buf = this.moveBuf
    let n = 0

    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7
        continue
      }
      const pc = b[sq]
      if (!pc || colorOf(pc) !== us) continue
      const type = typeOf(pc)

      if (type === PAWN) {
        const dir = us === WHITE ? -16 : 16
        const startRank = us === WHITE ? 6 : 1
        const promoRank = us === WHITE ? 0 : 7
        const one = sq + dir
        if (!capturesOnly && onBoard(one) && !b[one]) {
          if (rankOf(one) === promoRank) {
            for (let p = QUEEN; p >= KNIGHT; p--) buf[base + n++] = makeMove32(sq, one, p, 0)
          } else {
            buf[base + n++] = makeMove32(sq, one, 0, 0)
            const two = sq + dir * 2
            if (rankOf(sq) === startRank && !b[two]) {
              buf[base + n++] = makeMove32(sq, two, 0, F_DOUBLE)
            }
          }
        } else if (capturesOnly && onBoard(one) && !b[one] && rankOf(one) === promoRank) {
          // promoção sem captura conta como lance "barulhento"
          buf[base + n++] = makeMove32(sq, one, QUEEN, 0)
        }
        for (const d of [dir - 1, dir + 1]) {
          const t = sq + d
          if (!onBoard(t)) continue
          const target = b[t]
          if (target && colorOf(target) === them) {
            if (rankOf(t) === promoRank) {
              for (let p = QUEEN; p >= KNIGHT; p--) buf[base + n++] = makeMove32(sq, t, p, F_CAPTURE)
            } else {
              buf[base + n++] = makeMove32(sq, t, 0, F_CAPTURE)
            }
          } else if (!target && t === this.ep) {
            buf[base + n++] = makeMove32(sq, t, 0, F_CAPTURE | F_EP)
          }
        }
        continue
      }

      if (type === KNIGHT || type === KING) {
        const offsets = type === KNIGHT ? KNIGHT_OFFSETS : KING_OFFSETS
        for (let i = 0; i < 8; i++) {
          const t = sq + offsets[i]
          if (!onBoard(t)) continue
          const target = b[t]
          if (!target) {
            if (!capturesOnly) buf[base + n++] = makeMove32(sq, t, 0, 0)
          } else if (colorOf(target) === them) {
            buf[base + n++] = makeMove32(sq, t, 0, F_CAPTURE)
          }
        }
      } else {
        const offsets = SLIDER_OFFSETS[type]
        for (let i = 0; i < offsets.length; i++) {
          const d = offsets[i]
          let t = sq + d
          while (onBoard(t)) {
            const target = b[t]
            if (!target) {
              if (!capturesOnly) buf[base + n++] = makeMove32(sq, t, 0, 0)
            } else {
              if (colorOf(target) === them) buf[base + n++] = makeMove32(sq, t, 0, F_CAPTURE)
              break
            }
            t += d
          }
        }
      }
    }

    // roques
    if (!capturesOnly) {
      const kingSq = this.kingSq[us]
      if (us === WHITE) {
        if (
          this.castling & CASTLE_WK &&
          !b[squareFrom('f1')] &&
          !b[squareFrom('g1')] &&
          !this.isSquareAttacked(squareFrom('e1'), BLACK) &&
          !this.isSquareAttacked(squareFrom('f1'), BLACK) &&
          !this.isSquareAttacked(squareFrom('g1'), BLACK)
        ) {
          buf[base + n++] = makeMove32(kingSq, squareFrom('g1'), 0, F_CASTLE)
        }
        if (
          this.castling & CASTLE_WQ &&
          !b[squareFrom('d1')] &&
          !b[squareFrom('c1')] &&
          !b[squareFrom('b1')] &&
          !this.isSquareAttacked(squareFrom('e1'), BLACK) &&
          !this.isSquareAttacked(squareFrom('d1'), BLACK) &&
          !this.isSquareAttacked(squareFrom('c1'), BLACK)
        ) {
          buf[base + n++] = makeMove32(kingSq, squareFrom('c1'), 0, F_CASTLE)
        }
      } else {
        if (
          this.castling & CASTLE_BK &&
          !b[squareFrom('f8')] &&
          !b[squareFrom('g8')] &&
          !this.isSquareAttacked(squareFrom('e8'), WHITE) &&
          !this.isSquareAttacked(squareFrom('f8'), WHITE) &&
          !this.isSquareAttacked(squareFrom('g8'), WHITE)
        ) {
          buf[base + n++] = makeMove32(kingSq, squareFrom('g8'), 0, F_CASTLE)
        }
        if (
          this.castling & CASTLE_BQ &&
          !b[squareFrom('d8')] &&
          !b[squareFrom('c8')] &&
          !b[squareFrom('b8')] &&
          !this.isSquareAttacked(squareFrom('e8'), WHITE) &&
          !this.isSquareAttacked(squareFrom('d8'), WHITE) &&
          !this.isSquareAttacked(squareFrom('c8'), WHITE)
        ) {
          buf[base + n++] = makeMove32(kingSq, squareFrom('c8'), 0, F_CASTLE)
        }
      }
    }

    return n
  }

  /** Lista de lances legais como inteiros (usada fora da busca). */
  legalMoves() {
    const ply = this.ply
    const n = this.generateMoves(ply)
    const base = ply * MAX_MOVES
    const out = []
    for (let i = 0; i < n; i++) {
      const m = this.moveBuf[base + i]
      if (this.makeMove(m)) {
        out.push(m)
        this.undoMove()
      }
    }
    return out
  }

  _xorPiece(pc, sq) {
    this.hashLo ^= Z_PIECE_LO[pc * 128 + sq]
    this.hashHi ^= Z_PIECE_HI[pc * 128 + sq]
  }

  /**
   * Executa o lance. Retorna false (e desfaz) se deixar o próprio rei em xeque.
   */
  makeMove(move) {
    const b = this.board
    const us = this.turn
    const them = us ^ 1
    const from = moveFrom(move)
    const to = moveTo(move)
    const promo = movePromo(move)
    const piece = b[from]
    const ply = this.ply

    this.uCastling[ply] = this.castling
    this.uEp[ply] = this.ep
    this.uHalf[ply] = this.halfmove
    this.uHashLo[ply] = this.hashLo
    this.uHashHi[ply] = this.hashHi
    this.uMove[ply] = move

    // limpa hash de roque e en passant antigos
    this.hashLo ^= Z_CASTLE_LO[this.castling]
    this.hashHi ^= Z_CASTLE_HI[this.castling]
    if (this.ep >= 0) {
      this.hashLo ^= Z_EP_LO[fileOf(this.ep)]
      this.hashHi ^= Z_EP_HI[fileOf(this.ep)]
    }

    let captured = 0
    let capturedSq = to
    if (move & F_EP) {
      capturedSq = us === WHITE ? to + 16 : to - 16
      captured = b[capturedSq]
      b[capturedSq] = 0
      this._xorPiece(captured, capturedSq)
    } else if (b[to]) {
      captured = b[to]
      this._xorPiece(captured, to)
    }
    this.uCaptured[ply] = captured

    // move a peça
    b[from] = 0
    this._xorPiece(piece, from)
    const placed = promo ? promo | (us << 3) : piece
    b[to] = placed
    this._xorPiece(placed, to)

    if (typeOf(piece) === KING) this.kingSq[us] = to

    // torre do roque
    if (move & F_CASTLE) {
      let rookFrom
      let rookTo
      if (to === squareFrom('g1')) {
        rookFrom = squareFrom('h1')
        rookTo = squareFrom('f1')
      } else if (to === squareFrom('c1')) {
        rookFrom = squareFrom('a1')
        rookTo = squareFrom('d1')
      } else if (to === squareFrom('g8')) {
        rookFrom = squareFrom('h8')
        rookTo = squareFrom('f8')
      } else {
        rookFrom = squareFrom('a8')
        rookTo = squareFrom('d8')
      }
      const rook = b[rookFrom]
      b[rookFrom] = 0
      b[rookTo] = rook
      this._xorPiece(rook, rookFrom)
      this._xorPiece(rook, rookTo)
    }

    // atualiza direitos de roque
    const type = typeOf(piece)
    if (type === KING) {
      this.castling &= us === WHITE ? ~(CASTLE_WK | CASTLE_WQ) : ~(CASTLE_BK | CASTLE_BQ)
    }
    if (from === squareFrom('a1') || to === squareFrom('a1')) this.castling &= ~CASTLE_WQ
    if (from === squareFrom('h1') || to === squareFrom('h1')) this.castling &= ~CASTLE_WK
    if (from === squareFrom('a8') || to === squareFrom('a8')) this.castling &= ~CASTLE_BQ
    if (from === squareFrom('h8') || to === squareFrom('h8')) this.castling &= ~CASTLE_BK

    // en passant novo
    this.ep = move & F_DOUBLE ? (us === WHITE ? to + 16 : to - 16) : -1

    this.hashLo ^= Z_CASTLE_LO[this.castling]
    this.hashHi ^= Z_CASTLE_HI[this.castling]
    if (this.ep >= 0) {
      this.hashLo ^= Z_EP_LO[fileOf(this.ep)]
      this.hashHi ^= Z_EP_HI[fileOf(this.ep)]
    }

    this.halfmove = captured || type === PAWN ? 0 : this.halfmove + 1
    if (us === BLACK) this.fullmove++
    this.turn = them
    this.hashLo ^= Z_SIDE_LO
    this.hashHi ^= Z_SIDE_HI
    this.ply++

    if (this.isSquareAttacked(this.kingSq[us], them)) {
      this.undoMove()
      return false
    }

    this.histLo[this.histCount] = this.hashLo
    this.histHi[this.histCount] = this.hashHi
    this.histCount++
    return true
  }

  undoMove() {
    const b = this.board
    this.ply--
    const ply = this.ply
    const move = this.uMove[ply]
    const from = moveFrom(move)
    const to = moveTo(move)
    const promo = movePromo(move)
    const them = this.turn
    const us = them ^ 1

    if (this.histCount > 0) {
      // só remove do histórico se o lance chegou a ser aceito
      if (this.histLo[this.histCount - 1] === this.hashLo && this.histHi[this.histCount - 1] === this.hashHi) {
        this.histCount--
      }
    }

    const moved = promo ? PAWN | (us << 3) : b[to]
    b[from] = moved
    b[to] = 0

    if (typeOf(moved) === KING) this.kingSq[us] = from

    const captured = this.uCaptured[ply]
    if (captured) {
      if (move & F_EP) {
        const capSq = us === WHITE ? to + 16 : to - 16
        b[capSq] = captured
      } else {
        b[to] = captured
      }
    }

    if (move & F_CASTLE) {
      let rookFrom
      let rookTo
      if (to === squareFrom('g1')) {
        rookFrom = squareFrom('h1')
        rookTo = squareFrom('f1')
      } else if (to === squareFrom('c1')) {
        rookFrom = squareFrom('a1')
        rookTo = squareFrom('d1')
      } else if (to === squareFrom('g8')) {
        rookFrom = squareFrom('h8')
        rookTo = squareFrom('f8')
      } else {
        rookFrom = squareFrom('a8')
        rookTo = squareFrom('d8')
      }
      b[rookFrom] = b[rookTo]
      b[rookTo] = 0
    }

    this.castling = this.uCastling[ply]
    this.ep = this.uEp[ply]
    this.halfmove = this.uHalf[ply]
    this.hashLo = this.uHashLo[ply]
    this.hashHi = this.uHashHi[ply]
    if (us === BLACK) this.fullmove--
    this.turn = us
  }

  /** Lance nulo: passa a vez (usado na poda de lance nulo e na detecção de ameaças). */
  makeNullMove() {
    const ply = this.ply
    this.uCastling[ply] = this.castling
    this.uEp[ply] = this.ep
    this.uHalf[ply] = this.halfmove
    this.uHashLo[ply] = this.hashLo
    this.uHashHi[ply] = this.hashHi
    this.uMove[ply] = 0
    this.uCaptured[ply] = 0
    if (this.ep >= 0) {
      this.hashLo ^= Z_EP_LO[fileOf(this.ep)]
      this.hashHi ^= Z_EP_HI[fileOf(this.ep)]
    }
    this.ep = -1
    this.turn ^= 1
    this.hashLo ^= Z_SIDE_LO
    this.hashHi ^= Z_SIDE_HI
    this.ply++
  }

  undoNullMove() {
    this.ply--
    const ply = this.ply
    this.castling = this.uCastling[ply]
    this.ep = this.uEp[ply]
    this.halfmove = this.uHalf[ply]
    this.hashLo = this.uHashLo[ply]
    this.hashHi = this.uHashHi[ply]
    this.turn ^= 1
  }

  isRepetition() {
    let count = 0
    const stop = Math.max(0, this.histCount - 1 - this.halfmove)
    for (let i = this.histCount - 3; i >= stop; i -= 2) {
      if (this.histLo[i] === this.hashLo && this.histHi[i] === this.hashHi) {
        count++
        if (count >= 1) return true
      }
    }
    return false
  }

  hasLegalMove() {
    const n = this.generateMoves(this.ply)
    const base = this.ply * MAX_MOVES
    for (let i = 0; i < n; i++) {
      if (this.makeMove(this.moveBuf[base + i])) {
        this.undoMove()
        return true
      }
    }
    return false
  }

  countMaterial() {
    let total = 0
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7
        continue
      }
      const pc = this.board[sq]
      if (pc && typeOf(pc) !== KING && typeOf(pc) !== PAWN) total++
    }
    return total
  }
}

/* ------------------------------------------------------------------ */
/* SEE (troca estática na casa de destino)                             */
/* ------------------------------------------------------------------ */

const SEE_VALUES = [0, 100, 320, 330, 500, 900, 20000]

function smallestAttacker(pos, sq, color) {
  const b = pos.board
  // peão
  if (color === WHITE) {
    for (const d of [15, 17]) {
      const t = sq + d
      if (onBoard(t) && b[t] === (PAWN | (WHITE << 3))) return t
    }
  } else {
    for (const d of [-15, -17]) {
      const t = sq + d
      if (onBoard(t) && b[t] === (PAWN | (BLACK << 3))) return t
    }
  }
  const knight = KNIGHT | (color << 3)
  for (let i = 0; i < 8; i++) {
    const t = sq + KNIGHT_OFFSETS[i]
    if (onBoard(t) && b[t] === knight) return t
  }
  for (const type of [BISHOP, ROOK, QUEEN]) {
    const offsets = SLIDER_OFFSETS[type]
    const want = type | (color << 3)
    for (let i = 0; i < offsets.length; i++) {
      const d = offsets[i]
      let t = sq + d
      while (onBoard(t)) {
        const pc = b[t]
        if (pc) {
          if (pc === want) return t
          break
        }
        t += d
      }
    }
  }
  const king = KING | (color << 3)
  for (let i = 0; i < 8; i++) {
    const t = sq + KING_OFFSETS[i]
    if (onBoard(t) && b[t] === king) return t
  }
  return -1
}

/**
 * Avaliação estática de troca: quanto o lado que joga ganha (em centipeões)
 * se a sequência de capturas na casa acontecer até o fim.
 */
export function see(pos, move) {
  const to = moveTo(move)
  const from = moveFrom(move)
  const b = pos.board
  const target = (move & F_EP) ? (PAWN | ((pos.turn ^ 1) << 3)) : b[to]
  if (!target) return 0

  const gain = []
  let d = 0
  gain[0] = SEE_VALUES[typeOf(target)]
  let attackerSq = from
  let side = pos.turn
  const removed = []
  let occupiedPiece = b[from]

  // simula removendo peças do tabuleiro
  const capturedSq = (move & F_EP) ? (pos.turn === WHITE ? to + 16 : to - 16) : to
  const savedTargetPiece = b[capturedSq]
  b[capturedSq] = 0

  while (attackerSq >= 0) {
    d++
    gain[d] = SEE_VALUES[typeOf(occupiedPiece)] - gain[d - 1]
    removed.push([attackerSq, occupiedPiece])
    b[attackerSq] = 0
    side ^= 1
    const next = smallestAttacker(pos, to, side)
    if (next < 0) break
    attackerSq = next
    occupiedPiece = b[next]
    if (Math.max(-gain[d - 1], gain[d]) < 0) break
  }

  for (const [sq, pc] of removed) b[sq] = pc
  b[capturedSq] = savedTargetPiece

  while (--d > 0) {
    gain[d - 1] = -Math.max(-gain[d - 1], gain[d])
  }
  return gain[0]
}

export { MAX_MOVES, MAX_PLY, SEE_VALUES }
