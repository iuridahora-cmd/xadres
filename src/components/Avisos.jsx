import { useEffect } from 'react'

/**
 * Avisos flutuantes no canto. Substituem o texto que antes trocava dentro do
 * próprio botão, que ficava fácil de não perceber.
 */
export default function Avisos({ avisos, onFechar }) {
  return (
    <div className="pilha-avisos" role="status" aria-live="polite">
      {avisos.map((aviso) => (
        <Aviso key={aviso.id} aviso={aviso} onFechar={onFechar} />
      ))}
    </div>
  )
}

function Aviso({ aviso, onFechar }) {
  useEffect(() => {
    const t = setTimeout(() => onFechar(aviso.id), aviso.duracao || 3200)
    return () => clearTimeout(t)
  }, [aviso, onFechar])

  return (
    <div className={`aviso aviso-${aviso.tipo || 'info'}`}>
      <span className="aviso-icone" aria-hidden="true">
        {aviso.tipo === 'erro' ? '!' : aviso.tipo === 'ok' ? '✓' : '★'}
      </span>
      <span className="aviso-texto">{aviso.texto}</span>
      <button className="aviso-fechar" onClick={() => onFechar(aviso.id)} aria-label="Fechar aviso">
        ×
      </button>
    </div>
  )
}
