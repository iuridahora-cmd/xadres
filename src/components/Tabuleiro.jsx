import { useCallback, useEffect, useRef, useState } from 'react'
import { Peca } from './Pecas.jsx'

const COLUNAS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

function casaDe(col, lin) {
  return COLUNAS[col] + (8 - lin)
}

/**
 * Seta como polígono, em unidades de casa. Marcador de SVG não serve aqui:
 * ele escala junto com a espessura do traço e some em lance de uma casa só.
 */
function caminhoDaSeta(origem, destino, forte) {
  const x1 = origem.x + 0.5
  const y1 = origem.y + 0.5
  const x2 = destino.x + 0.5
  const y2 = destino.y + 0.5
  const dx = x2 - x1
  const dy = y2 - y1
  const comp = Math.hypot(dx, dy) || 1
  const ux = dx / comp
  const uy = dy / comp
  const nx = -uy
  const ny = ux

  const recuoInicio = 0.3
  const recuoFim = 0.34
  const largura = forte ? 0.075 : 0.055
  const pontaComp = forte ? 0.3 : 0.25
  const pontaLarg = forte ? 0.19 : 0.15

  // se as casas forem vizinhas, encolhe tudo para a seta ainda caber
  const disponivel = comp - recuoInicio - recuoFim
  const escala = Math.min(1, Math.max(0.35, disponivel / (pontaComp + 0.12)))
  const ph = pontaComp * escala
  const pw = pontaLarg * escala
  const lw = largura * escala

  const tx = x1 + ux * recuoInicio
  const ty = y1 + uy * recuoInicio
  const px = x2 - ux * recuoFim
  const py = y2 - uy * recuoFim
  const bx = px - ux * ph
  const by = py - uy * ph

  const p = (x, y) => `${x.toFixed(3)},${y.toFixed(3)}`
  return [
    `M${p(tx + nx * lw, ty + ny * lw)}`,
    `L${p(bx + nx * lw, by + ny * lw)}`,
    `L${p(bx + nx * pw, by + ny * pw)}`,
    `L${p(px, py)}`,
    `L${p(bx - nx * pw, by - ny * pw)}`,
    `L${p(bx - nx * lw, by - ny * lw)}`,
    `L${p(tx - nx * lw, ty - ny * lw)}`,
    'Z',
  ].join(' ')
}

/**
 * Tabuleiro. As peças ficam posicionadas por transform em vez de dentro das
 * casas, o que permite animar o deslocamento de uma casa para outra.
 */
export default function Tabuleiro({
  pecas, // [{ id, casa, tipo, cor }]
  girado,
  selecionada,
  destinos, // Map casa -> { captura: boolean }
  ultimoLance, // { de, para }
  casaEmXeque,
  setas, // [{ de, para, tipo }]
  destaque, // casa em destaque temporário (dica)
  penduradas, // casas com peça sua em risco (modo treino)
  marcacoes, // { setas: [{de,para}], circulos: [casa] } desenhadas pelo usuário
  onMarcar,
  mostrarCoordenadas = true,
  onClicarCasa,
  bloqueado,
}) {
  const refTabuleiro = useRef(null)
  const [arrastando, setArrastando] = useState(null)
  // espelho do arraste em ref: o handler de soltar precisa ler o estado atual
  // sem disparar efeito colateral dentro do atualizador do React
  const refArraste = useRef(null)

  const posicaoDaCasa = useCallback(
    (casa) => {
      const col = COLUNAS.indexOf(casa[0])
      const lin = 8 - Number(casa[1])
      return girado ? { x: 7 - col, y: 7 - lin } : { x: col, y: lin }
    },
    [girado],
  )

  const casaNoPonto = useCallback(
    (clientX, clientY) => {
      const el = refTabuleiro.current
      if (!el) return null
      const r = el.getBoundingClientRect()
      const x = Math.floor(((clientX - r.left) / r.width) * 8)
      const y = Math.floor(((clientY - r.top) / r.height) * 8)
      if (x < 0 || x > 7 || y < 0 || y > 7) return null
      return girado ? casaDe(7 - x, 7 - y) : casaDe(x, y)
    },
    [girado],
  )

  // os ouvintes entram já no pointerdown: se esperassem o efeito do React,
  // um clique muito rápido soltaria o botão antes de existir quem escutasse
  const limparArraste = useRef(null)
  useEffect(() => () => limparArraste.current && limparArraste.current(), [])

  // botão direito desenha seta (arrastando) ou círculo (clicando)
  const inicioMarcacao = useRef(null)
  const aoPressionarDireito = (e) => {
    if (e.button !== 2) return
    e.preventDefault()
    inicioMarcacao.current = casaNoPonto(e.clientX, e.clientY)
  }
  const aoSoltarDireito = (e) => {
    if (e.button !== 2 || !onMarcar) return
    e.preventDefault()
    const inicio = inicioMarcacao.current
    inicioMarcacao.current = null
    const fim = casaNoPonto(e.clientX, e.clientY)
    if (!inicio || !fim) return
    if (inicio === fim) onMarcar({ tipo: 'circulo', casa: inicio })
    else onMarcar({ tipo: 'seta', de: inicio, para: fim })
  }

  const aoPressionar = (e, peca) => {
    if (e.button === 2) {
      aoPressionarDireito(e)
      return
    }
    if (bloqueado) return
    e.preventDefault()
    const inicial = { casa: peca.casa, id: peca.id, x: e.clientX, y: e.clientY, moveu: false }
    refArraste.current = inicial
    setArrastando(inicial)

    const mover = (ev) => {
      const a = refArraste.current
      if (!a) return
      const andou = a.moveu || Math.hypot(ev.clientX - a.x, ev.clientY - a.y) > 4
      const novo = { ...a, x: ev.clientX, y: ev.clientY, moveu: andou }
      refArraste.current = novo
      if (andou) setArrastando(novo)
    }
    const soltar = (ev) => {
      const a = refArraste.current
      encerrar()
      if (!a) return
      const alvo = casaNoPonto(ev.clientX, ev.clientY)
      if (a.moveu && alvo && alvo !== a.casa) onClicarCasa(alvo, { viaArraste: true, origem: a.casa })
      else if (!a.moveu) onClicarCasa(a.casa, {})
    }
    const encerrar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', soltar)
      limparArraste.current = null
      refArraste.current = null
      setArrastando(null)
    }
    limparArraste.current = encerrar
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', soltar)
  }

  const casas = []
  for (let lin = 0; lin < 8; lin++) {
    for (let col = 0; col < 8; col++) {
      const casa = girado ? casaDe(7 - col, 7 - lin) : casaDe(col, lin)
      const clara = (COLUNAS.indexOf(casa[0]) + Number(casa[1])) % 2 === 1
      const destino = destinos && destinos.get(casa)
      casas.push(
        <div
          key={casa}
          className={[
            'casa',
            clara ? 'casa-clara' : 'casa-escura',
            selecionada === casa ? 'casa-selecionada' : '',
            ultimoLance && (ultimoLance.de === casa || ultimoLance.para === casa) ? 'casa-ultimo' : '',
            casaEmXeque === casa ? 'casa-xeque' : '',
            destaque === casa ? 'casa-destaque' : '',
            penduradas && penduradas.includes(casa) ? 'casa-pendurada' : '',
            marcacoes && marcacoes.circulos.includes(casa) ? 'casa-circulada' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          data-casa={casa}
          onClick={() => !bloqueado && onClicarCasa(casa, {})}
        >
          {destino && <span className={destino.captura ? 'marca-captura' : 'marca-destino'} />}
          {mostrarCoordenadas && col === 0 && <span className="coord coord-linha">{casa[1]}</span>}
          {mostrarCoordenadas && lin === 7 && <span className="coord coord-coluna">{casa[0]}</span>}
        </div>,
      )
    }
  }

  const retangulo = refTabuleiro.current ? refTabuleiro.current.getBoundingClientRect() : null

  return (
    <div className="tabuleiro-moldura">
      <div
        className="tabuleiro"
        ref={refTabuleiro}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={aoPressionarDireito}
        onPointerUp={aoSoltarDireito}
      >
        <div className="grade">{casas}</div>

        {pecas.map((peca) => {
          const { x, y } = posicaoDaCasa(peca.casa)
          const sendoArrastada = arrastando && arrastando.id === peca.id && arrastando.moveu
          let estilo = {
            transform: `translate3d(${x * 100}%, ${y * 100}%, 0)`,
          }
          if (sendoArrastada && retangulo) {
            const tam = retangulo.width / 8
            estilo = {
              transform: `translate3d(${arrastando.x - retangulo.left - tam / 2}px, ${
                arrastando.y - retangulo.top - tam / 2
              }px, 0) scale(1.12)`,
              transition: 'none',
              zIndex: 40,
              cursor: 'grabbing',
            }
          }
          return (
            <div
              key={peca.id}
              className={[
                'suporte-peca',
                sendoArrastada ? 'arrastando' : '',
                selecionada === peca.casa ? 'peca-ativa' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={estilo}
              onPointerDown={(e) => aoPressionar(e, peca)}
            >
              <Peca tipo={peca.tipo} cor={peca.cor} />
            </div>
          )
        })}

        <svg className="camada-setas" viewBox="0 0 8 8" aria-hidden="true">
          <defs>
            <linearGradient id="setaMelhor" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff0c8" />
              <stop offset="100%" stopColor="#d8ab5c" />
            </linearGradient>
            <linearGradient id="setaOpcao" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#d9c9ff" />
              <stop offset="100%" stopColor="#8b46e0" />
            </linearGradient>
          </defs>
          {marcacoes &&
            marcacoes.setas.map((m, i) => (
              <path
                key={`m${i}`}
                d={caminhoDaSeta(posicaoDaCasa(m.de), posicaoDaCasa(m.para), true)}
                className="seta seta-usuario"
              />
            ))}
          {(setas || []).map((seta, i) => {
            const melhor = seta.tipo === 'melhor'
            return (
              <path
                key={`${seta.de}${seta.para}${i}`}
                d={caminhoDaSeta(posicaoDaCasa(seta.de), posicaoDaCasa(seta.para), melhor)}
                className={`seta ${melhor ? 'seta-melhor' : 'seta-opcao'}`}
                fill={melhor ? 'url(#setaMelhor)' : 'url(#setaOpcao)'}
                style={{ opacity: seta.opacidade ?? 1 }}
              />
            )
          })}
        </svg>
      </div>
    </div>
  )
}
