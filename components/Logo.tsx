
import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Dimensions for each size
const SIZE_MAP = {
  sm:  { w: 140, h: 36 },
  md:  { w: 196, h: 50 },
  lg:  { w: 320, h: 82 },
  xl:  { w: 480, h: 122 },
};

const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const { w, h } = SIZE_MAP[size];

  /**
   * Icon is drawn in a 70 × 70 viewBox, text starts at x=76.
   * Total SVG viewBox: "0 0 280 70"
   *
   * Arcs:  left-facing semicircles (open to the right), center (52, 35)
   * Bars:  3 vertical bars inside the C opening, at x≈58–68
   * Dots:  4 small signal dots radiating left of the outermost arc
   * Text:  "ClutchAI" with the same gradient, semi-bold
   */
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 280 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="ClutchAI Logo"
    >
      <defs>
        <linearGradient id="lg-brand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#93c5fd" />
          <stop offset="50%"  stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <filter id="lg-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ── Concentric left-facing arcs (C shape, opens right) ── */}
      {/* Each arc: M cx cy-r  A r r 0 0 0 cx cy+r  */}
      {/* center = (52, 35) */}
      <g stroke="url(#lg-brand)" fill="none" strokeLinecap="round" filter="url(#lg-glow)">
        {/* r = 10 */}
        <path d="M52 25 A10 10 0 0 0 52 45" strokeWidth="2" strokeOpacity="0.55" />
        {/* r = 17 */}
        <path d="M52 18 A17 17 0 0 0 52 52" strokeWidth="2.2" strokeOpacity="0.70" />
        {/* r = 24 */}
        <path d="M52 11 A24 24 0 0 0 52 59" strokeWidth="2.4" strokeOpacity="0.85" />
        {/* r = 31 */}
        <path d="M52 4 A31 31 0 0 0 52 66" strokeWidth="2.6" strokeOpacity="1" />
      </g>

      {/* ── Equaliser bars inside the C opening ── */}
      <g fill="url(#lg-brand)" filter="url(#lg-glow)">
        {/* bar 1 – left, shortest */}
        <rect x="57" y="28" width="3.5" height="14" rx="1.75" />
        {/* bar 2 – middle, tallest */}
        <rect x="63" y="22" width="3.5" height="26" rx="1.75" />
        {/* bar 3 – right, shortest */}
        <rect x="69" y="28" width="3.5" height="14" rx="1.75" />
      </g>

      {/* ── Signal dots radiating left ── */}
      <g fill="url(#lg-brand)">
        <circle cx="18" cy="35" r="2.2" fillOpacity="0.45" />
        <circle cx="25" cy="35" r="2.6" fillOpacity="0.60" />
        <circle cx="33" cy="35" r="3.0" fillOpacity="0.75" />
        <circle cx="42" cy="35" r="2.6" fillOpacity="0.55" />
      </g>

      {/* ── Wordmark ── */}
      <text
        x="88"
        y="46"
        fontFamily="'Space Grotesk', 'Inter', sans-serif"
        fontWeight="700"
        fontSize="28"
        fill="url(#lg-brand)"
        letterSpacing="-0.5"
      >
        ClutchAI
      </text>
    </svg>
  );
};

export default Logo;
