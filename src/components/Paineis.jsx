import { useEffect, useState } from 'react'
import { LEVEL_LIST } from '../engine/levels.js'
import { TEMAS, TEMPOS } from '../game/opcoes.js'
import { Relatorio } from './Relatorio.jsx'
import { Peca } from './Pecas.jsx'

export function Cabecalho({ abertura, acoes }) {
  return (
    <header className="cabecalho">
      {acoes && <div className="acoes-topo">{acoes}</div>}
      <div className="marca">
        <span className="marca-alvo" aria-hidden="true">
          <span className="anel" />
          <span className="anel anel-2" />
          <span className="miolo" />
        </span>
        <h1 className="wordmark">META ALVO</h1>
      </div>
      <p className="subtitulo">{abertura ? abertura.nome : 'XADREZ COM ANÁLISE INTELIGENTE'}</p>
    </header>
  )
}

export function BarraAvaliacao({ nota, mate, girado }) {
  // nota em centipeões do ponto de vista das brancas
  const limite = 800
  const preso = Math.max(-limite, Math.min(limite, nota))
  let fracaoBrancas = 50 + (preso / limite) * 48
  if (mate != null) fracaoBrancas = mate > 0 ? 100 : 0
  const texto = mate != null ? `M${Math.abs(mate)}` : `${nota >= 0 ? '+' : ''}${(nota / 100).toFixed(1)}`
  return (
    <div className={`barra-aval ${girado ? 'girada' : ''}`} title="Avaliação da posição">
      <div className="barra-aval-trilho">
        <div className="barra-aval-brancas" style={{ height: `${fracaoBrancas}%` }} />
      </div>
      <span className="barra-aval-texto">{texto}</span>
    </div>
  )
}

export function SeletorNivel({ nivel, onMudar, bloqueado }) {
  return (
    <div className="bloco">
      <h2 className="titulo-bloco">Dificuldade</h2>
      <div className="niveis">
        {LEVEL_LIST.map((n) => (
          <button
            key={n.id}
            className={`nivel ${nivel === n.id ? 'nivel-ativo' : ''}`}
            onClick={() => onMudar(n.id)}
            disabled={bloqueado}
            title={n.descricao}
          >
            <span className="nivel-nome">{n.nome}</span>
            <span className="nivel-forca" aria-hidden="true">
              {[1, 2, 3].map((i) => (
                <i key={i} className={i <= n.forca ? 'cheio' : ''} />
              ))}
            </span>
          </button>
        ))}
      </div>
      <p className="nivel-descricao">{LEVEL_LIST.find((n) => n.id === nivel).descricao}</p>
    </div>
  )
}

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

export function Selo({ veredito, tamanho = 'normal' }) {
  if (!veredito) return null
  return (
    <span className={`selo ${CLASSE_VEREDITO[veredito.chave]} selo-${tamanho}`}>
      <span className="selo-icone">{veredito.icone}</span>
      <span className="selo-texto">{veredito.rotulo}</span>
    </span>
  )
}

/** Controles da demonstração, no lugar dos botões normais enquanto ela roda. */
export function ControlesDemo({ demo, onPasso, onAlternar, onFechar }) {
  const total = demo.passos.length - 1
  const passo = demo.passos[demo.indice]
  const acabou = demo.indice >= total
  return (
    <div className="painel-demo">
      <div className="demo-cabeca">
        <span className="demo-titulo">{demo.titulo}</span>
        <span className="demo-legenda">{demo.legenda}</span>
      </div>

      <div className="demo-trilha">
        {demo.passos.slice(1).map((p, i) => (
          <button
            key={i}
            className={`demo-passo ${i + 1 === demo.indice ? 'atual' : ''} ${i + 1 < demo.indice ? 'passado' : ''}`}
            onClick={() => onPasso(i + 1)}
          >
            {p.san}
          </button>
        ))}
      </div>

      <div className="demo-controles">
        <button className="botao botao-fantasma" onClick={() => onPasso(demo.indice - 1)} disabled={demo.indice === 0}>
          ‹ Voltar
        </button>
        <button className="botao botao-ouro" onClick={onAlternar}>
          {demo.tocando ? '❚❚ Pausar' : acabou ? '↻ Repetir' : '▶ Continuar'}
        </button>
        <button className="botao botao-fantasma" onClick={() => onPasso(demo.indice + 1)} disabled={acabou}>
          Avançar ›
        </button>
        <button className="botao botao-roxo" onClick={onFechar}>
          Voltar para a partida
        </button>
      </div>

      <p className="demo-rodape">
        {passo.lance ? (
          <>
            Lance {demo.indice} de {total}: <strong>{passo.san}</strong>
          </>
        ) : (
          <>Posição atual da partida. O lance sugerido começa agora.</>
        )}
      </p>
    </div>
  )
}

export function PainelAnalise({ analise, pensando, analisando, vez, corJogador, onDemonstrar }) {
  return (
    <div className="bloco bloco-analise">
      <h2 className="titulo-bloco">
        Análise da IA
        {(analisando || pensando) && <span className="pulso-carregando" aria-hidden="true" />}
      </h2>

      {pensando && <p className="estado-motor">O bot está calculando a resposta…</p>}
      {!pensando && analisando && <p className="estado-motor">Avaliando a posição…</p>}

      {!analise && !pensando && !analisando && (
        <p className="vazio">
          {vez === corJogador
            ? 'Faça seu lance. Assim que jogar, eu digo se foi bom ou ruim e o que era melhor.'
            : 'Aguardando o bot.'}
        </p>
      )}

      {analise && (
        <div className="analise-corpo">
          <div className="analise-topo">
            <Selo veredito={analise.veredito} tamanho="grande" />
            <span className="analise-lance">{analise.sanPt}</span>
          </div>
          <p className="analise-texto">{analise.texto}</p>
          {onDemonstrar && (
            <button className="botao botao-ouro botao-demo" onClick={onDemonstrar}>
              <span className="icone-botao">▶</span> Ver no tabuleiro como era melhor
            </button>
          )}
          <div className="analise-numeros">
            <span>
              Avaliação <strong>{analise.notaTexto}</strong>
            </span>
            {analise.veredito.perdaWp > 0.5 && (
              <span>
                Perda <strong>{analise.veredito.perdaWp.toFixed(1)}%</strong>
              </span>
            )}
            <span>
              Profundidade <strong>{analise.prof}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export function PainelJogadas({ jogadas, aberto, onFechar, onDestacar, indiceDestacado, onDemonstrar }) {
  if (!aberto) return null
  return (
    <div className="bloco bloco-jogadas">
      <h2 className="titulo-bloco">
        Jogadas possíveis
        <button className="fechar" onClick={onFechar} aria-label="Fechar">
          ×
        </button>
      </h2>
      {!jogadas.length && <p className="vazio">Analisando as opções…</p>}
      {!!jogadas.length && <p className="dica-jogadas">Clique em uma linha para ver ela acontecendo no tabuleiro.</p>}
      <ul className="lista-jogadas">
        {jogadas.map((j, i) => (
          <li
            key={j.uci}
            className={`item-jogada clicavel ${indiceDestacado === i ? 'destacado' : ''} ${i === 0 ? 'primeira' : ''}`}
            onMouseEnter={() => onDestacar(i)}
            onMouseLeave={() => onDestacar(null)}
            onClick={() => onDemonstrar && onDemonstrar(j)}
            title="Ver essa linha no tabuleiro"
          >
            <span className="posicao-jogada">{i + 1}</span>
            <span className="san-jogada">{j.sanPt}</span>
            <span className={`nota-jogada ${j.nota >= 0 ? 'positiva' : 'negativa'}`}>{j.notaTexto}</span>
            <span className="motivo-jogada">{j.motivo}</span>
            <span className="barra-jogada">
              <i style={{ width: `${j.forca}%` }} />
            </span>
            {j.pv && <span className="pv-jogada">{j.pv}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Historico({ lances, indiceAtual, onSelecionar }) {
  const pares = []
  for (let i = 0; i < lances.length; i += 2) {
    pares.push([
      { lance: lances[i], indice: i + 1 },
      { lance: lances[i + 1], indice: i + 2 },
    ])
  }
  return (
    <div className="bloco bloco-historico">
      <h2 className="titulo-bloco">Histórico</h2>
      {!lances.length && <p className="vazio">Nenhum lance ainda. Use ← e → para navegar depois.</p>}
      <ol className="lista-historico">
        {pares.map((par, i) => (
          <li key={i}>
            <span className="numero-lance">{i + 1}.</span>
            {par.map(({ lance, indice }, j) =>
              lance ? (
                <button
                  key={j}
                  className={`lance-historico ${lance.veredito ? CLASSE_VEREDITO[lance.veredito.chave] : ''} ${
                    indiceAtual === indice ? 'lance-atual' : ''
                  }`}
                  onClick={() => onSelecionar && onSelecionar(indice)}
                  title={lance.texto || 'Ver esta posição'}
                >
                  {lance.sanPt}
                  {lance.veredito && <i className="micro-selo">{lance.veredito.icone}</i>}
                </button>
              ) : (
                <span key={j} className="lance-vazio" />
              ),
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

export function Capturadas({ pecas, cor, vantagem }) {
  const ordem = ['q', 'r', 'b', 'n', 'p']
  const lista = [...pecas].sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b))
  return (
    <div className="capturadas">
      {lista.map((p, i) => (
        <span key={i} className="capturada">
          <Peca tipo={p} cor={cor} />
        </span>
      ))}
      {vantagem > 0 && <span className="vantagem">+{vantagem}</span>}
    </div>
  )
}

/** Bloco recolhível com o que a pessoa mexe uma vez e esquece. */
export function Ajustes({
  corJogador,
  onCor,
  tempoId,
  onTempo,
  tema,
  onTema,
  coordenadas,
  onCoordenadas,
  treino,
  onTreino,
  som,
  onSom,
  onCopiarPgn,
  avisoCopia,
  temLances,
}) {
  const [aberto, setAberto] = useState(false)
  return (
    <div className="bloco bloco-ajustes">
      <h2 className="titulo-bloco">
        Ajustes
        <button className="fechar" onClick={() => setAberto((a) => !a)} aria-label="Abrir ajustes">
          {aberto ? '−' : '+'}
        </button>
      </h2>

      {aberto && (
        <div className="ajustes-corpo">
          <div className="ajuste">
            <span className="ajuste-rotulo">Suas peças</span>
            <div className="ajuste-opcoes">
              <button className={`chip ${corJogador === 'w' ? 'chip-ativo' : ''}`} onClick={() => onCor('w')}>
                Brancas
              </button>
              <button className={`chip ${corJogador === 'b' ? 'chip-ativo' : ''}`} onClick={() => onCor('b')}>
                Pretas
              </button>
            </div>
          </div>

          <div className="ajuste">
            <span className="ajuste-rotulo">Ritmo</span>
            <div className="ajuste-opcoes">
              {TEMPOS.map((t) => (
                <button
                  key={t.id}
                  className={`chip ${tempoId === t.id ? 'chip-ativo' : ''}`}
                  onClick={() => onTempo(t.id)}
                >
                  {t.rotulo}
                </button>
              ))}
            </div>
          </div>

          <div className="ajuste">
            <span className="ajuste-rotulo">Tabuleiro</span>
            <div className="ajuste-opcoes">
              {TEMAS.map((t) => (
                <button key={t.id} className={`chip ${tema === t.id ? 'chip-ativo' : ''}`} onClick={() => onTema(t.id)}>
                  {t.rotulo}
                </button>
              ))}
            </div>
          </div>

          <div className="ajuste">
            <span className="ajuste-rotulo">Extras</span>
            <div className="ajuste-opcoes">
              <button className={`chip ${treino ? 'chip-ativo' : ''}`} onClick={() => onTreino(!treino)}>
                Modo treino
              </button>
              <button className={`chip ${coordenadas ? 'chip-ativo' : ''}`} onClick={() => onCoordenadas(!coordenadas)}>
                Coordenadas
              </button>
              <button className={`chip ${som ? 'chip-ativo' : ''}`} onClick={() => onSom(!som)}>
                Som
              </button>
            </div>
          </div>

          <p className="ajuste-nota">
            Modo treino acende em vermelho as suas peças que o bot pode capturar ganhando material.
          </p>

          <button className="botao botao-fantasma botao-largo" onClick={onCopiarPgn} disabled={!temLances}>
            {avisoCopia || 'Copiar PGN da partida'}
          </button>
        </div>
      )}
    </div>
  )
}

export function DialogoPromocao({ cor, onEscolher, onCancelar }) {
  return (
    <div className="modal-fundo" onClick={onCancelar}>
      <div className="modal-promocao" onClick={(e) => e.stopPropagation()}>
        <h3>Escolha a peça</h3>
        <div className="opcoes-promocao">
          {['q', 'r', 'b', 'n'].map((t) => (
            <button key={t} onClick={() => onEscolher(t)} className="opcao-promocao">
              <Peca tipo={t} cor={cor} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function FimDeJogo({ resultado, resumo, onNovaPartida, onRevisar }) {
  const [fechado, setFechado] = useState(false)
  useEffect(() => {
    setFechado(false)
  }, [resultado && resultado.titulo])
  if (!resultado || fechado) return null
  return (
    <div className="modal-fundo">
      <div className="modal-fim">
        <span className={`faixa-resultado ${resultado.vitoria ? 'venceu' : ''}`}>
          {resultado.vitoria ? 'Vitória' : 'Fim de partida'}
        </span>
        <h3>{resultado.titulo}</h3>
        <p>{resultado.detalhe}</p>
        <Relatorio resumo={resumo} compacto />
        <div className="acoes-fim">
          <button
            className="botao botao-fantasma"
            onClick={() => {
              setFechado(true)
              onRevisar && onRevisar()
            }}
          >
            Revisar lances
          </button>
          <button className="botao botao-ouro" onClick={onNovaPartida}>
            Nova partida
          </button>
        </div>
      </div>
    </div>
  )
}
