import React from 'react';

interface MiniPitchProps {
  size?: number;
  wide?: boolean;
  transparentBg?: boolean;
  className?: string;
}

/**
 * Mini Campo Tático Animado — FUTPLAY LITE
 * Apenas as linhas do campo sobre o fundo azul,
 * com mini jogadores e uma pequena bola em movimento.
 */
export const RosaliaCrest: React.FC<MiniPitchProps> = ({
  size = 36,
  wide = false,
  transparentBg = false,
  className = '',
}) => {
  const width = wide ? Math.round(size * 1.9) : Math.round(size * 1.45);
  const height = size;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 160 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`overflow-hidden ${transparentBg ? '' : 'rounded-xl shadow-xs'} ${className}`}
      aria-label="Mini Campo Animado FutPlay Lite"
    >
      {/* Mesmo Fundo Azul (ou transparente quando já está sobre o card azul) */}
      {!transparentBg && (
        <rect width="160" height="96" rx="12" fill="#1D4ED8" />
      )}

      {/* Linhas Simples do Campo (Brancas e limpas) */}
      <g stroke="#FFFFFF" strokeOpacity="0.75" strokeWidth="1.8">
        {/* Linhas laterais e de fundo */}
        <rect x="6" y="6" width="148" height="84" rx="5" />
        {/* Linha do meio-campo */}
        <line x1="80" y1="6" x2="80" y2="90" />
        {/* Círculo central */}
        <circle cx="80" cy="48" r="14" />
        {/* Marca do meio-campo */}
        <circle cx="80" cy="48" r="1.8" fill="#FFFFFF" />
        {/* Grande área esquerda */}
        <rect x="6" y="25" width="20" height="46" />
        {/* Pequena área esquerda */}
        <rect x="6" y="36" width="7" height="24" />
        {/* Grande área direita */}
        <rect x="134" y="25" width="20" height="46" />
        {/* Pequena área direita */}
        <rect x="147" y="36" width="7" height="24" />
      </g>

      {/* Mini Jogadores Time Branco */}
      <circle
        cx="36"
        cy="32"
        r="3.8"
        fill="#FFFFFF"
        stroke="#1E3A8A"
        strokeWidth="1.2"
      >
        <animate
          attributeName="cx"
          values="36;44;36"
          dur="4.2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="cy"
          values="32;28;32"
          dur="4.2s"
          repeatCount="indefinite"
        />
      </circle>

      <circle
        cx="68"
        cy="66"
        r="3.8"
        fill="#FFFFFF"
        stroke="#1E3A8A"
        strokeWidth="1.2"
      >
        <animate
          attributeName="cx"
          values="68;76;68"
          dur="4.2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="cy"
          values="66;58;66"
          dur="4.2s"
          repeatCount="indefinite"
        />
      </circle>

      <circle
        cx="108"
        cy="34"
        r="3.8"
        fill="#FFFFFF"
        stroke="#1E3A8A"
        strokeWidth="1.2"
      >
        <animate
          attributeName="cx"
          values="108;120;108"
          dur="4.2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="cy"
          values="34;42;34"
          dur="4.2s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Mini Jogadores Time Azul Claro */}
      <circle
        cx="56"
        cy="44"
        r="3.6"
        fill="#93C5FD"
        stroke="#FFFFFF"
        strokeWidth="1.2"
      >
        <animate
          attributeName="cx"
          values="56;50;56"
          dur="4.2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="cy"
          values="44;50;44"
          dur="4.2s"
          repeatCount="indefinite"
        />
      </circle>

      <circle
        cx="96"
        cy="58"
        r="3.6"
        fill="#93C5FD"
        stroke="#FFFFFF"
        strokeWidth="1.2"
      >
        <animate
          attributeName="cx"
          values="96;104;96"
          dur="4.2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="cy"
          values="58;50;58"
          dur="4.2s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Goleiro */}
      <circle
        cx="144"
        cy="48"
        r="3.6"
        fill="#60A5FA"
        stroke="#FFFFFF"
        strokeWidth="1.2"
      >
        <animate
          attributeName="cy"
          values="44;52;44"
          dur="2.4s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Pequena Bola em Movimento */}
      <circle
        cx="38"
        cy="32"
        r="2.6"
        fill="#FFFFFF"
        stroke="#FDE047"
        strokeWidth="1.2"
      >
        <animate
          attributeName="cx"
          values="38;74;118;147;118;74;38"
          keyTimes="0;0.25;0.5;0.65;0.75;0.9;1"
          dur="4.2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="cy"
          values="32;60;40;48;40;60;32"
          keyTimes="0;0.25;0.5;0.65;0.75;0.9;1"
          dur="4.2s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
};
