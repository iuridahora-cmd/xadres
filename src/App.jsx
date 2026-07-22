import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import Tabuleiro from './components/Tabuleiro.jsx'
import { DefsPecas } from './components/Pecas.jsx'
import {
  Ajustes,
  BarraAvaliacao,
  Cabecalho,
  Capturadas,
  ControlesDemo,
  DialogoPromocao,
  FimDeJogo,
  Historico,
  PainelAnalise,
  PainelJogadas,
  SeletorNivel,
} from './components/Paineis.jsx'
import { GraficoAvaliacao, Relatorio, Relogio } from './components/Relatorio.jsx'
import { useEngine } from './hooks/useEngine.js'
import { ANALISE, ANALISE_RAPIDA } from './engine/levels.js'
import {
  classificarJogada,
  comentarJogada,
  motivoDoLance,
  paraNotacaoPt,
  chanceDaNota,
  VEREDITOS,
} from './game/analise.js'
import { lanceDeLivro, nomeDaAbertura } from './game/aberturas.js'
import { resumoDaPartida } from './game/precisao.js'
import { TEMPOS, VALOR_PECA } from './game/opcoes.js'
import { som, despertarAudio } from './game/som.js'

/* ------------------------------------------------------------------ */
/* Ajudantes                                                           */
/* ------------------------------------------------------------------ */

const CHAVE_ARMAZENAMENTO = 'meta-alvo-xadrez-v1'

function uciDoLance(mv) {
  return mv.from + mv.to + (mv.promotion || '')
}

function sequenciaEmPt(fen, ucis, limite = 4) {
  const temp = new Chess(fen)
  const saida = []
  for (const uci of ucis.slice(0, limite)) {
    const mv = temp.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined })
    if (!mv) break
    saida.push(paraNotacaoPt(mv.san))
  }
  return saida.join(' ')
}

function sanDeUci(fen, uci) {
  const temp = new Chess(fen)
  try {
    return temp.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined }) || null
  } catch {
    return null
  }
}

function textoDaNota(score, mate) {
  if (mate != null) return `M${Math.abs(mate)}`
  return `${score >= 0 ? '+' : ''}${(score / 100).toFixed(2)}`
}

function pecasDe(jogo, ids) {
  const pecas = []
  for (const linha of jogo.board()) {
    for (const casa of linha) {
      if (!casa) continue
      pecas.push({
        id: ids.get(casa.square) || `${casa.square}-${casa.type}${casa.color}`,
        casa: casa.square,
        tipo: casa.type,
        cor: casa.color,
      })
    }
  }
  return pecas
}

function idsIniciais(jogo) {
  const ids = new Map()
  let n = 0
  for (const linha of jogo.board()) {
    for (const casa of linha) {
      if (casa) ids.set(casa.square, `p${n++}`)
    }
  }
  return ids
}

/** Mantém a identidade das peças entre lances, para a animação deslizar certo. */
function moverIds(ids, mv) {
  const novo = new Map(ids)
  const id = novo.get(mv.from)
  novo.delete(mv.from)
  if (mv.flags.includes('e')) {
    const casaPeao = mv.to[0] + (mv.color === 'w' ? Number(mv.to[1]) - 1 : Number(mv.to[1]) + 1)
    novo.delete(casaPeao)
  }
  novo.set(mv.to, id || `n${Math.random().toString(36).slice(2, 8)}`)
  if (mv.flags.includes('k')) {
    const linha = mv.color === 'w' ? '1' : '8'
    const idTorre = novo.get('h' + linha)
    novo.delete('h' + linha)
    novo.set('f' + linha, idTorre)
  }
  if (mv.flags.includes('q')) {
    const linha = mv.color === 'w' ? '1' : '8'
    const idTorre = novo.get('a' + linha)
    novo.delete('a' + linha)
    novo.set('d' + linha, idTorre)
  }
  return novo
}

function casaDoRei(jogo) {
  if (!jogo.inCheck()) return null
  for (const linha of jogo.board()) {
    for (const casa of linha) {
      if (casa && casa.type === 'k' && casa.color === jogo.turn()) return casa.square
    }
  }
  return null
}

/** Quadro é uma foto da partida depois de um lance. Serve para animar, revisar e desenhar o gráfico. */
function quadroDe(jogo, ids, mv) {
  return {
    fen: jogo.fen(),
    pecas: pecasDe(jogo, ids),
    lance: mv ? { de: mv.from, para: mv.to } : null,
    san: mv ? mv.san : null,
    sanPt: mv ? paraNotacaoPt(mv.san) : null,
    cor: mv ? mv.color : null,
    casaRei: casaDoRei(jogo),
    veredito: null,
    texto: null,
    nota: 0,
    mate: null,
    pendente: !!mv,
  }
}

function construirDemo(fenBase, ucis, titulo, legenda) {
  const paralelo = new Chess(fenBase)
  let mapa = idsIniciais(paralelo)
  const passos = [{ fen: paralelo.fen(), pecas: pecasDe(paralelo, mapa), san: null, lance: null }]
  for (const uci of ucis) {
    let mv
    try {
      mv = paralelo.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined })
    } catch {
      mv = null
    }
    if (!mv) break
    mapa = moverIds(mapa, mv)
    passos.push({
      fen: paralelo.fen(),
      pecas: pecasDe(paralelo, mapa),
      san: paraNotacaoPt(mv.san),
      lance: { de: mv.from, para: mv.to },
      captura: !!mv.captured,
      xeque: paralelo.inCheck(),
      casaRei: casaDoRei(paralelo),
      fim: paralelo.isGameOver(),
      promocao: !!mv.promotion,
      roque: mv.flags.includes('k') || mv.flags.includes('q'),
    })
  }
  if (passos.length < 2) return null
  return { tipo: 'demo', titulo, legenda, passos, indice: 0, tocando: true }
}

function resultadoDaPartida(jogo, corJogador, fimPorTempo, desistiu) {
  if (desistiu) {
    return {
      titulo: 'Você desistiu',
      detalhe: 'Partida encerrada. Dá para revisar os lances no gráfico antes de começar outra.',
      vitoria: false,
    }
  }
  if (fimPorTempo) {
    const jogadorPerdeu = fimPorTempo === corJogador
    return {
      titulo: jogadorPerdeu ? 'Seu tempo acabou' : 'O tempo do bot acabou',
      detalhe: jogadorPerdeu ? 'Na próxima, escolha um ritmo mais folgado.' : 'Vitória por tempo.',
      vitoria: !jogadorPerdeu,
    }
  }
  if (!jogo.isGameOver()) return null
  if (jogo.isCheckmate()) {
    const jogadorVenceu = jogo.turn() !== corJogador
    return {
      titulo: jogadorVenceu ? 'Xeque-mate, você venceu' : 'Xeque-mate, o bot venceu',
      detalhe: jogadorVenceu
        ? 'Partida fechada no ataque. Sobe um nível e tenta de novo.'
        : 'O rei ficou sem saída. Veja no gráfico o lance em que a partida virou.',
      vitoria: jogadorVenceu,
    }
  }
  if (jogo.isStalemate()) return { titulo: 'Empate por afogamento', detalhe: 'O rei não está em xeque, mas não há lance legal.' }
  if (jogo.isInsufficientMaterial()) return { titulo: 'Empate', detalhe: 'Não sobrou material suficiente para dar mate.' }
  if (jogo.isThreefoldRepetition()) return { titulo: 'Empate por repetição', detalhe: 'A mesma posição apareceu três vezes.' }
  if (jogo.isDraw()) return { titulo: 'Empate', detalhe: 'Regra dos 50 lances sem captura nem avanço de peão.' }
  return { titulo: 'Fim de partida', detalhe: '' }
}

function lerPreferencias() {
  const padrao = {
    nivel: 'intermediario',
    cor: 'w',
    som: true,
    tema: 'ametista',
    coordenadas: true,
    treino: false,
    tempo: 'sem',
    pgn: null,
  }
  try {
    const cru = localStorage.getItem(CHAVE_ARMAZENAMENTO)
    if (!cru) return padrao
    return { ...padrao, ...JSON.parse(cru) }
  } catch {
    return padrao
  }
}

function relogioDe(tempoId) {
  const cfg = TEMPOS.find((t) => t.id === tempoId) || TEMPOS[0]
  return {
    ativo: cfg.minutos > 0,
    incremento: cfg.incremento * 1000,
    w: cfg.minutos * 60000,
    b: cfg.minutos * 60000,
  }
}

/* ------------------------------------------------------------------ */
/* Aplicação                                                           */
/* ------------------------------------------------------------------ */

export default function App() {
  const prefsIniciais = useRef(lerPreferencias()).current
  const jogo = useRef(new Chess())
  const ids = useRef(idsIniciais(jogo.current))
  const motor = useEngine()

  const [quadros, setQuadros] = useState(() => [quadroDe(jogo.current, ids.current, null)])
  const [estado, setEstado] = useState(() => ({
    fen: jogo.current.fen(),
    turno: jogo.current.turn(),
    fim: false,
  }))

  const [nivel, setNivel] = useState(prefsIniciais.nivel)
  const [corJogador, setCorJogador] = useState(prefsIniciais.cor)
  const [somLigado, setSomLigado] = useState(prefsIniciais.som)
  const [tema, setTema] = useState(prefsIniciais.tema)
  const [coordenadas, setCoordenadas] = useState(prefsIniciais.coordenadas)
  const [treino, setTreino] = useState(prefsIniciais.treino)
  const [tempoId, setTempoId] = useState(prefsIniciais.tempo)

  const [selecionada, setSelecionada] = useState(null)
  const [promocao, setPromocao] = useState(null)
  const [analiseAtual, setAnaliseAtual] = useState(null)
  const [pensando, setPensando] = useState(false)
  const [analisando, setAnalisando] = useState(false)
  const [setas, setSetas] = useState([])
  const [marcacoes, setMarcacoes] = useState({ setas: [], circulos: [] })
  const [analiseVisivel, setAnaliseVisivel] = useState(null)
  const [mostrarJogadas, setMostrarJogadas] = useState(false)
  const [destacada, setDestacada] = useState(null)
  const [penduradas, setPenduradas] = useState([])
  const [reprodutor, setReprodutor] = useState(null)
  const [revisao, setRevisao] = useState(null)
  const [giroManual, setGiroManual] = useState(false)
  const [desistiu, setDesistiu] = useState(false)
  const [fimPorTempo, setFimPorTempo] = useState(null)
  const [relogio, setRelogio] = useState(() => relogioDe(prefsIniciais.tempo))
  const [avisoCopia, setAvisoCopia] = useState(null)

  const fenDespachada = useRef(null)
  const ultimoTique = useRef(null)

  const tocar = useCallback(
    (nome) => {
      if (somLigado && som[nome]) som[nome]()
    },
    [somLigado],
  )

  const lances = useMemo(() => quadros.slice(1), [quadros])
  const encerrada = estado.fim || !!fimPorTempo || desistiu
  const resultado = useMemo(
    () => resultadoDaPartida(jogo.current, corJogador, fimPorTempo, desistiu),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [estado.fen, estado.fim, corJogador, fimPorTempo, desistiu],
  )

  /* -------------------------------------------------------------- */
  /* Preferências e retomada                                         */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    const dados = {
      nivel,
      cor: corJogador,
      som: somLigado,
      tema,
      coordenadas,
      treino,
      tempo: tempoId,
      pgn: lances.length && !encerrada ? jogo.current.pgn() : null,
    }
    try {
      localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(dados))
    } catch {
      /* modo anônimo, sem espaço, tudo bem */
    }
  }, [nivel, corJogador, somLigado, tema, coordenadas, treino, tempoId, lances.length, encerrada])

  // retoma a partida que ficou aberta na última visita
  const retomou = useRef(false)
  useEffect(() => {
    if (retomou.current) return
    retomou.current = true
    if (!prefsIniciais.pgn) return
    try {
      const retomado = new Chess()
      retomado.loadPgn(prefsIniciais.pgn)
      const historico = retomado.history({ verbose: true })
      if (!historico.length) return
      const paralelo = new Chess()
      let mapa = idsIniciais(paralelo)
      const novos = [quadroDe(paralelo, mapa, null)]
      for (const mv of historico) {
        const feito = paralelo.move({ from: mv.from, to: mv.to, promotion: mv.promotion })
        mapa = moverIds(mapa, feito)
        novos.push({ ...quadroDe(paralelo, mapa, feito), pendente: false })
      }
      jogo.current = paralelo
      ids.current = mapa
      setQuadros(novos)
      setEstado({ fen: paralelo.fen(), turno: paralelo.turn(), fim: paralelo.isGameOver() })
    } catch {
      /* pgn inválido, começa nova */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    document.body.dataset.tema = tema
  }, [tema])

  /* -------------------------------------------------------------- */
  /* Relógio                                                         */
  /* -------------------------------------------------------------- */

  const partidaComecou = lances.length > 0

  useEffect(() => {
    if (!relogio.ativo || encerrada || !partidaComecou || reprodutor || revisao != null) {
      ultimoTique.current = null
      return
    }
    ultimoTique.current = Date.now()
    const id = setInterval(() => {
      const agora = Date.now()
      const passou = agora - (ultimoTique.current || agora)
      ultimoTique.current = agora
      setRelogio((r) => {
        if (!r.ativo) return r
        const lado = estado.turno
        const restante = Math.max(0, r[lado] - passou)
        if (restante === 0) {
          setFimPorTempo((f) => f || lado)
          return { ...r, [lado]: 0 }
        }
        return { ...r, [lado]: restante }
      })
    }, 100)
    return () => clearInterval(id)
  }, [relogio.ativo, encerrada, partidaComecou, reprodutor, revisao, estado.turno])

  useEffect(() => {
    if (fimPorTempo) tocar('fim')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fimPorTempo])

  const somarIncremento = useCallback((cor) => {
    setRelogio((r) => (r.ativo && r.incremento ? { ...r, [cor]: r[cor] + r.incremento } : r))
  }, [])

  /* -------------------------------------------------------------- */
  /* Ciclo principal                                                 */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    if (!motor.pronto || encerrada) return
    if (fenDespachada.current === estado.fen) return
    fenDespachada.current = estado.fen
    const minhaGeracao = motor.geracao.current

    if (estado.turno === corJogador) {
      setAnalisando(true)
      motor
        .analisar(estado.fen, ANALISE)
        .then((r) => {
          if (!r.atual || minhaGeracao !== motor.geracao.current) return
          setAnaliseAtual({ fen: estado.fen, ...r })
          const linha = r.linhas[0]
          if (linha) {
            const sinal = estado.turno === 'w' ? 1 : -1
            atualizarNotaDoUltimoQuadro(linha.score * sinal, linha.mate == null ? null : linha.mate * sinal)
          }
        })
        .catch(() => {})
        .finally(() => setAnalisando(false))
      return
    }

    // lance do bot: primeiro tenta o livro de aberturas, para variar o começo
    const sans = jogo.current.history()
    const doLivro = lanceDeLivro(sans, jogo.current.moves())
    if (doLivro) {
      setPensando(true)
      const t = setTimeout(() => {
        if (minhaGeracao !== motor.geracao.current) return
        aplicarLanceDoBot({ san: doLivro, livro: true })
        setPensando(false)
      }, 420)
      return () => clearTimeout(t)
    }

    setPensando(true)
    const inicio = Date.now()
    motor
      .jogar(estado.fen, nivel)
      .then(async (r) => {
        if (!r.atual || minhaGeracao !== motor.geracao.current || !r.escolhida) return
        const espera = Math.max(0, 260 - (Date.now() - inicio))
        if (espera) await new Promise((res) => setTimeout(res, espera))
        if (minhaGeracao !== motor.geracao.current) return
        aplicarLanceDoBot(r)
      })
      .catch(() => {})
      .finally(() => setPensando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.fen, estado.turno, encerrada, corJogador, nivel, motor.pronto])

  // peças penduradas no modo treino
  useEffect(() => {
    if (!treino || !motor.pronto || encerrada || estado.turno !== corJogador || revisao != null) {
      setPenduradas([])
      return
    }
    let vivo = true
    motor
      .pendurados(estado.fen)
      .then((r) => vivo && setPenduradas(r.casas || []))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [treino, motor, estado.fen, estado.turno, corJogador, encerrada, revisao])

  /* -------------------------------------------------------------- */
  /* Aplicar lances                                                  */
  /* -------------------------------------------------------------- */

  const atualizarNotaDoUltimoQuadro = useCallback((nota, mate) => {
    setQuadros((qs) => {
      if (!qs.length) return qs
      const copia = [...qs]
      copia[copia.length - 1] = { ...copia[copia.length - 1], nota, mate }
      return copia
    })
  }, [])

  const efeitoSonoro = useCallback(
    (mv, jogoAtual) => {
      if (jogoAtual.isGameOver()) tocar('fim')
      else if (jogoAtual.inCheck()) tocar('xeque')
      else if (mv.promotion) tocar('promocao')
      else if (mv.flags.includes('k') || mv.flags.includes('q')) tocar('roque')
      else if (mv.captured) tocar('captura')
      else tocar('lance')
    },
    [tocar],
  )

  function aplicarLanceDoBot(resposta) {
    let mv
    try {
      mv = resposta.livro
        ? jogo.current.move(resposta.san)
        : jogo.current.move({
            from: resposta.escolhida.de,
            to: resposta.escolhida.para,
            promotion: resposta.escolhida.promocao || undefined,
          })
    } catch {
      mv = null
    }
    if (!mv) return

    ids.current = moverIds(ids.current, mv)
    efeitoSonoro(mv, jogo.current)
    somarIncremento(mv.color)
    setReprodutor(null)
    setRevisao(null)
    setSetas([])
    setMarcacoes({ setas: [], circulos: [] })
    setAnaliseAtual(null)

    let veredito = null
    let nota = 0
    let mate = null
    let texto = 'Lance de livro de abertura.'
    if (!resposta.livro) {
      const melhor = resposta.melhor || resposta.linhas[0]
      const linhaJogada = resposta.linhas.find((l) => l.uci === resposta.escolhida.uci) || resposta.escolhida
      veredito = classificarJogada({
        linhaJogada,
        melhorLinha: melhor,
        totalLegais: resposta.linhas.length,
        refutacao: null,
      })
      const sinal = mv.color === 'w' ? 1 : -1
      nota = (linhaJogada.score || 0) * sinal
      mate = linhaJogada.mate == null ? null : linhaJogada.mate * sinal
      texto = `Lance do bot no nível selecionado. Avaliação ${textoDaNota(linhaJogada.score, linhaJogada.mate)}.`
    } else {
      veredito = { chave: 'livro', ...VEREDITOS.livro, perda: 0, perdaWp: 0 }
      const anterior = quadros[quadros.length - 1]
      nota = anterior ? anterior.nota : 0
    }

    setQuadros((qs) => [
      ...qs,
      { ...quadroDe(jogo.current, ids.current, mv), veredito, texto, nota, mate, pendente: false },
    ])
    setEstado({ fen: jogo.current.fen(), turno: jogo.current.turn(), fim: jogo.current.isGameOver() })
  }

  async function classificarLanceDoJogador(fenAntes, mv, fenDepois, indiceQuadro) {
    const minhaGeracao = motor.geracao.current
    setAnalisando(true)
    try {
      let antes = analiseAtual && analiseAtual.fen === fenAntes ? analiseAtual : null
      if (!antes) {
        const r = await motor.analisar(fenAntes, ANALISE)
        if (minhaGeracao !== motor.geracao.current) return
        antes = { fen: fenAntes, ...r }
      }
      const linhaJogada = antes.linhas.find((l) => l.uci === uciDoLance(mv))
      const melhor = antes.linhas[0]

      const depois = await motor.analisar(fenDepois, ANALISE_RAPIDA)
      if (minhaGeracao !== motor.geracao.current) return
      const refutacaoLinha = depois.linhas && depois.linhas[0]
      let refutacao = null
      let pecaAmeacada = null
      if (refutacaoLinha) {
        const mvRef = sanDeUci(fenDepois, refutacaoLinha.uci)
        refutacao = { ...refutacaoLinha, san: mvRef ? paraNotacaoPt(mvRef.san) : refutacaoLinha.uci }
        if (refutacaoLinha.see > 60) {
          const alvo = jogo.current.get(refutacaoLinha.para)
          if (alvo && alvo.color === mv.color) pecaAmeacada = { tipo: alvo.type, casa: refutacaoLinha.para }
        }
      }

      const veredito = classificarJogada({
        linhaJogada,
        melhorLinha: melhor,
        totalLegais: antes.linhas.length,
        refutacao: refutacaoLinha,
      })

      const mvMelhor = melhor ? sanDeUci(fenAntes, melhor.uci) : null
      const texto = comentarJogada({
        veredito,
        jogada: mv,
        sanMelhor: mvMelhor ? paraNotacaoPt(mvMelhor.san) : null,
        pvMelhor: melhor ? sequenciaEmPt(fenAntes, melhor.pv, 3) : null,
        refutacao,
        pecaAmeacada,
        perdeuMate: !!(melhor && melhor.mate > 0 && !(linhaJogada && linhaJogada.mate > 0)),
        daXeque: mv.san.includes('+'),
        eMate: mv.san.includes('#'),
      })

      const sinal = mv.color === 'w' ? 1 : -1
      const notaJogada = linhaJogada || { score: 0, mate: null }
      const demo =
        melhor && !veredito.ehMelhor
          ? {
              fen: fenAntes,
              ucis: melhor.pv,
              titulo: 'Como era melhor jogar',
              legenda: `No lugar de ${paraNotacaoPt(mv.san)}, o certo era ${
                mvMelhor ? paraNotacaoPt(mvMelhor.san) : melhor.uci
              }`,
            }
          : null

      setQuadros((qs) => {
        const copia = [...qs]
        if (copia[indiceQuadro]) {
          copia[indiceQuadro] = {
            ...copia[indiceQuadro],
            veredito,
            texto,
            pendente: false,
            nota: notaJogada.score * sinal,
            mate: notaJogada.mate == null ? null : notaJogada.mate * sinal,
            demo,
          }
        }
        return copia
      })

      setAnaliseVisivel({
        veredito,
        texto,
        sanPt: paraNotacaoPt(mv.san),
        notaTexto: textoDaNota(notaJogada.score, notaJogada.mate),
        prof: antes.prof,
        demo,
      })
      if (veredito.chave === 'errograve' || veredito.chave === 'erro') tocar('erro')
    } catch {
      /* motor descartado no meio */
    } finally {
      setAnalisando(false)
    }
  }

  function executarLanceDoJogador(de, para, promocaoEscolhida) {
    const fenAntes = jogo.current.fen()
    let mv
    try {
      mv = jogo.current.move({ from: de, to: para, promotion: promocaoEscolhida || undefined })
    } catch {
      mv = null
    }
    if (!mv) return false

    ids.current = moverIds(ids.current, mv)
    efeitoSonoro(mv, jogo.current)
    somarIncremento(mv.color)
    setSelecionada(null)
    setReprodutor(null)
    setRevisao(null)
    setSetas([])
    setMarcacoes({ setas: [], circulos: [] })
    setMostrarJogadas(false)
    setAnaliseVisivel(null)

    let indice = 0
    setQuadros((qs) => {
      indice = qs.length
      return [...qs, quadroDe(jogo.current, ids.current, mv)]
    })
    const fenDepois = jogo.current.fen()
    setEstado({ fen: fenDepois, turno: jogo.current.turn(), fim: jogo.current.isGameOver() })
    classificarLanceDoJogador(fenAntes, mv, fenDepois, quadros.length)
    return true
  }

  /* -------------------------------------------------------------- */
  /* Interação                                                       */
  /* -------------------------------------------------------------- */

  const destinos = useMemo(() => {
    if (!selecionada) return new Map()
    const mapa = new Map()
    try {
      for (const mv of jogo.current.moves({ square: selecionada, verbose: true })) {
        mapa.set(mv.to, { captura: !!mv.captured })
      }
    } catch {
      /* casa sem peça */
    }
    return mapa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionada, estado.fen])

  const aoClicarCasa = useCallback(
    (casa, opcoes) => {
      despertarAudio()
      if (encerrada || estado.turno !== corJogador || pensando || reprodutor || revisao != null) return
      const origem = opcoes.viaArraste ? opcoes.origem : selecionada
      const peca = jogo.current.get(casa)

      if (origem && origem !== casa) {
        const candidatos = jogo.current.moves({ square: origem, verbose: true }).filter((m) => m.to === casa)
        if (candidatos.length) {
          if (candidatos.some((m) => m.promotion)) {
            setPromocao({ de: origem, para: casa, cor: candidatos[0].color })
            return
          }
          executarLanceDoJogador(origem, casa)
          return
        }
      }

      if (peca && peca.color === corJogador) setSelecionada(casa === selecionada ? null : casa)
      else setSelecionada(null)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selecionada, estado.fen, estado.turno, encerrada, corJogador, pensando, reprodutor, revisao],
  )

  const aoMarcar = useCallback((m) => {
    setMarcacoes((atual) => {
      if (m.tipo === 'circulo') {
        const tem = atual.circulos.includes(m.casa)
        return { ...atual, circulos: tem ? atual.circulos.filter((c) => c !== m.casa) : [...atual.circulos, m.casa] }
      }
      const tem = atual.setas.some((s) => s.de === m.de && s.para === m.para)
      return {
        ...atual,
        setas: tem ? atual.setas.filter((s) => !(s.de === m.de && s.para === m.para)) : [...atual.setas, m],
      }
    })
  }, [])

  /* -------------------------------------------------------------- */
  /* Reprodutor (demonstração e revisão)                             */
  /* -------------------------------------------------------------- */

  const abrirDemo = useCallback(
    (fenBase, ucis, titulo, legenda) => {
      const novo = construirDemo(fenBase, ucis, titulo, legenda)
      if (!novo) return
      setSetas([])
      setSelecionada(null)
      setMostrarJogadas(false)
      setRevisao(null)
      tocar('dica')
      setReprodutor(novo)
    },
    [tocar],
  )

  const fecharReprodutor = useCallback(() => {
    setReprodutor(null)
    setSetas([])
  }, [])

  const irParaPasso = useCallback((indice) => {
    setReprodutor((d) => {
      if (!d) return d
      const alvo = Math.max(0, Math.min(d.passos.length - 1, indice))
      return { ...d, indice: alvo, tocando: false }
    })
  }, [])

  useEffect(() => {
    if (!reprodutor || !reprodutor.tocando) return
    if (reprodutor.indice >= reprodutor.passos.length - 1) {
      setReprodutor((d) => (d ? { ...d, tocando: false } : d))
      return
    }
    const t = setTimeout(
      () => {
        setReprodutor((d) => {
          if (!d) return d
          const proximo = Math.min(d.indice + 1, d.passos.length - 1)
          return { ...d, indice: proximo, tocando: proximo < d.passos.length - 1 }
        })
      },
      reprodutor.indice === 0 ? 520 : 900,
    )
    return () => clearTimeout(t)
  }, [reprodutor])

  useEffect(() => {
    if (!reprodutor) return
    const passo = reprodutor.passos[reprodutor.indice]
    if (passo && passo.lance) {
      if (passo.fim) tocar('fim')
      else if (passo.xeque) tocar('xeque')
      else if (passo.promocao) tocar('promocao')
      else if (passo.roque) tocar('roque')
      else if (passo.captura) tocar('captura')
      else tocar('lance')
    }
    const proximo = reprodutor.passos[reprodutor.indice + 1]
    setSetas(proximo && proximo.lance ? [{ de: proximo.lance.de, para: proximo.lance.para, tipo: 'melhor' }] : [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reprodutor && reprodutor.indice, reprodutor && reprodutor.titulo])

  /* -------------------------------------------------------------- */
  /* Revisão do histórico                                            */
  /* -------------------------------------------------------------- */

  const irParaLance = useCallback(
    (indice) => {
      if (indice == null) {
        setRevisao(null)
        return
      }
      const alvo = Math.max(0, Math.min(quadros.length - 1, indice))
      setReprodutor(null)
      setSetas([])
      setSelecionada(null)
      setRevisao(alvo === quadros.length - 1 ? null : alvo)
      const q = quadros[alvo]
      if (q && q.veredito) {
        setAnaliseVisivel({
          veredito: q.veredito,
          texto: q.texto,
          sanPt: q.sanPt,
          notaTexto: textoDaNota(q.nota, q.mate),
          prof: '',
          demo: q.demo,
        })
      }
    },
    [quadros],
  )

  /* -------------------------------------------------------------- */
  /* Ajuda                                                           */
  /* -------------------------------------------------------------- */

  const analisePronta = analiseAtual && analiseAtual.fen === estado.fen && analiseAtual.linhas.length > 0
  const podeAjudar = analisePronta && estado.turno === corJogador && !pensando && !encerrada && revisao == null

  function mostrarMelhorJogada() {
    if (!podeAjudar) return
    const melhor = analiseAtual.linhas[0]
    const mv = sanDeUci(estado.fen, melhor.uci)
    const info = mv ? { san: mv.san, flags: mv.flags, piece: mv.piece } : null
    setAnaliseVisivel({
      veredito: { chave: 'melhor', rotulo: 'Sugestão do motor', icone: '★', perdaWp: 0 },
      sanPt: mv ? paraNotacaoPt(mv.san) : melhor.uci,
      notaTexto: textoDaNota(melhor.score, melhor.mate),
      prof: analiseAtual.prof,
      texto:
        `Jogue ${mv ? paraNotacaoPt(mv.san) : melhor.uci} (${motivoDoLance(melhor, info)}). ` +
        `Estou mostrando no tabuleiro esse lance e a continuação provável.`,
    })
    abrirDemo(estado.fen, melhor.pv, 'O lance que você deveria jogar', `${mv ? paraNotacaoPt(mv.san) : melhor.uci} e a sequência prevista`)
  }

  /** Dica leve: só acende a peça que deve sair do lugar. */
  function darDica() {
    if (!podeAjudar) return
    const melhor = analiseAtual.linhas[0]
    tocar('dica')
    setMarcacoes((m) => ({ ...m, circulos: [melhor.de] }))
    const peca = jogo.current.get(melhor.de)
    setAnaliseVisivel({
      veredito: { chave: 'boa', rotulo: 'Dica', icone: '◈', perdaWp: 0 },
      sanPt: '',
      notaTexto: '',
      prof: '',
      texto: `A peça que resolve está em ${melhor.de}${peca ? ` (${{ p: 'peão', n: 'cavalo', b: 'bispo', r: 'torre', q: 'dama', k: 'rei' }[peca.type]})` : ''}. Tente achar para onde ela vai antes de pedir a resposta.`,
    })
  }

  const jogadasCandidatas = useMemo(() => {
    if (!analisePronta) return []
    const linhas = analiseAtual.linhas.slice(0, 6)
    const melhorNota = chanceDaNota(linhas[0].score, linhas[0].mate)
    return linhas.map((l) => {
      const mv = sanDeUci(estado.fen, l.uci)
      const chance = chanceDaNota(l.score, l.mate)
      return {
        uci: l.uci,
        de: l.de,
        para: l.para,
        sanPt: mv ? paraNotacaoPt(mv.san) : l.uci,
        nota: l.score,
        notaTexto: textoDaNota(l.score, l.mate),
        motivo: motivoDoLance(l, mv),
        forca: Math.max(4, Math.round(100 - (melhorNota - chance) * 2.2)),
        pv: sequenciaEmPt(estado.fen, l.pv, 4),
        pvUcis: l.pv,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analisePronta, analiseAtual, estado.fen])

  function alternarJogadas() {
    if (mostrarJogadas) {
      setMostrarJogadas(false)
      setSetas([])
      return
    }
    if (!podeAjudar) return
    setMostrarJogadas(true)
    tocar('dica')
    setSetas(
      jogadasCandidatas.map((j, i) => ({
        de: j.de,
        para: j.para,
        tipo: i === 0 ? 'melhor' : 'opcao',
        opacidade: i === 0 ? 1 : Math.max(0.25, 0.75 - i * 0.12),
      })),
    )
  }

  useEffect(() => {
    if (!mostrarJogadas) return
    if (destacada == null) {
      setSetas(
        jogadasCandidatas.map((j, i) => ({
          de: j.de,
          para: j.para,
          tipo: i === 0 ? 'melhor' : 'opcao',
          opacidade: i === 0 ? 1 : Math.max(0.25, 0.75 - i * 0.12),
        })),
      )
    } else {
      const j = jogadasCandidatas[destacada]
      if (j) setSetas([{ de: j.de, para: j.para, tipo: destacada === 0 ? 'melhor' : 'opcao' }])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destacada, mostrarJogadas])

  /* -------------------------------------------------------------- */
  /* Controles da partida                                            */
  /* -------------------------------------------------------------- */

  const novaPartida = useCallback(
    (cor = corJogador, nivelNovo = nivel, tempoNovo = tempoId) => {
      motor.invalidar()
      jogo.current = new Chess()
      ids.current = idsIniciais(jogo.current)
      fenDespachada.current = null
      setCorJogador(cor)
      setNivel(nivelNovo)
      setTempoId(tempoNovo)
      setRelogio(relogioDe(tempoNovo))
      setQuadros([quadroDe(jogo.current, ids.current, null)])
      setEstado({ fen: jogo.current.fen(), turno: 'w', fim: false })
      setAnaliseAtual(null)
      setAnaliseVisivel(null)
      setReprodutor(null)
      setRevisao(null)
      setSetas([])
      setMarcacoes({ setas: [], circulos: [] })
      setSelecionada(null)
      setMostrarJogadas(false)
      setPensando(false)
      setAnalisando(false)
      setDesistiu(false)
      setFimPorTempo(null)
      setGiroManual(false)
    },
    [corJogador, nivel, tempoId, motor],
  )

  function voltarLance() {
    if (!lances.length) return
    motor.invalidar()
    const historico = jogo.current.history({ verbose: true })
    let quantos = 0
    for (let i = historico.length - 1; i >= 0 && quantos < 2; i--) {
      jogo.current.undo()
      quantos++
      if (historico[i].color === corJogador) break
    }
    ids.current = idsIniciais(jogo.current)
    fenDespachada.current = null
    setQuadros((qs) => qs.slice(0, Math.max(1, qs.length - quantos)))
    setEstado({ fen: jogo.current.fen(), turno: jogo.current.turn(), fim: jogo.current.isGameOver() })
    setAnaliseAtual(null)
    setAnaliseVisivel(null)
    setReprodutor(null)
    setRevisao(null)
    setSetas([])
    setMarcacoes({ setas: [], circulos: [] })
    setSelecionada(null)
    setMostrarJogadas(false)
    setPensando(false)
    setFimPorTempo(null)
  }

  async function copiarPgn() {
    const cabecalho = [
      '[Event "Meta Alvo Xadrez"]',
      `[Date "${new Date().toISOString().slice(0, 10).replace(/-/g, '.')}"]`,
      `[White "${corJogador === 'w' ? 'Você' : `Bot ${nivel}`}"]`,
      `[Black "${corJogador === 'b' ? 'Você' : `Bot ${nivel}`}"]`,
      '',
    ].join('\n')
    const texto = cabecalho + jogo.current.pgn()
    try {
      await navigator.clipboard.writeText(texto)
      setAvisoCopia('PGN copiado')
    } catch {
      setAvisoCopia('não deu para copiar')
    }
    setTimeout(() => setAvisoCopia(null), 2200)
  }

  /* -------------------------------------------------------------- */
  /* Teclado                                                         */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      const indiceVivo = revisao == null ? quadros.length - 1 : revisao
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (reprodutor) irParaPasso(reprodutor.indice - 1)
        else irParaLance(indiceVivo - 1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (reprodutor) irParaPasso(reprodutor.indice + 1)
        else irParaLance(indiceVivo + 1)
      } else if (e.key === 'Home') {
        irParaLance(0)
      } else if (e.key === 'End') {
        irParaLance(quadros.length - 1)
      } else if (e.key === 'Escape') {
        setReprodutor(null)
        setRevisao(null)
        setMostrarJogadas(false)
        setSetas([])
      } else if (e.key.toLowerCase() === 'f') {
        setGiroManual((g) => !g)
      } else if (e.key.toLowerCase() === 'h') {
        darDica()
      } else if (e.key.toLowerCase() === 'm') {
        mostrarMelhorJogada()
      } else if (e.key.toLowerCase() === 'n') {
        novaPartida()
      } else if (e.key === ' ' && reprodutor) {
        e.preventDefault()
        setReprodutor((d) => (d ? { ...d, tocando: !d.tocando } : d))
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  })

  /* -------------------------------------------------------------- */
  /* Derivados de exibição                                           */
  /* -------------------------------------------------------------- */

  const girado = (corJogador === 'b') !== giroManual
  const emDemo = !!reprodutor
  const emRevisao = revisao != null
  const quadroAtual = emDemo
    ? reprodutor.passos[reprodutor.indice]
    : emRevisao
      ? quadros[revisao]
      : quadros[quadros.length - 1]
  const bloqueado = emDemo || emRevisao || estado.turno !== corJogador || pensando || encerrada

  const capturadas = useMemo(() => {
    const contagem = { w: [], b: [] }
    for (const mv of jogo.current.history({ verbose: true })) {
      if (mv.captured) contagem[mv.color].push(mv.captured)
    }
    return contagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.fen])

  const materialDe = (cor) => capturadas[cor].reduce((t, p) => t + VALOR_PECA[p], 0)
  const vantagem = materialDe('w') - materialDe('b')

  const abertura = useMemo(() => nomeDaAbertura(jogo.current.history()), [estado.fen])
  const resumo = useMemo(() => resumoDaPartida(lances, corJogador), [lances, corJogador])

  const notaExibida = quadroAtual || { nota: 0, mate: null }
  const pontosDoGrafico = useMemo(
    () =>
      quadros.map((q, i) => ({
        nota: q.mate != null ? (q.mate > 0 ? 900 : -900) : q.nota,
        veredito: q.veredito ? q.veredito.chave : null,
        rotulo: i === 0 ? 'início' : `${Math.ceil(i / 2)}. ${q.sanPt}`,
      })),
    [quadros],
  )

  const rotuloNivel = nivel === 'iniciante' ? 'Iniciante' : nivel === 'intermediario' ? 'Intermediário' : 'Avançado'
  const corBot = corJogador === 'w' ? 'b' : 'w'

  return (
    <div className="app">
      <DefsPecas />
      <div className="brilho-fundo" aria-hidden="true" />
      <Cabecalho abertura={abertura} />

      <main className="palco">
        <section className="coluna-tabuleiro">
          <div className="linha-jogador">
            <span className="etiqueta-jogador">
              <i className={`ponto ${girado ? 'ponto-branco' : 'ponto-preto'}`} />
              Bot {rotuloNivel}
              {pensando && <em className="pensando">pensando…</em>}
            </span>
            <Capturadas pecas={capturadas[corBot]} cor={corJogador} vantagem={corBot === 'w' ? vantagem : -vantagem} />
            {relogio.ativo && (
              <Relogio
                ms={relogio[corBot]}
                ativo={estado.turno === corBot && !encerrada}
                esgotado={fimPorTempo === corBot}
                rotulo="Tempo do bot"
              />
            )}
          </div>

          <div className="area-tabuleiro">
            <BarraAvaliacao nota={notaExibida.nota} mate={notaExibida.mate} girado={girado} />
            <div className={`envelope-tabuleiro ${emDemo ? 'em-demo' : ''} ${emRevisao ? 'em-revisao' : ''}`}>
              <Tabuleiro
                pecas={quadroAtual.pecas}
                girado={girado}
                selecionada={bloqueado ? null : selecionada}
                destinos={bloqueado ? new Map() : destinos}
                ultimoLance={quadroAtual.lance}
                casaEmXeque={emDemo ? quadroAtual.casaRei : quadroAtual.casaRei}
                setas={setas}
                marcacoes={marcacoes}
                onMarcar={aoMarcar}
                penduradas={penduradas}
                mostrarCoordenadas={coordenadas}
                onClicarCasa={aoClicarCasa}
                bloqueado={bloqueado}
              />
              {emDemo && (
                <div className="faixa-demo">
                  <span className="ponto-demo" />
                  Demonstração, não conta na partida
                </div>
              )}
              {emRevisao && (
                <div className="faixa-demo faixa-revisao">
                  <span className="ponto-demo" />
                  Revisando o lance {revisao} de {quadros.length - 1}
                </div>
              )}
            </div>
          </div>

          <div className="linha-jogador">
            <span className="etiqueta-jogador">
              <i className={`ponto ${girado ? 'ponto-preto' : 'ponto-branco'}`} />
              Você
              {estado.turno === corJogador && !encerrada && !emDemo && !emRevisao && <em className="sua-vez">sua vez</em>}
            </span>
            <Capturadas
              pecas={capturadas[corJogador]}
              cor={corBot}
              vantagem={corJogador === 'w' ? vantagem : -vantagem}
            />
            {relogio.ativo && (
              <Relogio
                ms={relogio[corJogador]}
                ativo={estado.turno === corJogador && !encerrada}
                esgotado={fimPorTempo === corJogador}
                rotulo="Seu tempo"
              />
            )}
          </div>

          {emDemo ? (
            <ControlesDemo
              demo={reprodutor}
              onPasso={irParaPasso}
              onAlternar={() =>
                setReprodutor((d) =>
                  d
                    ? {
                        ...d,
                        tocando: !d.tocando,
                        indice: d.tocando ? d.indice : d.indice >= d.passos.length - 1 ? 0 : d.indice,
                      }
                    : d,
                )
              }
              onFechar={fecharReprodutor}
            />
          ) : (
            <>
              {emRevisao && (
                <div className="barra-revisao">
                  <button className="botao botao-fantasma" onClick={() => irParaLance(revisao - 1)} disabled={revisao === 0}>
                    ‹
                  </button>
                  <span className="revisao-texto">
                    {quadros[revisao].sanPt ? (
                      <>
                        Lance {revisao}: <strong>{quadros[revisao].sanPt}</strong>
                      </>
                    ) : (
                      'Posição inicial'
                    )}
                  </span>
                  <button className="botao botao-fantasma" onClick={() => irParaLance(revisao + 1)}>
                    ›
                  </button>
                  <button className="botao botao-roxo" onClick={() => irParaLance(null)}>
                    Voltar ao lance atual
                  </button>
                </div>
              )}

              <div className="botoes-acao">
                <button className="botao botao-ouro" onClick={mostrarMelhorJogada} disabled={!podeAjudar}>
                  <span className="icone-botao">★</span> Melhor jogada
                </button>
                <button
                  className={`botao botao-roxo ${mostrarJogadas ? 'ativo' : ''}`}
                  onClick={alternarJogadas}
                  disabled={!podeAjudar}
                >
                  <span className="icone-botao">≡</span> Jogadas
                </button>
                <button className="botao botao-fantasma" onClick={darDica} disabled={!podeAjudar} title="Atalho: H">
                  Dica leve
                </button>
              </div>

              <div className="botoes-acao botoes-secundarios">
                <button className="botao botao-fantasma" onClick={voltarLance} disabled={!lances.length || pensando}>
                  ↶ Voltar lance
                </button>
                <button className="botao botao-fantasma" onClick={() => setGiroManual((g) => !g)} title="Atalho: F">
                  ⇅ Girar
                </button>
                <button
                  className="botao botao-fantasma"
                  onClick={() => setDesistiu(true)}
                  disabled={!lances.length || encerrada}
                >
                  Desistir
                </button>
                <button className="botao botao-fantasma" onClick={() => novaPartida()} title="Atalho: N">
                  Nova partida
                </button>
              </div>
            </>
          )}
        </section>

        <aside className="coluna-painel">
          <SeletorNivel nivel={nivel} onMudar={(n) => novaPartida(corJogador, n)} bloqueado={false} />

          <PainelAnalise
            analise={analiseVisivel}
            pensando={pensando}
            analisando={analisando}
            vez={estado.turno}
            corJogador={corJogador}
            onDemonstrar={
              analiseVisivel && analiseVisivel.demo && !emDemo
                ? () =>
                    abrirDemo(
                      analiseVisivel.demo.fen,
                      analiseVisivel.demo.ucis,
                      analiseVisivel.demo.titulo,
                      analiseVisivel.demo.legenda,
                    )
                : null
            }
          />

          <PainelJogadas
            jogadas={jogadasCandidatas}
            aberto={mostrarJogadas}
            onFechar={() => {
              setMostrarJogadas(false)
              setSetas([])
            }}
            onDestacar={setDestacada}
            indiceDestacado={destacada}
            onDemonstrar={(j) => abrirDemo(estado.fen, j.pvUcis, `E se você jogasse ${j.sanPt}?`, j.motivo)}
          />

          <GraficoAvaliacao
            pontos={pontosDoGrafico}
            indiceAtual={emRevisao ? revisao : quadros.length - 1}
            onSelecionar={irParaLance}
            girado={girado}
          />

          <Historico
            lances={lances}
            indiceAtual={emRevisao ? revisao : quadros.length - 1}
            onSelecionar={(i) => irParaLance(i)}
          />

          <Relatorio resumo={resumo} />

          <Ajustes
            corJogador={corJogador}
            onCor={(c) => novaPartida(c)}
            tempoId={tempoId}
            onTempo={(t) => novaPartida(corJogador, nivel, t)}
            tema={tema}
            onTema={setTema}
            coordenadas={coordenadas}
            onCoordenadas={setCoordenadas}
            treino={treino}
            onTreino={setTreino}
            som={somLigado}
            onSom={setSomLigado}
            onCopiarPgn={copiarPgn}
            avisoCopia={avisoCopia}
            temLances={!!lances.length}
          />
        </aside>
      </main>

      {promocao && (
        <DialogoPromocao
          cor={promocao.cor}
          onCancelar={() => setPromocao(null)}
          onEscolher={(tipo) => {
            const p = promocao
            setPromocao(null)
            executarLanceDoJogador(p.de, p.para, tipo)
          }}
        />
      )}

      <FimDeJogo resultado={resultado} resumo={resumo} onNovaPartida={() => novaPartida()} onRevisar={() => irParaLance(1)} />

      <footer className="rodape">
        Atalhos: ← → navegam os lances, F gira o tabuleiro, H dá dica, M mostra o melhor lance, N começa outra partida.
        Botão direito no tabuleiro desenha setas e círculos.
      </footer>
    </div>
  )
}
