/**
 * Conjunto de peças desenhado à mão em SVG, geométrico, para combinar com a
 * identidade da Meta Alvo: as brancas em dourado champanhe, as pretas em
 * ametista escuro. Os gradientes ficam num <defs> único (Defs) para não
 * repetir id no documento.
 */

export function DefsPecas() {
  return (
    <svg className="defs-svg" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="pcBranca" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff6e2" />
          <stop offset="45%" stopColor="#f0d69c" />
          <stop offset="100%" stopColor="#c9a15a" />
        </linearGradient>
        <linearGradient id="pcBrancaBrilho" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="pcPreta" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4b2f7a" />
          <stop offset="40%" stopColor="#2a1750" />
          <stop offset="100%" stopColor="#120a26" />
        </linearGradient>
        <linearGradient id="pcPretaBrilho" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c9b6ff" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#c9b6ff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#c9b6ff" stopOpacity="0" />
        </linearGradient>
        <filter id="sombraPeca" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="1.1" stdDeviation="1.1" floodColor="#0a0416" floodOpacity="0.65" />
        </filter>
      </defs>
    </svg>
  )
}

const CAMINHOS = {
  p: (
    <>
      <circle cx="22.5" cy="12.6" r="5.4" />
      <path d="M22.5 18.6c-3.3 0-5.6 1.5-5.6 3.4 0 1.2.8 2.1 1.9 2.8-2.6 2.1-3.9 5.2-4.2 8.8h15.8c-.3-3.6-1.6-6.7-4.2-8.8 1.1-.7 1.9-1.6 1.9-2.8 0-1.9-2.3-3.4-5.6-3.4z" />
      <path d="M12.6 33.9h19.8c1.3 0 2.3.9 2.3 2.1v2.3H10.3V36c0-1.2 1-2.1 2.3-2.1z" />
    </>
  ),
  r: (
    <>
      <path d="M12.3 11.8h4.2v3.1h4.1v-3.1h4.3v3.1h4.1v-3.1h4.2v6.9l-2.6 2.4v9.5l2.6 2.4v3.2H12.3v-3.2l2.6-2.4v-9.5l-2.6-2.4z" />
      <path d="M10.6 34.1h23.8c1.2 0 2.1.9 2.1 2.1v2.2H8.5V36.2c0-1.2.9-2.1 2.1-2.1z" />
      <path className="detalhe" d="M17.3 21.4h10.4v8.2H17.3z" />
    </>
  ),
  n: (
    <>
      <path d="M13.4 34.3c0-6.2 1.7-10.7 5-14l-3.4 1.5c-1.5.7-2.9-.7-2.3-2.2 1.6-4 4.6-7.2 8.7-9.2l-.5-2.6c-.2-1.2 1.1-2 2-1.3l2.2 1.7 2-2.1c.8-.8 2.1-.3 2.2.8l.4 3.3c3.9 2.5 6.2 6.3 7 11.3.5 3.4.7 7.7.7 12.8z" />
      <path d="M11.6 34.1h21.9c1.2 0 2.1.9 2.1 2.1v2.2H9.5V36.2c0-1.2.9-2.1 2.1-2.1z" />
      <circle className="olho" cx="26.9" cy="15.9" r="1.15" />
    </>
  ),
  b: (
    <>
      <circle cx="22.5" cy="7.9" r="2.1" />
      <path d="M22.5 10.7c3.8 2.6 7.3 6.9 7.3 11.6 0 3.6-2.8 6-7.3 6s-7.3-2.4-7.3-6c0-4.7 3.5-9 7.3-11.6z" />
      <path className="detalhe" d="M22.5 14.4v6.2M19.4 17.5h6.2" />
      <path d="M15.2 28.6h14.6l1.2 3.6H14z" />
      <path d="M11.4 33.9h22.2c1.2 0 2.1.9 2.1 2.1v2.3H9.3V36c0-1.2.9-2.1 2.1-2.1z" />
    </>
  ),
  q: (
    <>
      <circle cx="22.5" cy="7.2" r="2.3" />
      <circle cx="11.6" cy="12.4" r="1.9" />
      <circle cx="33.4" cy="12.4" r="1.9" />
      <circle cx="16.6" cy="9.4" r="1.7" />
      <circle cx="28.4" cy="9.4" r="1.7" />
      <path d="M11.6 14.2l3.1 5.3 1.9-8 3.3 7.6 2.6-9.1 2.6 9.1 3.3-7.6 1.9 8 3.1-5.3-2.2 14.4H13.8z" />
      <path d="M14.1 29.6h16.8l1.3 3.6H12.8z" />
      <path d="M10.9 34.4h23.2c1.2 0 2.2.9 2.2 2.1v2.1H8.7v-2.1c0-1.2 1-2.1 2.2-2.1z" />
    </>
  ),
  k: (
    <>
      <path className="detalhe cruz" d="M22.5 4.2v7.4M18.9 7.6h7.2" />
      <path d="M22.5 12.1c-5.4 0-9.6 3.3-9.6 7.7 0 2.7 1.4 4.6 3 6.3.9 1 1.6 1.9 1.9 2.9h9.4c.3-1 1-1.9 1.9-2.9 1.6-1.7 3-3.6 3-6.3 0-4.4-4.2-7.7-9.6-7.7z" />
      <path d="M14 29.4h17l1.3 3.7H12.7z" />
      <path d="M10.9 34.2h23.2c1.2 0 2.2 1 2.2 2.2v2.1H8.7v-2.1c0-1.2 1-2.2 2.2-2.2z" />
    </>
  ),
}

export function Peca({ tipo, cor, className = '' }) {
  const branca = cor === 'w'
  return (
    <svg
      viewBox="0 0 45 45"
      className={`peca peca-${branca ? 'branca' : 'preta'} ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <g filter="url(#sombraPeca)" fill={`url(#${branca ? 'pcBranca' : 'pcPreta'})`}>
        {CAMINHOS[tipo]}
      </g>
      <g className="peca-brilho" fill={`url(#${branca ? 'pcBrancaBrilho' : 'pcPretaBrilho'})`}>
        {CAMINHOS[tipo]}
      </g>
    </svg>
  )
}

export const NOME_COMPLETO = {
  p: 'Peão',
  n: 'Cavalo',
  b: 'Bispo',
  r: 'Torre',
  q: 'Dama',
  k: 'Rei',
}
