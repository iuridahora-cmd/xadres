/**
 * Web Worker do motor. Roda a busca fora da thread da interface, então o
 * tabuleiro continua animando enquanto o bot pensa.
 *
 * Protocolo (sempre com `id` para casar pedido e resposta):
 *   { cmd: 'analisar', id, fen, config }  -> { tipo:'analise', id, linhas, prof, nos }
 *   { cmd: 'jogar',    id, fen, nivel }   -> { tipo:'jogada',  id, escolhida, linhas, prof, nos }
 *   { cmd: 'avaliar',  id, fen }          -> { tipo:'avaliacao', id, nota }
 */

import { Position, see, moveFrom, moveTo, movePromo, algebraic, typeOf, colorOf } from './core.js'
import { Searcher, moveToUci, MATE_SCORE, MATE_BOUND } from './search.js'
import { evaluate, PIECE_VALUE } from './evaluate.js'
import { LEVELS, ANALISE, escolherLance } from './levels.js'

const searcher = new Searcher()

/** Empacota uma linha da busca para a interface (tudo em texto UCI). */
function empacotar(pos, linha) {
  const move = linha.move
  const from = moveFrom(move)
  const to = moveTo(move)
  const capturada = pos.board[to]
  return {
    uci: moveToUci(move),
    de: algebraic(from),
    para: algebraic(to),
    promocao: movePromo(move) ? 'nbrq'[movePromo(move) - 2] : null,
    score: linha.score,
    mate: Math.abs(linha.score) > MATE_BOUND ? Math.ceil((MATE_SCORE - Math.abs(linha.score)) / 2) * Math.sign(linha.score) : null,
    // troca estática: negativo quer dizer que o lance entrega material
    see: see(pos, move),
    captura: capturada ? PIECE_VALUE[typeOf(capturada)] : 0,
    pv: linha.pv.map(moveToUci),
  }
}

function analisar(fen, config) {
  const pos = new Position(fen)
  searcher.configure(config.opts || {})
  const r = searcher.analyzePosition(pos, { maxDepth: config.maxDepth, timeMs: config.timeMs })
  return {
    linhas: r.lines.map((l) => empacotar(pos, l)),
    prof: r.depth,
    nos: r.nodes,
  }
}

self.onmessage = (e) => {
  const { cmd, id } = e.data
  try {
    if (cmd === 'analisar') {
      const config = { ...ANALISE, ...(e.data.config || {}) }
      const r = analisar(e.data.fen, config)
      self.postMessage({ tipo: 'analise', id, ...r })
      return
    }

    if (cmd === 'jogar') {
      const nivel = LEVELS[e.data.nivel] ? e.data.nivel : 'intermediario'
      const cfg = LEVELS[nivel]
      const pos = new Position(e.data.fen)
      searcher.configure(cfg.opts)

      let linhas
      let prof
      let nos
      if (cfg.forca === 3) {
        // no avançado interessa profundidade, não pontuar tudo
        const r = searcher.searchPosition(pos, { maxDepth: cfg.maxDepth, timeMs: cfg.timeMs })
        linhas = r.lines
        prof = r.depth
        nos = r.nodes
      } else {
        const r = searcher.analyzePosition(pos, { maxDepth: cfg.maxDepth, timeMs: cfg.timeMs })
        linhas = r.lines
        prof = r.depth
        nos = r.nodes
      }

      if (!linhas.length) {
        self.postMessage({ tipo: 'jogada', id, escolhida: null, linhas: [], prof, nos })
        return
      }
      const escolhida = escolherLance(linhas, nivel)
      const empacotadas = linhas.map((l) => empacotar(pos, l))
      self.postMessage({
        tipo: 'jogada',
        id,
        escolhida: empacotar(pos, escolhida),
        melhor: empacotar(pos, linhas[0]),
        linhas: empacotadas.slice(0, 6),
        prof,
        nos,
      })
      return
    }

    if (cmd === 'pendurados') {
      // passa a vez e vê onde o adversário ganharia material capturando
      const pos = new Position(e.data.fen)
      const casas = []
      if (!pos.inCheck()) {
        pos.makeNullMove()
        for (const move of pos.legalMoves()) {
          if (!(move & (1 << 17))) continue // só capturas
          if (see(pos, move) > 0) {
            const casa = algebraic(moveTo(move))
            if (!casas.includes(casa)) casas.push(casa)
          }
        }
        pos.undoNullMove()
      }
      self.postMessage({ tipo: 'pendurados', id, casas })
      return
    }

    if (cmd === 'avaliar') {
      const pos = new Position(e.data.fen)
      self.postMessage({ tipo: 'avaliacao', id, nota: evaluate(pos) })
      return
    }

    self.postMessage({ tipo: 'erro', id, mensagem: `comando desconhecido: ${cmd}` })
  } catch (err) {
    self.postMessage({ tipo: 'erro', id, mensagem: String(err && err.stack ? err.stack : err) })
  }
}
