import { useEffect, useRef, useState } from 'react'
import {
  CLIENT_ID,
  ETIQUETAS,
  PATENTES,
  carregarGoogle,
  etiquetaDe,
  lerTokenGoogle,
  patenteDe,
  perfilConvidado,
  pontosDe,
  precisaoMediaDe,
} from '../game/perfil.js'

function Avatar({ perfil, tamanho = 34 }) {
  const iniciais = (perfil?.nome || 'C')
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
  if (perfil?.foto) {
    return (
      <img
        className="avatar"
        src={perfil.foto}
        alt=""
        style={{ width: tamanho, height: tamanho }}
        referrerPolicy="no-referrer"
      />
    )
  }
  return (
    <span className="avatar avatar-inicial" style={{ width: tamanho, height: tamanho }} aria-hidden="true">
      {iniciais}
    </span>
  )
}

export function Etiqueta({ perfil, tamanho = 'normal' }) {
  const etiqueta = etiquetaDe(perfil)
  return (
    <span className={`etiqueta ${etiqueta.classe} etiqueta-${tamanho}`} title={etiqueta.descricao}>
      {etiqueta.rotulo}
    </span>
  )
}

/** Chip do cabeçalho: avatar, nome e etiqueta. */
export function ChipPerfil({ perfil, onAbrir }) {
  return (
    <button className="chip-perfil" onClick={onAbrir} title="Ver perfil">
      <Avatar perfil={perfil} tamanho={30} />
      <span className="chip-texto">
        <span className="chip-nome">{perfil ? perfil.nome.split(' ')[0] : 'Entrar'}</span>
        {perfil && <Etiqueta perfil={perfil} tamanho="mini" />}
      </span>
    </button>
  )
}

/**
 * Botão do Google. Quando não há client id configurado, mostra o caminho
 * para configurar em vez de um botão que não funcionaria.
 */
function BotaoGoogle({ onPerfil, onErro }) {
  const alvo = useRef(null)
  const [estado, setEstado] = useState(CLIENT_ID ? 'carregando' : 'sem-config')

  useEffect(() => {
    if (!CLIENT_ID) return
    let vivo = true
    carregarGoogle()
      .then((google) => {
        if (!vivo || !alvo.current) return
        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (resposta) => {
            try {
              onPerfil(lerTokenGoogle(resposta.credential))
            } catch (e) {
              onErro('não deu para ler a resposta do Google')
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        google.accounts.id.renderButton(alvo.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          locale: 'pt-BR',
          width: 260,
        })
        setEstado('pronto')
      })
      .catch(() => {
        if (vivo) setEstado('erro')
      })
    return () => {
      vivo = false
    }
  }, [onPerfil, onErro])

  if (estado === 'sem-config') {
    return (
      <div className="aviso-config">
        <strong>Login do Google ainda não configurado.</strong>
        <p>
          Crie um OAuth Client ID do tipo <em>Web application</em> no Google Cloud Console, libere a origem
          <code>http://localhost:5173</code> e coloque a chave em um arquivo <code>.env</code> na raiz do projeto:
        </p>
        <pre>VITE_GOOGLE_CLIENT_ID=seu-id.apps.googleusercontent.com</pre>
        <p>O passo a passo completo está no README.</p>
      </div>
    )
  }

  if (estado === 'erro') {
    return <p className="aviso-erro">Não foi possível falar com o Google. Verifique a conexão e recarregue.</p>
  }

  return <div className="alvo-google" ref={alvo} />
}

/** Tela de entrada, mostrada na primeira visita. */
export function ModalLogin({ aberto, onPerfil, onConvidado, onFechar }) {
  const [erro, setErro] = useState(null)
  if (!aberto) return null
  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className="modal-conta" onClick={(e) => e.stopPropagation()}>
        <span className="marca-alvo modal-alvo" aria-hidden="true">
          <span className="anel" />
          <span className="anel anel-2" />
          <span className="miolo" />
        </span>
        <h3>Bem-vindo ao Xadrez da Meta Alvo</h3>
        <p className="modal-sub">
          Entre com o Google para ter perfil, etiqueta e histórico de partidas. Quem usa e-mail{' '}
          <strong>@metaalvo.com</strong> recebe a etiqueta META PLAYER.
        </p>

        <div className="area-login">
          <BotaoGoogle onPerfil={onPerfil} onErro={setErro} />
          {erro && <p className="aviso-erro">{erro}</p>}
        </div>

        <button className="botao botao-fantasma botao-largo" onClick={() => onConvidado(perfilConvidado())}>
          Jogar sem conta
        </button>

        <p className="nota-privacidade">
          Nada sai do seu navegador. O perfil e as estatísticas ficam salvos só neste computador.
        </p>
      </div>
    </div>
  )
}

function Numero({ valor, rotulo, destaque }) {
  return (
    <div className={`cartao-numero ${destaque ? 'destaque' : ''}`}>
      <strong>{valor}</strong>
      <span>{rotulo}</span>
    </div>
  )
}

/** Perfil completo com estatísticas e patente. */
export function ModalPerfil({ aberto, perfil, estatisticas, onSair, onTrocarConta, onFechar }) {
  if (!aberto || !perfil) return null
  const media = precisaoMediaDe(estatisticas)
  const pontos = pontosDe(estatisticas)
  const patente = patenteDe(pontos)
  const aproveitamento = estatisticas.partidas
    ? Math.round((estatisticas.vitorias / estatisticas.partidas) * 100)
    : 0

  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className="modal-perfil" onClick={(e) => e.stopPropagation()}>
        <button className="fechar fechar-canto" onClick={onFechar} aria-label="Fechar">
          ×
        </button>

        <div className="perfil-topo">
          <Avatar perfil={perfil} tamanho={62} />
          <div className="perfil-identidade">
            <h3>{perfil.nome}</h3>
            {perfil.email && <span className="perfil-email">{perfil.email}</span>}
            <Etiqueta perfil={perfil} />
          </div>
        </div>

        <div className="patente">
          <div className="patente-linha">
            <span className="patente-nome">{patente.atual.nome}</span>
            <span className="patente-pontos">{pontos} pts</span>
          </div>
          <span className="patente-trilho">
            <i style={{ width: `${patente.progresso}%` }} />
          </span>
          <span className="patente-proxima">
            {patente.proxima
              ? `faltam ${patente.proxima.minimo - pontos} pts para ${patente.proxima.nome}`
              : 'patente máxima alcançada'}
          </span>
        </div>

        <div className="grade-numeros">
          <Numero valor={estatisticas.partidas} rotulo="partidas" />
          <Numero valor={estatisticas.vitorias} rotulo="vitórias" destaque />
          <Numero valor={estatisticas.empates} rotulo="empates" />
          <Numero valor={estatisticas.derrotas} rotulo="derrotas" />
          <Numero valor={`${aproveitamento}%`} rotulo="aproveitamento" />
          <Numero valor={media == null ? '-' : `${media.toFixed(1)}%`} rotulo="precisão média" destaque />
          <Numero
            valor={estatisticas.melhorPrecisao ? `${estatisticas.melhorPrecisao.toFixed(1)}%` : '-'}
            rotulo="melhor partida"
          />
          <Numero valor={estatisticas.melhorSequencia} rotulo="melhor sequência" />
        </div>

        <h4 className="titulo-menor">Por dificuldade</h4>
        <table className="tabela-niveis">
          <thead>
            <tr>
              <th>nível</th>
              <th>V</th>
              <th>E</th>
              <th>D</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['iniciante', 'Iniciante'],
              ['intermediario', 'Intermediário'],
              ['avancado', 'Avançado'],
            ].map(([chave, rotulo]) => (
              <tr key={chave}>
                <td>{rotulo}</td>
                <td className="ganhou">{estatisticas.porNivel[chave].v}</td>
                <td>{estatisticas.porNivel[chave].e}</td>
                <td className="perdeu">{estatisticas.porNivel[chave].d}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="acoes-perfil">
          <button className="botao botao-fantasma" onClick={onTrocarConta}>
            Trocar de conta
          </button>
          <button className="botao botao-fantasma" onClick={onSair}>
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}

export { ETIQUETAS, PATENTES }
