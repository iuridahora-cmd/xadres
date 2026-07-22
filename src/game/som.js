/**
 * Sons sintetizados na hora com Web Audio, sem arquivo nenhum.
 * Tudo curto e discreto, só para dar retorno tátil ao lance.
 */

let ctx = null

function contexto() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tocar({ freq = 440, tipo = 'sine', duracao = 0.12, volume = 0.18, decaimento = 0.1, freqFinal = null }) {
  const ac = contexto()
  if (!ac) return
  const agora = ac.currentTime
  const osc = ac.createOscillator()
  const ganho = ac.createGain()
  osc.type = tipo
  osc.frequency.setValueAtTime(freq, agora)
  if (freqFinal) osc.frequency.exponentialRampToValueAtTime(freqFinal, agora + duracao)
  ganho.gain.setValueAtTime(0, agora)
  ganho.gain.linearRampToValueAtTime(volume, agora + 0.008)
  ganho.gain.exponentialRampToValueAtTime(0.0001, agora + duracao + decaimento)
  osc.connect(ganho).connect(ac.destination)
  osc.start(agora)
  osc.stop(agora + duracao + decaimento + 0.02)
}

function ruido({ duracao = 0.09, volume = 0.12 }) {
  const ac = contexto()
  if (!ac) return
  const tamanho = Math.floor(ac.sampleRate * duracao)
  const buffer = ac.createBuffer(1, tamanho, ac.sampleRate)
  const dados = buffer.getChannelData(0)
  for (let i = 0; i < tamanho; i++) {
    dados[i] = (Math.random() * 2 - 1) * (1 - i / tamanho) ** 2
  }
  const fonte = ac.createBufferSource()
  fonte.buffer = buffer
  const filtro = ac.createBiquadFilter()
  filtro.type = 'lowpass'
  filtro.frequency.value = 1400
  const ganho = ac.createGain()
  ganho.gain.value = volume
  fonte.connect(filtro).connect(ganho).connect(ac.destination)
  fonte.start()
}

export const som = {
  lance() {
    ruido({ duracao: 0.07, volume: 0.14 })
    tocar({ freq: 320, tipo: 'triangle', duracao: 0.05, volume: 0.07 })
  },
  captura() {
    ruido({ duracao: 0.13, volume: 0.22 })
    tocar({ freq: 190, tipo: 'square', duracao: 0.07, volume: 0.06, freqFinal: 90 })
  },
  xeque() {
    tocar({ freq: 880, tipo: 'sine', duracao: 0.1, volume: 0.13, freqFinal: 1320 })
  },
  roque() {
    ruido({ duracao: 0.06, volume: 0.12 })
    setTimeout(() => ruido({ duracao: 0.07, volume: 0.14 }), 90)
  },
  promocao() {
    tocar({ freq: 660, tipo: 'sine', duracao: 0.1, volume: 0.12 })
    setTimeout(() => tocar({ freq: 990, tipo: 'sine', duracao: 0.16, volume: 0.12 }), 100)
  },
  fim() {
    tocar({ freq: 440, tipo: 'sine', duracao: 0.2, volume: 0.13 })
    setTimeout(() => tocar({ freq: 330, tipo: 'sine', duracao: 0.32, volume: 0.13 }), 180)
  },
  dica() {
    tocar({ freq: 1180, tipo: 'sine', duracao: 0.07, volume: 0.09 })
  },
  erro() {
    tocar({ freq: 200, tipo: 'sawtooth', duracao: 0.12, volume: 0.08, freqFinal: 140 })
  },
}

export function despertarAudio() {
  contexto()
}
