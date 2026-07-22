/**
 * Conta, perfil e estatísticas.
 *
 * O login usa o Google Identity Services direto no navegador. O token que o
 * Google devolve é um JWT assinado; aqui a gente só lê o conteúdo dele para
 * montar o perfil. Isso basta para personalizar a tela, mas NÃO é verificação
 * de identidade: sem um servidor conferindo a assinatura, a etiqueta é
 * enfeite e pode ser forjada por quem abrir o console. Está documentado no
 * README.
 */

const CHAVE_PERFIL = 'meta-alvo-xadrez-perfil'
const CHAVE_ESTATISTICAS = 'meta-alvo-xadrez-estatisticas'

export const DOMINIO_INTERNO = 'metaalvo.com'

export const ETIQUETAS = {
  meta: {
    id: 'meta',
    rotulo: 'META PLAYER',
    descricao: 'Conta do domínio metaalvo.com',
    classe: 'etiqueta-meta',
  },
  normal: {
    id: 'normal',
    rotulo: 'NORMAL PLAYER',
    descricao: 'Conta de fora da Meta Alvo',
    classe: 'etiqueta-normal',
  },
  convidado: {
    id: 'convidado',
    rotulo: 'CONVIDADO',
    descricao: 'Jogando sem conta, o progresso fica só neste navegador',
    classe: 'etiqueta-convidado',
  },
}

/** Decide a etiqueta pelo e-mail (ou pelo domínio do Workspace). */
export function etiquetaDe(perfil) {
  if (!perfil) return ETIQUETAS.convidado
  if (perfil.convidado) return ETIQUETAS.convidado
  const email = (perfil.email || '').toLowerCase().trim()
  const dominio = (perfil.hd || '').toLowerCase().trim()
  if (dominio === DOMINIO_INTERNO || email.endsWith(`@${DOMINIO_INTERNO}`)) return ETIQUETAS.meta
  return ETIQUETAS.normal
}

/** Lê o payload de um JWT sem validar assinatura (só para exibição). */
export function lerTokenGoogle(credential) {
  const partes = credential.split('.')
  if (partes.length < 2) throw new Error('token em formato inesperado')
  const base = partes[1].replace(/-/g, '+').replace(/_/g, '/')
  const preenchido = base + '='.repeat((4 - (base.length % 4)) % 4)
  const json = decodeURIComponent(
    atob(preenchido)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join(''),
  )
  const dados = JSON.parse(json)
  return {
    id: dados.sub,
    nome: dados.name || dados.given_name || 'Jogador',
    email: dados.email || '',
    foto: dados.picture || null,
    hd: dados.hd || '',
    emailVerificado: !!dados.email_verified,
    convidado: false,
    entrouEm: new Date().toISOString(),
  }
}

export function perfilConvidado() {
  return {
    id: 'convidado',
    nome: 'Convidado',
    email: '',
    foto: null,
    convidado: true,
    entrouEm: new Date().toISOString(),
  }
}

export function salvarPerfil(perfil) {
  try {
    if (perfil) localStorage.setItem(CHAVE_PERFIL, JSON.stringify(perfil))
    else localStorage.removeItem(CHAVE_PERFIL)
  } catch {
    /* sem armazenamento disponível */
  }
}

export function lerPerfil() {
  try {
    const cru = localStorage.getItem(CHAVE_PERFIL)
    return cru ? JSON.parse(cru) : null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Estatísticas por perfil                                             */
/* ------------------------------------------------------------------ */

export function estatisticasVazias() {
  return {
    partidas: 0,
    vitorias: 0,
    derrotas: 0,
    empates: 0,
    precisaoSoma: 0,
    precisaoContagem: 0,
    melhorPrecisao: 0,
    sequencia: 0,
    melhorSequencia: 0,
    brilhantes: 0,
    porNivel: {
      iniciante: { v: 0, d: 0, e: 0 },
      intermediario: { v: 0, d: 0, e: 0 },
      avancado: { v: 0, d: 0, e: 0 },
    },
  }
}

function todasEstatisticas() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_ESTATISTICAS) || '{}')
  } catch {
    return {}
  }
}

export function lerEstatisticas(perfilId) {
  const todas = todasEstatisticas()
  return { ...estatisticasVazias(), ...(todas[perfilId || 'convidado'] || {}) }
}

export function gravarEstatisticas(perfilId, dados) {
  const todas = todasEstatisticas()
  todas[perfilId || 'convidado'] = dados
  try {
    localStorage.setItem(CHAVE_ESTATISTICAS, JSON.stringify(todas))
  } catch {
    /* sem armazenamento */
  }
  return dados
}

/**
 * Soma uma partida encerrada às estatísticas.
 * @param {'vitoria'|'derrota'|'empate'} desfecho
 */
export function registrarPartida(perfilId, { desfecho, nivel, precisao, brilhantes = 0 }) {
  const atual = lerEstatisticas(perfilId)
  const novo = {
    ...atual,
    partidas: atual.partidas + 1,
    vitorias: atual.vitorias + (desfecho === 'vitoria' ? 1 : 0),
    derrotas: atual.derrotas + (desfecho === 'derrota' ? 1 : 0),
    empates: atual.empates + (desfecho === 'empate' ? 1 : 0),
    brilhantes: atual.brilhantes + brilhantes,
    porNivel: { ...atual.porNivel },
  }
  if (precisao != null) {
    novo.precisaoSoma = atual.precisaoSoma + precisao
    novo.precisaoContagem = atual.precisaoContagem + 1
    novo.melhorPrecisao = Math.max(atual.melhorPrecisao, precisao)
  }
  novo.sequencia = desfecho === 'vitoria' ? atual.sequencia + 1 : 0
  novo.melhorSequencia = Math.max(atual.melhorSequencia, novo.sequencia)

  const chaveNivel = novo.porNivel[nivel] ? nivel : 'intermediario'
  const linha = { ...novo.porNivel[chaveNivel] }
  if (desfecho === 'vitoria') linha.v++
  else if (desfecho === 'derrota') linha.d++
  else linha.e++
  novo.porNivel[chaveNivel] = linha

  return gravarEstatisticas(perfilId, novo)
}

export function precisaoMediaDe(estatisticas) {
  if (!estatisticas.precisaoContagem) return null
  return estatisticas.precisaoSoma / estatisticas.precisaoContagem
}

/* ------------------------------------------------------------------ */
/* Progressão                                                          */
/* ------------------------------------------------------------------ */

const PESO_NIVEL = { iniciante: 1, intermediario: 3, avancado: 6 }

export const PATENTES = [
  { minimo: 0, nome: 'Iniciante da casa' },
  { minimo: 6, nome: 'Peão avançado' },
  { minimo: 18, nome: 'Cavalo de batalha' },
  { minimo: 40, nome: 'Bispo estrategista' },
  { minimo: 75, nome: 'Torre da Meta Alvo' },
  { minimo: 130, nome: 'Dama do tabuleiro' },
  { minimo: 220, nome: 'Mestre da Meta Alvo' },
]

/** Pontos por vitória, pesados pela dificuldade, mais empates valendo pouco. */
export function pontosDe(estatisticas) {
  let total = 0
  for (const [nivel, linha] of Object.entries(estatisticas.porNivel || {})) {
    const peso = PESO_NIVEL[nivel] || 1
    total += linha.v * peso * 2 + linha.e * peso
  }
  return total + estatisticas.brilhantes * 2
}

export function patenteDe(pontos) {
  let atual = PATENTES[0]
  let proxima = null
  for (let i = 0; i < PATENTES.length; i++) {
    if (pontos >= PATENTES[i].minimo) {
      atual = PATENTES[i]
      proxima = PATENTES[i + 1] || null
    }
  }
  const base = atual.minimo
  const alvo = proxima ? proxima.minimo : atual.minimo
  const progresso = proxima ? Math.min(100, ((pontos - base) / (alvo - base)) * 100) : 100
  return { atual, proxima, progresso, pontos }
}

/* ------------------------------------------------------------------ */
/* Google Identity Services                                            */
/* ------------------------------------------------------------------ */

export const CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID || ''

let carregando = null

/** Carrega o script do Google uma única vez. */
export function carregarGoogle() {
  if (typeof window === 'undefined') return Promise.reject(new Error('sem navegador'))
  if (window.google && window.google.accounts) return Promise.resolve(window.google)
  if (carregando) return carregando
  carregando = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google)
    script.onerror = () => reject(new Error('não foi possível carregar o Google'))
    document.head.appendChild(script)
  })
  return carregando
}
