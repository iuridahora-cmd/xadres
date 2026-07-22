/**
 * Camada de leitura da análise: transforma números do motor em veredito e
 * comentário em português.
 *
 * A perda é medida em pontos de probabilidade de vitória, não em centipeões
 * crus. Perder 200 centipeões numa posição equilibrada é gravíssimo; perder
 * os mesmos 200 quando já se está com dama a mais quase não muda o jogo.
 */

const NOMES = {
  p: 'peão',
  n: 'cavalo',
  b: 'bispo',
  r: 'torre',
  q: 'dama',
  k: 'rei',
}

const LETRAS_PT = { K: 'R', Q: 'D', R: 'T', B: 'B', N: 'C' }

/** Converte notação inglesa (Nf3) para a brasileira (Cf3). */
export function paraNotacaoPt(san) {
  if (!san) return ''
  let saida = ''
  for (const ch of san) saida += LETRAS_PT[ch] || ch
  return saida
}

export function nomeDaPeca(letra) {
  return NOMES[letra] || 'peça'
}

/** Probabilidade de vitória (0 a 100) a partir da nota em centipeões. */
export function chanceDeVitoria(cp) {
  const limitado = Math.max(-1500, Math.min(1500, cp))
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * limitado)) - 1)
}

export function chanceDaNota(nota, mate) {
  if (mate != null) return mate > 0 ? 100 : 0
  return chanceDeVitoria(nota)
}

export const VEREDITOS = {
  brilhante: { rotulo: 'Brilhante', icone: '◆', cor: 'brilhante', peso: 6 },
  melhor: { rotulo: 'Melhor jogada', icone: '★', cor: 'melhor', peso: 5 },
  excelente: { rotulo: 'Excelente', icone: '✦', cor: 'excelente', peso: 4 },
  boa: { rotulo: 'Boa', icone: '✓', cor: 'boa', peso: 3 },
  livro: { rotulo: 'Lance de abertura', icone: '◈', cor: 'boa', peso: 3 },
  forcado: { rotulo: 'Lance forçado', icone: '⇥', cor: 'neutro', peso: 3 },
  imprecisao: { rotulo: 'Imprecisão', icone: '?!', cor: 'imprecisao', peso: 2 },
  erro: { rotulo: 'Erro', icone: '?', cor: 'erro', peso: 1 },
  errograve: { rotulo: 'Erro grave', icone: '??', cor: 'errograve', peso: 0 },
}

/**
 * @param {object} d
 * @param {object} d.linhaJogada  linha do motor referente ao lance jogado
 * @param {object} d.melhorLinha  melhor linha da posição anterior
 * @param {number} d.totalLegais  quantidade de lances legais que existiam
 * @param {object|null} d.refutacao  melhor resposta do adversário depois do lance
 */
export function classificarJogada({ linhaJogada, melhorLinha, totalLegais, refutacao }) {
  if (!linhaJogada || !melhorLinha) return { chave: 'boa', ...VEREDITOS.boa, perdaWp: 0, perda: 0 }

  const wpMelhor = chanceDaNota(melhorLinha.score, melhorLinha.mate)
  const wpJogada = chanceDaNota(linhaJogada.score, linhaJogada.mate)
  const perdaWp = Math.max(0, wpMelhor - wpJogada)
  const perda = Math.max(0, melhorLinha.score - linhaJogada.score)
  const ehMelhor = linhaJogada.uci === melhorLinha.uci

  let chave
  if (totalLegais === 1) chave = 'forcado'
  else if (ehMelhor) chave = 'melhor'
  else if (perdaWp < 1) chave = 'melhor'
  else if (perdaWp < 3) chave = 'excelente'
  else if (perdaWp < 6) chave = 'boa'
  else if (perdaWp < 12) chave = 'imprecisao'
  else if (perdaWp < 22) chave = 'erro'
  else chave = 'errograve'

  // sacrifício que dá certo vira "brilhante"
  const entregaMaterial = linhaJogada.see < -80 || (refutacao && refutacao.see > 120)
  const continuaBem = linhaJogada.mate > 0 || linhaJogada.score > 40
  if ((chave === 'melhor' || chave === 'excelente') && entregaMaterial && continuaBem && totalLegais > 1) {
    chave = 'brilhante'
  }

  return { chave, ...VEREDITOS[chave], perda, perdaWp, ehMelhor }
}

/* ------------------------------------------------------------------ */
/* Comentário                                                          */
/* ------------------------------------------------------------------ */

function descreverLance(jogada) {
  if (!jogada) return ''
  if (jogada.flags.includes('k')) return 'Roque curto, rei guardado e torre ativa.'
  if (jogada.flags.includes('q')) return 'Roque longo, rei para o flanco da dama.'
  if (jogada.promotion) return `Promoveu o peão a ${nomeDaPeca(jogada.promotion)}.`
  if (jogada.captured) {
    return `Capturou ${artigo(jogada.captured)} ${nomeDaPeca(jogada.captured)} em ${jogada.to}.`
  }
  return `Levou ${artigo(jogada.piece)} ${nomeDaPeca(jogada.piece)} de ${jogada.from} para ${jogada.to}.`
}

function artigo(letra) {
  return letra === 'q' || letra === 'r' ? 'a' : 'o'
}

const ELOGIOS = {
  brilhante: 'Sacrifício certeiro. Entregou material e ficou com a iniciativa.',
  melhor: 'Exatamente o lance que o motor aponta como melhor.',
  igualAoMelhor: 'Vale o mesmo que o melhor lance, a diferença é irrelevante.',
  excelente: 'Praticamente o melhor lance, a diferença é mínima.',
  boa: 'Lance sólido, mantém a posição no rumo.',
  livro: 'Lance conhecido de abertura.',
  forcado: 'Não havia escolha, era o único lance legal.',
}

/**
 * Monta o texto que aparece no painel "Análise da IA".
 * Os nomes de lance chegam já em notação brasileira.
 */
export function comentarJogada({
  veredito,
  jogada,
  sanMelhor,
  pvMelhor,
  refutacao,
  pecaAmeacada,
  perdeuMate,
  daXeque,
  eMate,
  nomeAdversario = 'o bot',
}) {
  const partes = []

  if (eMate) {
    partes.push(`${descreverLance(jogada)} Xeque-mate, partida encerrada.`)
    return partes.join(' ')
  }

  partes.push(descreverLance(jogada))
  if (daXeque) partes.push('O lance dá xeque e força a resposta.')

  const chave = veredito.chave
  // "melhor" também cobre o lance que empata com o melhor sem ser ele;
  // dizer "exatamente o melhor" nesse caso soaria contraditório logo abaixo
  if (chave === 'melhor' && !veredito.ehMelhor) partes.push(ELOGIOS.igualAoMelhor)
  else if (ELOGIOS[chave]) partes.push(ELOGIOS[chave])

  if (perdeuMate) {
    partes.push(`Havia mate forçado na posição com ${sanMelhor}, e ele escapou.`)
  }

  if (chave === 'imprecisao' || chave === 'erro' || chave === 'errograve') {
    const severidade =
      chave === 'errograve' ? 'A posição virou de lado' : chave === 'erro' ? 'Custou caro' : 'Dava para fazer melhor'
    partes.push(`${severidade}: a nota caiu ${veredito.perdaWp.toFixed(0)} pontos de chance de vitória.`)

    if (pecaAmeacada && refutacao) {
      partes.push(
        `${capitalizar(nomeAdversario)} responde ${refutacao.san} e fica com ${artigo(pecaAmeacada.tipo)} ${nomeDaPeca(
          pecaAmeacada.tipo,
        )} de ${pecaAmeacada.casa}.`,
      )
    } else if (refutacao) {
      partes.push(`A resposta mais forte agora é ${refutacao.san}.`)
    }

    if (sanMelhor) {
      partes.push(`O melhor era ${sanMelhor}${pvMelhor ? `, com a sequência ${pvMelhor}` : ''}.`)
    }
  } else if (sanMelhor && !veredito.ehMelhor && chave !== 'forcado' && chave !== 'melhor') {
    partes.push(`O motor preferia ${sanMelhor}, mas a diferença é pequena.`)
  }

  return partes.filter(Boolean).join(' ')
}

function capitalizar(txt) {
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

/** Etiqueta curta para cada candidata da aba "Jogadas". */
export function motivoDoLance(linha, jogadaInfo) {
  if (linha.mate != null) return linha.mate > 0 ? `mate em ${Math.abs(linha.mate)}` : `leva a mate em ${Math.abs(linha.mate)}`
  if (jogadaInfo && jogadaInfo.san && jogadaInfo.san.includes('#')) return 'xeque-mate'
  if (jogadaInfo && jogadaInfo.san && jogadaInfo.san.includes('+')) return 'com xeque'
  if (linha.captura > 0 && linha.see > 0) return `ganha ${(linha.see / 100).toFixed(1)} de material`
  if (linha.captura > 0 && linha.see === 0) return 'troca equilibrada'
  if (linha.captura > 0 && linha.see < 0) return 'captura que perde material'
  if (jogadaInfo && jogadaInfo.flags && (jogadaInfo.flags.includes('k') || jogadaInfo.flags.includes('q'))) return 'roque'
  if (jogadaInfo && jogadaInfo.piece === 'p') return 'avanço de peão'
  if (jogadaInfo && (jogadaInfo.piece === 'n' || jogadaInfo.piece === 'b')) return 'desenvolve peça'
  return 'lance posicional'
}
