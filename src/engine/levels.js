/**
 * Níveis de dificuldade.
 *
 * A força vem de três coisas somadas: profundidade, quais heurísticas de
 * busca ficam ligadas e quanto "ruído" entra na escolha do lance. O ruído
 * é o que faz o iniciante errar de um jeito humano em vez de jogar
 * sempre o mesmo lance fraco.
 */

export const LEVELS = {
  iniciante: {
    id: 'iniciante',
    nome: 'Iniciante',
    descricao: 'Enxerga só um lance à frente. Deixa peças penduradas e perde táticas simples.',
    forca: 1,
    maxDepth: 2,
    timeMs: 350,
    // sem busca de quietude o motor não enxerga o fim das trocas,
    // que é exatamente o erro típico de quem está começando
    opts: { quiescence: false, nullMove: false, futility: false, lmr: false, checkExtension: true },
    chanceDeErro: 0.35,
    ruido: 200,
    perdaMaxima: 700,
  },
  intermediario: {
    id: 'intermediario',
    nome: 'Intermediário',
    descricao: 'Calcula trocas e táticas curtas. Pune peça pendurada, mas escorrega em planos longos.',
    forca: 2,
    maxDepth: 6,
    timeMs: 900,
    opts: { quiescence: true, nullMove: true, futility: true, lmr: true, checkExtension: true },
    chanceDeErro: 0.1,
    ruido: 55,
    perdaMaxima: 200,
  },
  avancado: {
    id: 'avancado',
    nome: 'Avançado',
    descricao: 'Busca profunda, sempre o melhor lance que encontrar. Não perdoa erro.',
    forca: 3,
    maxDepth: 20,
    timeMs: 2200,
    opts: { quiescence: true, nullMove: true, futility: true, lmr: true, checkExtension: true },
    chanceDeErro: 0,
    ruido: 0,
    perdaMaxima: 0,
  },
}

export const LEVEL_LIST = [LEVELS.iniciante, LEVELS.intermediario, LEVELS.avancado]

/** Configuração da análise que comenta as jogadas (independe do nível). */
export const ANALISE = {
  maxDepth: 10,
  timeMs: 1100,
  opts: { quiescence: true, nullMove: true, futility: true, lmr: true, checkExtension: true },
}

/** Análise mais curta, usada para descobrir a resposta do adversário. */
export const ANALISE_RAPIDA = {
  maxDepth: 8,
  timeMs: 600,
  opts: ANALISE.opts,
}

/**
 * Escolhe o lance do bot entre as linhas pontuadas, aplicando o ruído do nível.
 * `lines` vem ordenada da melhor para a pior, com nota do ponto de vista de quem joga.
 */
export function escolherLance(lines, level, random = Math.random) {
  if (!lines.length) return null
  if (lines.length === 1) return lines[0]
  const cfg = LEVELS[level] || LEVELS.intermediario
  if (!cfg.ruido && !cfg.chanceDeErro) return lines[0]

  const melhor = lines[0].score

  // erro proposital: escolhe entre os lances medianos, não o pior de todos
  if (random() < cfg.chanceDeErro) {
    const candidatos = lines.filter((l) => {
      const perda = melhor - l.score
      return perda > 60 && perda <= cfg.perdaMaxima
    })
    if (candidatos.length) {
      return candidatos[Math.floor(random() * candidatos.length)]
    }
  }

  // ruído normal: embaralha a ordem das opções próximas do topo
  let escolhido = lines[0]
  let melhorNota = -Infinity
  for (const linha of lines) {
    const perda = melhor - linha.score
    if (cfg.perdaMaxima && perda > cfg.perdaMaxima) continue
    const nota = linha.score + (random() * 2 - 1) * cfg.ruido
    if (nota > melhorNota) {
      melhorNota = nota
      escolhido = linha
    }
  }
  return escolhido
}
