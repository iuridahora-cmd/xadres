import { CATEGORIAS, faixaDePrecisao } from '../game/precisao.js'

const CLASSE_VEREDITO = {
  brilhante: 'v-brilhante',
  melhor: 'v-melhor',
  excelente: 'v-excelente',
  boa: 'v-boa',
  livro: 'v-boa',
  forcado: 'v-neutro',
  imprecisao: 'v-imprecisao',
  erro: 'v-erro',
  errograve: 'v-errograve',
}

/** Relógio de um dos lados. */
export function Relogio({ ms, ativo, esgotado, rotulo }) {
  const total = Math.max(0, ms)
  const minutos = Math.floor(total / 60000)
  const segundos = Math.floor((total % 60000) / 1000)
  const decimos = Math.floor((total % 1000) / 100)
  const critico = total <= 20000
  return (
    <span
      className={`relogio ${ativo ? 'relogio-ativo' : ''} ${critico ? 'relogio-critico' : ''} ${
        esgotado ? 'relogio-zerado' : ''
      }`}
      title={rotulo}
    >
      {minutos}:{String(segundos).padStart(2, '0')}
      {critico && !esgotado && <i className="decimos">.{decimos}</i>}
    </span>
  )
}

/**
 * Gráfico da avaliação lance a lance. Acima da linha do meio as brancas
 * estão melhor, abaixo as pretas. Clicar salta para aquele lance.
 */
export function GraficoAvaliacao({ pontos, indiceAtual, onSelecionar, girado }) {
  if (pontos.length < 2) return null
  const largura = 300
  const altura = 84
  const limite = 600

  const y = (cp) => {
    const preso = Math.max(-limite, Math.min(limite, cp))
    const bruto = altura / 2 - (preso / limite) * (altura / 2 - 4)
    return girado ? altura - bruto : bruto
  }
  const x = (i) => (i / (pontos.length - 1)) * largura

  const linha = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.nota).toFixed(1)}`).join(' ')
  const areaCima = `${linha} L${largura},${y(0)} L0,${y(0)} Z`

  return (
    <div className="bloco bloco-grafico">
      <h2 className="titulo-bloco">Como a partida oscilou</h2>
      <svg className="grafico" viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaBrancas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e7c98a" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#e7c98a" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1="0" y1={altura / 2} x2={largura} y2={altura / 2} className="grafico-meio" />
        <path d={areaCima} fill="url(#areaBrancas)" />
        <path d={linha} className="grafico-linha" />
        {pontos.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.nota)}
            r={i === indiceAtual ? 4 : 2.4}
            className={`grafico-ponto ${p.veredito ? CLASSE_VEREDITO[p.veredito] : ''} ${
              i === indiceAtual ? 'atual' : ''
            }`}
            onClick={() => onSelecionar && onSelecionar(i)}
          >
            <title>{p.rotulo}</title>
          </circle>
        ))}
      </svg>
      <p className="grafico-legenda">Clique em qualquer ponto para ver a posição daquele lance.</p>
    </div>
  )
}

function BarraPrecisao({ valor, rotulo, destaque }) {
  const faixa = faixaDePrecisao(valor)
  return (
    <div className="precisao-linha">
      <span className="precisao-rotulo">{rotulo}</span>
      <span className="precisao-trilho">
        <i style={{ width: `${valor == null ? 0 : valor}%` }} className={destaque ? 'ouro' : 'roxo'} />
      </span>
      <span className={`precisao-valor ${faixa.classe}`}>{valor == null ? '-' : `${valor.toFixed(1)}%`}</span>
    </div>
  )
}

/** Relatório com precisão e contagem de lances por qualidade. */
export function Relatorio({ resumo, compacto }) {
  if (!resumo || (!resumo.lances.jogador && !resumo.lances.bot)) return null
  const faixa = faixaDePrecisao(resumo.precisao.jogador)
  return (
    <div className={compacto ? 'relatorio' : 'bloco relatorio'}>
      {!compacto && <h2 className="titulo-bloco">Relatório da partida</h2>}
      <BarraPrecisao valor={resumo.precisao.jogador} rotulo="Você" destaque />
      <BarraPrecisao valor={resumo.precisao.bot} rotulo="Bot" />
      {resumo.precisao.jogador != null && (
        <p className="precisao-frase">
          Sua precisão foi <strong className={faixa.classe}>{faixa.rotulo}</strong> em {resumo.lances.jogador} lances.
        </p>
      )}
      <table className="tabela-categorias">
        <tbody>
          {CATEGORIAS.filter((c) => resumo.contagem.jogador[c.chave] || resumo.contagem.bot[c.chave]).map((c) => (
            <tr key={c.chave}>
              <td className={CLASSE_VEREDITO[c.chave]}>
                <i className="micro-selo">{c.icone}</i> {c.rotulo}
              </td>
              <td className="numero">{resumo.contagem.jogador[c.chave]}</td>
              <td className="numero fraco">{resumo.contagem.bot[c.chave]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tabela-cabeca">
        <span>categoria</span>
        <span>você</span>
        <span>bot</span>
      </p>
    </div>
  )
}
