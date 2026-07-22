/**
 * Precisão da partida, no espírito do que o Lichess e o Chess.com mostram.
 *
 * A conta parte da perda em probabilidade de vitória de cada lance, não de
 * centipeões. Um lance que só derruba 1% de chance vale quase 100 de
 * precisão; um que derruba 30% derruba a nota inteira.
 */

export function precisaoDoLance(perdaWp) {
  const bruta = 103.1668 * Math.exp(-0.04354 * Math.max(0, perdaWp)) - 3.1669
  return Math.max(0, Math.min(100, bruta))
}

export function precisaoMedia(perdas) {
  if (!perdas.length) return null
  const soma = perdas.reduce((t, p) => t + precisaoDoLance(p), 0)
  return soma / perdas.length
}

export function faixaDePrecisao(valor) {
  if (valor == null) return { rotulo: 'sem dados', classe: 'v-neutro' }
  if (valor >= 95) return { rotulo: 'impecável', classe: 'v-brilhante' }
  if (valor >= 88) return { rotulo: 'muito boa', classe: 'v-melhor' }
  if (valor >= 78) return { rotulo: 'boa', classe: 'v-excelente' }
  if (valor >= 65) return { rotulo: 'irregular', classe: 'v-boa' }
  if (valor >= 50) return { rotulo: 'com falhas', classe: 'v-imprecisao' }
  return { rotulo: 'para revisar', classe: 'v-erro' }
}

const ORDEM = ['brilhante', 'melhor', 'excelente', 'boa', 'forcado', 'imprecisao', 'erro', 'errograve']

/** Conta quantos lances de cada tipo cada lado fez. */
export function resumoDaPartida(lances, corJogador) {
  const vazio = () => Object.fromEntries(ORDEM.map((k) => [k, 0]))
  const contagem = { jogador: vazio(), bot: vazio() }
  const perdas = { jogador: [], bot: [] }

  for (const lance of lances) {
    if (!lance.veredito) continue
    const lado = lance.cor === corJogador ? 'jogador' : 'bot'
    if (contagem[lado][lance.veredito.chave] != null) contagem[lado][lance.veredito.chave]++
    perdas[lado].push(lance.veredito.perdaWp || 0)
  }

  return {
    contagem,
    precisao: {
      jogador: precisaoMedia(perdas.jogador),
      bot: precisaoMedia(perdas.bot),
    },
    lances: { jogador: perdas.jogador.length, bot: perdas.bot.length },
  }
}

export const CATEGORIAS = [
  { chave: 'brilhante', rotulo: 'Brilhantes', icone: '◆' },
  { chave: 'melhor', rotulo: 'Melhor jogada', icone: '★' },
  { chave: 'excelente', rotulo: 'Excelentes', icone: '✦' },
  { chave: 'boa', rotulo: 'Boas', icone: '✓' },
  { chave: 'imprecisao', rotulo: 'Imprecisões', icone: '?!' },
  { chave: 'erro', rotulo: 'Erros', icone: '?' },
  { chave: 'errograve', rotulo: 'Erros graves', icone: '??' },
]
