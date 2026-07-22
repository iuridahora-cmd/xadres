import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Conversa com o Web Worker do motor usando promessas.
 *
 * `geracao` serve para descartar respostas velhas: ao começar outra partida
 * ou voltar um lance, incrementamos o contador e tudo que estava no ar é
 * ignorado em vez de aparecer fora de hora na tela.
 */
export function useEngine() {
  const workerRef = useRef(null)
  const pendentes = useRef(new Map())
  const proximoId = useRef(1)
  const geracao = useRef(0)
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    const worker = new Worker(new URL('../engine/engine.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const { id, tipo } = e.data
      const pedido = pendentes.current.get(id)
      if (!pedido) return
      pendentes.current.delete(id)
      if (tipo === 'erro') {
        pedido.reject(new Error(e.data.mensagem))
        return
      }
      pedido.resolve({ ...e.data, geracao: pedido.geracao, atual: pedido.geracao === geracao.current })
    }
    worker.onerror = (e) => {
      console.error('Falha no motor:', e.message)
      for (const [, pedido] of pendentes.current) pedido.reject(new Error(e.message))
      pendentes.current.clear()
    }
    workerRef.current = worker
    setPronto(true)
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const enviar = useCallback((payload) => {
    const worker = workerRef.current
    if (!worker) return Promise.reject(new Error('motor indisponível'))
    const id = proximoId.current++
    return new Promise((resolve, reject) => {
      pendentes.current.set(id, { resolve, reject, geracao: geracao.current })
      worker.postMessage({ ...payload, id })
    })
  }, [])

  const analisar = useCallback((fen, config) => enviar({ cmd: 'analisar', fen, config }), [enviar])
  const jogar = useCallback((fen, nivel) => enviar({ cmd: 'jogar', fen, nivel }), [enviar])
  const avaliar = useCallback((fen) => enviar({ cmd: 'avaliar', fen }), [enviar])
  const pendurados = useCallback((fen) => enviar({ cmd: 'pendurados', fen }), [enviar])
  const invalidar = useCallback(() => {
    geracao.current++
    return geracao.current
  }, [])

  // objeto estável: efeitos que dependem do motor não podem rodar a cada render
  return useMemo(
    () => ({ pronto, analisar, jogar, avaliar, pendurados, invalidar, geracao }),
    [pronto, analisar, jogar, avaliar, pendurados, invalidar],
  )
}
