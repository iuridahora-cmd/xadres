import { TEMAS, TEMPOS } from '../game/opcoes.js'
import { LEVEL_LIST } from '../engine/levels.js'

function Grupo({ titulo, descricao, children }) {
  return (
    <section className="grupo-config">
      <h4>{titulo}</h4>
      {descricao && <p className="grupo-descricao">{descricao}</p>}
      <div className="grupo-opcoes">{children}</div>
    </section>
  )
}

function Interruptor({ ligado, onMudar, rotulo, descricao }) {
  return (
    <button className={`interruptor ${ligado ? 'ligado' : ''}`} onClick={() => onMudar(!ligado)} role="switch" aria-checked={ligado}>
      <span className="interruptor-trilho">
        <i />
      </span>
      <span className="interruptor-texto">
        <strong>{rotulo}</strong>
        {descricao && <small>{descricao}</small>}
      </span>
    </button>
  )
}

/**
 * Tudo que a pessoa configura, num modal só, separado por assunto.
 * As opções que recomeçam a partida ficam agrupadas e avisadas.
 */
export default function Configuracoes({
  aberto,
  onFechar,
  nivel,
  onNivel,
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
  velocidade,
  onVelocidade,
  tamanhoTabuleiro,
  onTamanhoTabuleiro,
  onCopiarPgn,
  temLances,
}) {
  if (!aberto) return null
  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className="modal-config" onClick={(e) => e.stopPropagation()}>
        <header className="config-cabeca">
          <h3>Configurações</h3>
          <button className="fechar" onClick={onFechar} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className="config-corpo">
          <Grupo titulo="Partida" descricao="Mudar qualquer uma destas começa uma partida nova.">
            <div className="linha-config">
              <span className="rotulo-config">Dificuldade</span>
              <div className="opcoes-config">
                {LEVEL_LIST.map((n) => (
                  <button
                    key={n.id}
                    className={`chip ${nivel === n.id ? 'chip-ativo' : ''}`}
                    onClick={() => onNivel(n.id)}
                    title={n.descricao}
                  >
                    {n.nome}
                  </button>
                ))}
              </div>
            </div>
            <div className="linha-config">
              <span className="rotulo-config">Suas peças</span>
              <div className="opcoes-config">
                <button className={`chip ${corJogador === 'w' ? 'chip-ativo' : ''}`} onClick={() => onCor('w')}>
                  Brancas
                </button>
                <button className={`chip ${corJogador === 'b' ? 'chip-ativo' : ''}`} onClick={() => onCor('b')}>
                  Pretas
                </button>
              </div>
            </div>
            <div className="linha-config">
              <span className="rotulo-config">Ritmo</span>
              <div className="opcoes-config">
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
          </Grupo>

          <Grupo titulo="Aparência">
            <div className="linha-config">
              <span className="rotulo-config">Tabuleiro</span>
              <div className="opcoes-config">
                {TEMAS.map((t) => (
                  <button key={t.id} className={`chip ${tema === t.id ? 'chip-ativo' : ''}`} onClick={() => onTema(t.id)}>
                    {t.rotulo}
                  </button>
                ))}
              </div>
            </div>
            <div className="linha-config">
              <span className="rotulo-config">Tamanho</span>
              <div className="opcoes-config">
                {[
                  ['compacto', 'Compacto'],
                  ['normal', 'Normal'],
                  ['grande', 'Grande'],
                ].map(([id, rotulo]) => (
                  <button
                    key={id}
                    className={`chip ${tamanhoTabuleiro === id ? 'chip-ativo' : ''}`}
                    onClick={() => onTamanhoTabuleiro(id)}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            </div>
            <div className="linha-config">
              <span className="rotulo-config">Animação</span>
              <div className="opcoes-config">
                {[
                  ['rapida', 'Rápida'],
                  ['normal', 'Normal'],
                  ['lenta', 'Lenta'],
                ].map(([id, rotulo]) => (
                  <button
                    key={id}
                    className={`chip ${velocidade === id ? 'chip-ativo' : ''}`}
                    onClick={() => onVelocidade(id)}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            </div>
            <Interruptor
              ligado={coordenadas}
              onMudar={onCoordenadas}
              rotulo="Coordenadas"
              descricao="Letras e números nas bordas do tabuleiro"
            />
          </Grupo>

          <Grupo titulo="Ajuda e áudio">
            <Interruptor
              ligado={treino}
              onMudar={onTreino}
              rotulo="Modo treino"
              descricao="Acende suas peças que o bot pode capturar ganhando material"
            />
            <Interruptor ligado={som} onMudar={onSom} rotulo="Som" descricao="Efeitos de lance, captura e xeque" />
          </Grupo>

          <Grupo titulo="Partida atual">
            <button className="botao botao-fantasma botao-largo" onClick={onCopiarPgn} disabled={!temLances}>
              Copiar PGN
            </button>
          </Grupo>
        </div>
      </div>
    </div>
  )
}
