import React from 'react';

interface BrandLogoProps {
  /** Rendered size in px (square). */
  size?: number;
  className?: string;
}

/**
 * HesabFlow brand emblem — pure vector, stays perfectly sharp at any size.
 * Minimal dark tile + emerald→cyan "flow" waves + crisp HF monogram.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 32, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="HesabFlow"
  >
    <defs>
      <linearGradient id="hf-bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#101828" />
        <stop offset="1" stopColor="#020617" />
      </linearGradient>
      <linearGradient id="hf-flow" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#f8fafc" />
        <stop offset="0.55" stopColor="#cbd5e1" />
        <stop offset="1" stopColor="#94a3b8" />
      </linearGradient>
      <linearGradient id="hf-txt" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#e2e8f0" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="14" fill="url(#hf-bg)" />
    <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="13.25" fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1.5" />
    <path d="M12 23 C 19 23, 20 15, 27 15 S 35 23, 42 23 S 51 15, 52 15" fill="none" stroke="url(#hf-flow)" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M12 31 C 19 31, 20 23, 27 23 S 35 31, 42 31 S 51 23, 52 23" fill="none" stroke="url(#hf-flow)" strokeWidth="3.5" strokeLinecap="round" strokeOpacity="0.45" />
    <text x="32" y="50" fontFamily="Arial, 'Helvetica Neue', sans-serif" fontSize="21" fontWeight="900" fill="url(#hf-txt)" textAnchor="middle" letterSpacing="-0.5">HF</text>
  </svg>
);
