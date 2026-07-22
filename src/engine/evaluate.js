/**
 * Avaliação da posição, em centipeões, sempre do ponto de vista das brancas.
 *
 * Base: material + tabelas peça/casa interpoladas entre meio-jogo e final
 * (PeSTO), mais termos de estrutura de peões, par de bispos, torres em
 * colunas abertas e abrigo do rei.
 */

import { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, WHITE, BLACK, typeOf, colorOf, onBoard } from './core.js'

// prettier-ignore
const MG_PAWN = [
    0,   0,   0,   0,   0,   0,  0,   0,
   98, 134,  61,  95,  68, 126, 34, -11,
   -6,   7,  26,  31,  65,  56, 25, -20,
  -14,  13,   6,  21,  23,  12, 17, -23,
  -27,  -2,  -5,  12,  17,   6, 10, -25,
  -26,  -4,  -4, -10,   3,   3, 33, -12,
  -35,  -1, -20, -23, -15,  24, 38, -22,
    0,   0,   0,   0,   0,   0,  0,   0,
]
// prettier-ignore
const EG_PAWN = [
    0,   0,   0,   0,   0,   0,   0,   0,
  178, 173, 158, 134, 147, 132, 165, 187,
   94, 100,  85,  67,  56,  53,  82,  84,
   32,  24,  13,   5,  -2,   4,  17,  17,
   13,   9,  -3,  -7,  -7,  -8,   3,  -1,
    4,   7,  -6,   1,   0,  -5,  -1,  -8,
   13,   8,   8,  10,  13,   0,   2,  -7,
    0,   0,   0,   0,   0,   0,   0,   0,
]
// prettier-ignore
const MG_KNIGHT = [
  -167, -89, -34, -49,  61, -97, -15, -107,
   -73, -41,  72,  36,  23,  62,   7,  -17,
   -47,  60,  37,  65,  84, 129,  73,   44,
    -9,  17,  19,  53,  37,  69,  18,   22,
   -13,   4,  16,  13,  28,  19,  21,   -8,
   -23,  -9,  12,  10,  19,  17,  25,  -16,
   -29, -53, -12,  -3,  -1,  18, -14,  -19,
  -105, -21, -58, -33, -17, -28, -19,  -23,
]
// prettier-ignore
const EG_KNIGHT = [
  -58, -38, -13, -28, -31, -27, -63, -99,
  -25,  -8, -25,  -2,  -9, -25, -24, -52,
  -24, -20,  10,   9,  -1,  -9, -19, -41,
  -17,   3,  22,  22,  22,  11,   8, -18,
  -18,  -6,  16,  25,  16,  17,   4, -18,
  -23,  -3,  -1,  15,  10,  -3, -20, -22,
  -42, -20, -10,  -5,  -2, -20, -23, -44,
  -29, -51, -23, -15, -22, -18, -50, -64,
]
// prettier-ignore
const MG_BISHOP = [
  -29,   4, -82, -37, -25, -42,   7,  -8,
  -26,  16, -18, -13,  30,  59,  18, -47,
  -16,  37,  43,  40,  35,  50,  37,  -2,
   -4,   5,  19,  50,  37,  37,   7,  -2,
   -6,  13,  13,  26,  34,  12,  10,   4,
    0,  15,  15,  15,  14,  27,  18,  10,
    4,  15,  16,   0,   7,  21,  33,   1,
  -33,  -3, -14, -21, -13, -12, -39, -21,
]
// prettier-ignore
const EG_BISHOP = [
  -14, -21, -11,  -8,  -7,  -9, -17, -24,
   -8,  -4,   7, -12,  -3, -13,  -4, -14,
    2,  -8,   0,  -1,  -2,   6,   0,   4,
   -3,   9,  12,   9,  14,  10,   3,   2,
   -6,   3,  13,  19,   7,  10,  -3,  -9,
  -12,  -3,   8,  10,  13,   3,  -7, -15,
  -14, -18,  -7,  -1,   4,  -9, -15, -27,
  -23,  -9, -23,  -5,  -9, -16,  -5, -17,
]
// prettier-ignore
const MG_ROOK = [
   32,  42,  32,  51,  63,   9,  31,  43,
   27,  32,  58,  62,  80,  67,  26,  44,
   -5,  19,  26,  36,  17,  45,  61,  16,
  -24, -11,   7,  26,  24,  35,  -8, -20,
  -36, -26, -12,  -1,   9,  -7,   6, -23,
  -45, -25, -16, -17,   3,   0,  -5, -33,
  -44, -16, -20,  -9,  -1,  11,  -6, -71,
  -19, -13,   1,  17,  16,   7, -37, -26,
]
// prettier-ignore
const EG_ROOK = [
  13, 10, 18, 15, 12,  12,   8,   5,
  11, 13, 13, 11, -3,   3,   8,   3,
   7,  7,  7,  5,  4,  -3,  -5,  -3,
   4,  3, 13,  1,  2,   1,  -1,   2,
   3,  5,  8,  4, -5,  -6,  -8, -11,
  -4,  0, -5, -1, -7, -12,  -8, -16,
  -6, -6,  0,  2, -9,  -9, -11,  -3,
  -9,  2,  3, -1, -5, -13,   4, -20,
]
// prettier-ignore
const MG_QUEEN = [
  -28,   0,  29,  12,  59,  44,  43,  45,
  -24, -39,  -5,   1, -16,  57,  28,  54,
  -13, -17,   7,   8,  29,  56,  47,  57,
  -27, -27, -16, -16,  -1,  17,  -2,   1,
   -9, -26,  -9, -10,  -2,  -4,   3,  -3,
  -14,   2, -11,  -2,  -5,   2,  14,   5,
  -35,  -8,  11,   2,   8,  15,  -3,   1,
   -1, -18,  -9,  10, -15, -25, -31, -50,
]
// prettier-ignore
const EG_QUEEN = [
   -9,  22,  22,  27,  27,  19,  10,  20,
  -17,  20,  32,  41,  58,  25,  30,   0,
  -20,   6,   9,  49,  47,  35,  19,   9,
    3,  22,  24,  45,  57,  40,  57,  36,
  -18,  28,  19,  47,  31,  34,  39,  23,
  -16, -27,  15,   6,   9,  17,  10,   5,
  -22, -23, -30, -16, -16, -23, -36, -32,
  -33, -28, -22, -43,  -5, -32, -20, -41,
]
// prettier-ignore
const MG_KING = [
  -65,  23,  16, -15, -56, -34,   2,  13,
   29,  -1, -20,  -7,  -8,  -4, -38, -29,
   -9,  24,   2, -16, -20,   6,  22, -22,
  -17, -20, -12, -27, -30, -25, -14, -36,
  -49,  -1, -27, -39, -46, -44, -33, -51,
  -14, -14, -22, -46, -44, -30, -15, -27,
    1,   7,  -8, -64, -43, -16,   9,   8,
  -15,  36,  12, -54,   8, -28,  24,  14,
]
// prettier-ignore
const EG_KING = [
  -74, -35, -18, -18, -11,  15,   4, -17,
  -12,  17,  14,  17,  17,  38,  23,  11,
   10,  17,  23,  15,  20,  45,  44,  13,
   -8,  22,  24,  27,  26,  33,  26,   3,
  -18,  -4,  21,  24,  27,  23,   9, -11,
  -19,  -3,  11,  21,  23,  16,   7,  -9,
  -27, -11,   4,  13,  14,   4,  -5, -17,
  -53, -34, -21, -11, -28, -14, -24, -43,
]

const MG_TABLES = [null, MG_PAWN, MG_KNIGHT, MG_BISHOP, MG_ROOK, MG_QUEEN, MG_KING]
const EG_TABLES = [null, EG_PAWN, EG_KNIGHT, EG_BISHOP, EG_ROOK, EG_QUEEN, EG_KING]

const MG_VALUE = [0, 82, 337, 365, 477, 1025, 0]
const EG_VALUE = [0, 94, 281, 297, 512, 936, 0]
const PHASE_WEIGHT = [0, 0, 1, 1, 2, 4, 0]
const TOTAL_PHASE = 24

/** Valor "de bolso" das peças, para material e explicações na interface. */
export const PIECE_VALUE = [0, 100, 320, 330, 500, 900, 0]

const PASSED_BONUS_MG = [0, 5, 10, 20, 35, 60, 100, 0]
const PASSED_BONUS_EG = [0, 10, 20, 35, 60, 100, 160, 0]

/**
 * @param {import('./core.js').Position} pos
 * @returns {number} centipeões, positivo = brancas melhor
 */
export function evaluate(pos) {
  const b = pos.board
  let mg = 0
  let eg = 0
  let phase = 0

  // colunas de peões: [cor][coluna] = quantidade, e fileira mais avançada
  const pawnCount = [new Int8Array(8), new Int8Array(8)]
  const pawnRanks = [[], []]
  for (let i = 0; i < 8; i++) {
    pawnRanks[0][i] = []
    pawnRanks[1][i] = []
  }

  let bishops = [0, 0]

  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7
      continue
    }
    const pc = b[sq]
    if (!pc) continue
    const type = typeOf(pc)
    const color = colorOf(pc)
    const file = sq & 15
    const rank = sq >> 4
    const idx = color === WHITE ? rank * 8 + file : (7 - rank) * 8 + file
    const sign = color === WHITE ? 1 : -1

    mg += sign * (MG_VALUE[type] + MG_TABLES[type][idx])
    eg += sign * (EG_VALUE[type] + EG_TABLES[type][idx])
    phase += PHASE_WEIGHT[type]

    if (type === PAWN) {
      pawnCount[color][file]++
      pawnRanks[color][file].push(rank)
    } else if (type === BISHOP) {
      bishops[color]++
    }
  }

  // par de bispos
  if (bishops[WHITE] >= 2) {
    mg += 25
    eg += 45
  }
  if (bishops[BLACK] >= 2) {
    mg -= 25
    eg -= 45
  }

  // estrutura de peões
  for (let color = 0; color < 2; color++) {
    const sign = color === WHITE ? 1 : -1
    const enemy = color ^ 1
    for (let file = 0; file < 8; file++) {
      const count = pawnCount[color][file]
      if (!count) continue
      // dobrados
      if (count > 1) {
        mg -= sign * 12 * (count - 1)
        eg -= sign * 22 * (count - 1)
      }
      // isolados
      const left = file > 0 ? pawnCount[color][file - 1] : 0
      const right = file < 7 ? pawnCount[color][file + 1] : 0
      if (!left && !right) {
        mg -= sign * 16
        eg -= sign * 20
      }
      // passados
      for (const rank of pawnRanks[color][file]) {
        let blocked = false
        for (let f = Math.max(0, file - 1); f <= Math.min(7, file + 1); f++) {
          for (const er of pawnRanks[enemy][f]) {
            if (color === WHITE ? er < rank : er > rank) blocked = true
          }
        }
        if (!blocked) {
          const advance = color === WHITE ? 6 - rank : rank - 1
          const step = Math.max(0, Math.min(7, advance))
          mg += sign * PASSED_BONUS_MG[step]
          eg += sign * PASSED_BONUS_EG[step]
        }
      }
    }
  }

  // torres em coluna aberta ou semiaberta
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7
      continue
    }
    const pc = b[sq]
    if (!pc || typeOf(pc) !== ROOK) continue
    const color = colorOf(pc)
    const sign = color === WHITE ? 1 : -1
    const file = sq & 15
    const own = pawnCount[color][file]
    const foe = pawnCount[color ^ 1][file]
    if (!own && !foe) {
      mg += sign * 25
      eg += sign * 12
    } else if (!own) {
      mg += sign * 12
      eg += sign * 6
    }
  }

  // abrigo do rei (só importa no meio-jogo)
  for (let color = 0; color < 2; color++) {
    const sign = color === WHITE ? 1 : -1
    const ksq = pos.kingSq[color]
    const kf = ksq & 15
    const dir = color === WHITE ? -16 : 16
    let shield = 0
    for (let df = -1; df <= 1; df++) {
      const f = kf + df
      if (f < 0 || f > 7) continue
      const s1 = ksq + dir + df
      const s2 = ksq + dir * 2 + df
      const wantPawn = PAWN | (color << 3)
      if (onBoard(s1) && b[s1] === wantPawn) shield += 12
      else if (onBoard(s2) && b[s2] === wantPawn) shield += 6
      else shield -= 10
    }
    mg += sign * shield
  }

  // mobilidade leve: cavalos e bispos travados perdem pontos
  mg += mobility(pos, WHITE) - mobility(pos, BLACK)

  const ph = Math.min(phase, TOTAL_PHASE)
  const score = (mg * ph + eg * (TOTAL_PHASE - ph)) / TOTAL_PHASE

  // empate técnico por material insuficiente
  if (isDrawnMaterial(pos)) return 0

  return Math.round(score)
}

const KNIGHT_OFFSETS = [-33, -31, -18, -14, 14, 18, 31, 33]
const BISHOP_OFFSETS = [-17, -15, 15, 17]

function mobility(pos, color) {
  const b = pos.board
  let score = 0
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7
      continue
    }
    const pc = b[sq]
    if (!pc || colorOf(pc) !== color) continue
    const type = typeOf(pc)
    if (type === KNIGHT) {
      let count = 0
      for (let i = 0; i < 8; i++) {
        const t = sq + KNIGHT_OFFSETS[i]
        if (onBoard(t) && (!b[t] || colorOf(b[t]) !== color)) count++
      }
      score += (count - 4) * 4
    } else if (type === BISHOP) {
      let count = 0
      for (let i = 0; i < 4; i++) {
        const d = BISHOP_OFFSETS[i]
        let t = sq + d
        while (onBoard(t)) {
          count++
          if (b[t]) break
          t += d
        }
      }
      score += (count - 6) * 3
    }
  }
  return score
}

export function isDrawnMaterial(pos) {
  const b = pos.board
  let pieces = []
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7
      continue
    }
    const pc = b[sq]
    if (!pc) continue
    const type = typeOf(pc)
    if (type === KING) continue
    if (type === PAWN || type === ROOK || type === QUEEN) return false
    pieces.push(type)
    if (pieces.length > 2) return false
  }
  // rei contra rei, rei e peça menor, ou dois cavalos
  if (pieces.length <= 1) return true
  if (pieces.length === 2 && pieces[0] === KNIGHT && pieces[1] === KNIGHT) return true
  return false
}

/** Material bruto de um lado, em centipeões (sem o rei). */
export function materialOf(pos, color) {
  const b = pos.board
  let total = 0
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7
      continue
    }
    const pc = b[sq]
    if (pc && colorOf(pc) === color) total += PIECE_VALUE[typeOf(pc)]
  }
  return total
}
