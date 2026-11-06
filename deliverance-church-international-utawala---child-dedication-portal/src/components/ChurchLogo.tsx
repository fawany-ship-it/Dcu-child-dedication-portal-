import React from 'react';

interface ChurchLogoProps {
  className?: string;
  size?: number;
}

export function ChurchLogo({ className = 'w-12 h-12', size = 64 }: ChurchLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 rounded-full select-none shadow-md ${className}`}
    >
      <defs>
        {/* Outer Gold Gradient */}
        <linearGradient id="goldOuter" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f7e6a1" />
          <stop offset="25%" stopColor="#d4af37" />
          <stop offset="50%" stopColor="#aa8222" />
          <stop offset="75%" stopColor="#e5c566" />
          <stop offset="100%" stopColor="#896615" />
        </linearGradient>

        {/* Polished Gold Bezel */}
        <linearGradient id="goldBezel" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff3b8" />
          <stop offset="35%" stopColor="#d4af37" />
          <stop offset="70%" stopColor="#8b6514" />
          <stop offset="100%" stopColor="#e8ce72" />
        </linearGradient>

        {/* Mahogany Chocolate Leather Center */}
        <radialGradient id="mahoganyCenter" cx="45%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#4a2514" />
          <stop offset="55%" stopColor="#2e1509" />
          <stop offset="90%" stopColor="#1c0c05" />
          <stop offset="100%" stopColor="#120703" />
        </radialGradient>

        {/* Dark Enamel Ring */}
        <radialGradient id="darkEnamel" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3d1f11" />
          <stop offset="100%" stopColor="#1a0b04" />
        </radialGradient>

        {/* Embossed Cross Gradient */}
        <linearGradient id="crossMetal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#54433a" />
          <stop offset="45%" stopColor="#2a1f18" />
          <stop offset="100%" stopColor="#150e0a" />
        </linearGradient>

        {/* Subtle drop shadow filter */}
        <filter id="medalShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000000" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* Outer Polished Rim */}
      <circle cx="200" cy="200" r="192" fill="url(#goldBezel)" filter="url(#medalShadow)" />
      
      {/* Knurled Textured Ring Band */}
      <circle cx="200" cy="200" r="182" fill="#aa8222" />
      <circle cx="200" cy="200" r="176" fill="url(#goldOuter)" stroke="#664c0e" strokeWidth="2" strokeDasharray="3 3" />
      <circle cx="200" cy="200" r="162" fill="url(#goldBezel)" />

      {/* Dark Mahogany Circular Ring For Text */}
      <circle cx="200" cy="200" r="156" fill="url(#darkEnamel)" stroke="#d4af37" strokeWidth="3" />

      {/* Inner Gold Rim */}
      <circle cx="200" cy="200" r="106" fill="url(#mahoganyCenter)" stroke="url(#goldBezel)" strokeWidth="4" />

      {/* Center Church Symbolism (Stylized Cross with Spire Wings) */}
      <g transform="translate(200, 200)">
        {/* Shadow under emblem */}
        <path
          d="M -54 58 L -14 -42 L -6 -42 L -6 60 L -54 60 Z"
          fill="#0a0503"
          opacity="0.6"
        />
        <path
          d="M 54 58 L 14 -42 L 6 -42 L 6 60 L 54 60 Z"
          fill="#0a0503"
          opacity="0.6"
        />

        {/* Left Spire Wing */}
        <path
          d="M -50 56 L -10 -40 L -4 -40 L -4 56 Z"
          fill="url(#crossMetal)"
          stroke="#423329"
          strokeWidth="1.5"
        />
        <path
          d="M -50 56 L -4 -40 L -4 56 Z"
          fill="#2b1a11"
          opacity="0.4"
        />

        {/* Right Spire Wing */}
        <path
          d="M 50 56 L 10 -40 L 4 -40 L 4 56 Z"
          fill="url(#crossMetal)"
          stroke="#423329"
          strokeWidth="1.5"
        />
        <path
          d="M 50 56 L 4 -40 L 4 56 Z"
          fill="#1b0e07"
          opacity="0.7"
        />

        {/* Central Christian Cross */}
        {/* Cross Vertical Beam */}
        <rect
          x="-5"
          y="-66"
          width="10"
          height="75"
          rx="1"
          fill="#2d221c"
          stroke="#5a4538"
          strokeWidth="1.5"
        />
        {/* Cross Horizontal Beam */}
        <rect
          x="-30"
          y="-48"
          width="60"
          height="8.5"
          rx="1"
          fill="#241a15"
          stroke="#5a4538"
          strokeWidth="1.5"
        />
        {/* Cross Bevel Highlight */}
        <line x1="-28" y1="-48" x2="28" y2="-48" stroke="#876b58" strokeWidth="1" />
        <line x1="-5" y1="-64" x2="-5" y2="8" stroke="#876b58" strokeWidth="1" />
      </g>

      {/* Top Arc Text: DELIVERANCE CHURCH INT'L - UTAWALA */}
      <path
        id="topTextArc"
        d="M 64 200 A 136 136 0 0 1 336 200"
        fill="none"
      />
      <text fill="#ffffff" stroke="#221107" strokeWidth="0.8" fontSize="16.5" fontWeight="900" letterSpacing="2.5" fontFamily="'Cinzel', serif">
        <textPath href="#topTextArc" startOffset="50%" textAnchor="middle">
          DELIVERANCE CHURCH INT'L - UTAWALA
        </textPath>
      </text>

      {/* Bottom Arc Text: THE CHURCH OF CHOICE */}
      <path
        id="bottomTextArc"
        d="M 72 200 A 128 128 0 0 0 328 200"
        fill="none"
      />
      <text fill="#ffd972" stroke="#221107" strokeWidth="0.6" fontSize="16" fontWeight="900" letterSpacing="3.5" fontFamily="'Cinzel', serif">
        <textPath href="#bottomTextArc" startOffset="50%" textAnchor="middle">
          THE CHURCH OF CHOICE
        </textPath>
      </text>

      {/* Star Accents on Ring */}
      <circle cx="56" cy="200" r="3" fill="#ffd700" />
      <circle cx="344" cy="200" r="3" fill="#ffd700" />
    </svg>
  );
}
