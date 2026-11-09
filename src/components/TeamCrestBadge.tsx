import React from 'react';

interface TeamCrestBadgeProps {
  name?: string;
  crestUrl?: string;
  size?: number;
  className?: string;
}

export const TeamCrestBadge: React.FC<TeamCrestBadgeProps> = ({
  name = 'Meu Time',
  crestUrl,
  size = 38,
  className = '',
}) => {
  if (crestUrl) {
    return (
      <img
        src={crestUrl}
        alt={name}
        className={`object-contain drop-shadow-sm shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const initials = (name || 'FC')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'FC';

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 drop-shadow-sm ${className}`}
      style={{ width: size, height: size }}
      title={name}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 112"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <path
          d="M50 4L92 19.5V54C92 81 73.5 100.5 50 108C26.5 100.5 8 81 8 54V19.5L50 4Z"
          fill="#1D4ED8"
          stroke="#3B82F6"
          strokeWidth="3.5"
        />
        <path
          d="M50 12L84 24.5V53.5C84 75 68.5 91.5 50 98.5C31.5 91.5 16 75 16 53.5V24.5L50 12Z"
          fill="#FFFFFF"
          fillOpacity="0.18"
        />
        <circle
          cx="50"
          cy="48"
          r="21"
          fill="#FFFFFF"
          stroke="#1D4ED8"
          strokeWidth="2.5"
        />
        <text
          x="50"
          y="55"
          textAnchor="middle"
          fill="#1D4ED8"
          fontSize="18"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {initials}
        </text>
        <path
          d="M50 75L52.3 79.7L57.5 80.4L53.7 84L54.6 89.2L50 86.7L45.4 89.2L46.3 84L42.5 80.4L47.7 79.7L50 75Z"
          fill="#FACC15"
        />
      </svg>
    </div>
  );
};
