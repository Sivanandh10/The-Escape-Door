// Original, generic katana drawn for the S08 stage (no franchise sword designs).
// Two blades share one hilt: 'basic' (plain steel + hamon) and 'led' (lit edge, halo, sweeping light).
// The LED edge paths use pathLength=1000 so the ignition draw + sweep dash are length-independent.

const EDGE = 'M352,121 C600,121 900,110 1142,94'
const BLADE = 'M350,97 C620,96 920,86 1178,70 C1170,82 1158,91 1142,95 C900,112 600,122 350,123 Z'
const SPINE = 'M352,100 C620,99 920,89 1150,75'

export function Katana({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 220" className={className} aria-hidden="true" focusable="false">
      <defs>
        <pattern id="s08-ito" width="30" height="36" patternUnits="userSpaceOnUse">
          <rect width="30" height="36" fill="#0B0B0F" />
          <path d="M0,0 L15,18 L0,36 M30,0 L15,18 L30,36" stroke="#6D3BFF" strokeWidth="6" fill="none" />
          <path d="M15,12 l5,6 l-5,6 l-5,-6 Z" fill="#F4EFE6" />
        </pattern>
        <linearGradient id="s08-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E9EAEE" />
          <stop offset="0.55" stopColor="#B9BCC4" />
          <stop offset="1" stopColor="#F4F5F8" />
        </linearGradient>
        <linearGradient id="s08-led-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#CFC4FF" />
          <stop offset="1" stopColor="#F4EFE6" />
        </linearGradient>
      </defs>

      {/* ── basic blade ── */}
      <g className="s08-k s08-k-basic">
        <path d={BLADE} fill="url(#s08-steel)" stroke="#0B0B0F" strokeWidth="4" strokeLinejoin="round" />
        <path d={SPINE} stroke="#6E6E78" strokeWidth="2" fill="none" />
        {/* hamon: the wavy temper line */}
        <path
          d="M356,115 c18,-5 30,4 48,-1 s30,-6 48,-1 s30,-6 48,-1 s30,-6 48,-2 s30,-6 48,-2 s30,-6 48,-2 s30,-6 48,-3 s30,-6 48,-3 s30,-6 48,-3 s30,-6 48,-4 s30,-6 48,-4 s30,-6 48,-4 s30,-6 48,-5 s30,-6 48,-5 s30,-6 48,-5 s30,-5 44,-6"
          stroke="#6E6E78"
          strokeWidth="2"
          fill="none"
          opacity=".8"
        />
        <path d="M380,104 L640,102" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity=".9" />
      </g>

      {/* ── LED blade ── */}
      <g className="s08-k s08-k-led">
        <g className="s08-halo">
          <path d={EDGE} pathLength={1000} className="s08-edge" stroke="#6D3BFF" strokeOpacity=".22" strokeWidth="58" fill="none" strokeLinecap="round" />
          <path d={EDGE} pathLength={1000} className="s08-edge" stroke="#6D3BFF" strokeOpacity=".4" strokeWidth="32" fill="none" strokeLinecap="round" />
          <path d={EDGE} pathLength={1000} className="s08-edge" stroke="#FFE14D" strokeOpacity=".55" strokeWidth="16" fill="none" strokeLinecap="round" />
        </g>
        <path d={BLADE} fill="url(#s08-led-steel)" stroke="#0B0B0F" strokeWidth="4" strokeLinejoin="round" />
        <path d={SPINE} stroke="#6D3BFF" strokeWidth="2" fill="none" opacity=".6" />
        <path d={EDGE} pathLength={1000} className="s08-edge" stroke="#FFE14D" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d={EDGE} pathLength={1000} className="s08-edge" stroke="#FFFFFF" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        {/* the sweep: a bright dash running hilt → tip */}
        <path d={EDGE} pathLength={1000} className="s08-sweep" stroke="#FFFFFF" strokeWidth="14" fill="none" strokeLinecap="round" />
        {/* manga sparkle ticks at the tip */}
        <g className="s08-tick" stroke="#FFE14D" strokeWidth="5" strokeLinecap="round">
          <path d="M1180,52 l14,-20" />
          <path d="M1192,72 l24,-4" />
          <path d="M1164,40 l2,-24" />
        </g>
      </g>

      {/* ── shared hilt ── */}
      <g>
        <path d="M58,92 L300,94 L300,126 L58,128 Q44,110 58,92 Z" fill="url(#s08-ito)" stroke="#0B0B0F" strokeWidth="4" />
        <rect x="30" y="90" width="32" height="40" rx="6" fill="#2B2B33" stroke="#0B0B0F" strokeWidth="4" />
        <path d="M36,98 h20" stroke="#B9B5AC" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="314" cy="110" rx="15" ry="54" fill="#0B0B0F" stroke="#B9B5AC" strokeWidth="4" />
        <ellipse cx="314" cy="110" rx="6" ry="38" fill="none" stroke="#FFE14D" strokeWidth="2.5" />
        <rect x="328" y="94" width="24" height="32" fill="#FFE14D" stroke="#0B0B0F" strokeWidth="3.5" />
      </g>
    </svg>
  )
}
