// Blank black oversized tee (back or front) with print-zone guides drawn to scale. Owner: S09. Server-safe.
// Silhouette matches src/lib/art/garments.ts (same 1000×1100 box) so it sits next to the product mockups.
// Scale: the back zone is 476 units wide = 12 in → ~39.7 units per inch.
import { useId } from 'react'

const TEE_PATH =
  'M405,92 Q500,116 595,92 L815,134 C872,152 928,262 980,420 L822,490 C809,472 796,454 787,434 C793,640 793,860 793,1058 Q500,1074 207,1058 C207,860 207,640 213,434 C204,454 191,472 178,490 L20,420 C72,262 128,152 185,134 Z'
const BACK_NECK = 'M405,92 Q500,116 595,92'
const FRONT_NECK = 'M405,92 C420,150 470,168 500,168 C530,168 580,150 595,92'

/** Back print zone 12×15 in, in the tee's 1000×1100 box. */
export const BACK_ZONE = { x: 262, y: 196, w: 476, h: 595 } as const
/** Front print zone 4×4 in (left chest). */
export const FRONT_ZONE = { x: 540, y: 230, w: 159, h: 159 } as const

export function BlankTee({ side = 'back', className }: { side?: 'front' | 'back'; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const z = side === 'back' ? BACK_ZONE : FRONT_ZONE
  return (
    <svg viewBox="0 0 1000 1100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={`${uid}-dots`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <circle cx="2.5" cy="2.5" r="2.1" fill="#000" />
        </pattern>
        <pattern id={`${uid}-lite`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <circle cx="2.5" cy="2.5" r="1.8" fill="#2c2c35" />
        </pattern>
        <clipPath id={`${uid}-clip`}>
          <path d={TEE_PATH} />
        </clipPath>
      </defs>
      <path d={TEE_PATH} fill="#17171C" />
      <g clipPath={`url(#${uid}-clip)`}>
        <path d="M213,434 C232,600 232,850 208,1060 L262,1060 C276,850 272,610 244,452 Z" fill={`url(#${uid}-dots)`} opacity=".85" />
        <path d="M787,434 C768,600 768,850 792,1060 L738,1060 C724,850 728,610 756,452 Z" fill={`url(#${uid}-dots)`} opacity=".85" />
        <path d="M330,170 C430,240 500,560 470,1062 L360,1062 C390,700 380,330 330,170 Z" fill={`url(#${uid}-lite)`} opacity=".5" />
        <path d="M70,392 C110,280 150,200 190,150 C198,240 204,330 210,420 Z" fill={`url(#${uid}-lite)`} opacity=".45" />
      </g>
      <g fill="none" stroke="#3A3A44" strokeWidth="2.4" strokeDasharray="7 6">
        <path d="M197,140 C212,234 219,330 222,430" />
        <path d="M803,140 C788,234 781,330 778,430" />
        <path d="M31,398 L187,468" />
        <path d="M969,398 L813,468" />
        <path d="M209,1030 Q500,1046 791,1030" />
      </g>
      {side === 'back' ? (
        <path d={BACK_NECK} stroke="#202027" strokeWidth="22" fill="none" strokeLinecap="round" />
      ) : (
        <>
          <path d={`${FRONT_NECK} Q500,112 405,92 Z`} fill="#0E0E12" />
          <path d={FRONT_NECK} stroke="#202027" strokeWidth="22" fill="none" strokeLinecap="round" />
        </>
      )}
      <path d={TEE_PATH} fill="none" stroke="#0B0B0F" strokeWidth="6" strokeLinejoin="round" />
      {/* print-zone guide (manga ruler marks) */}
      <g data-zone className="text-volt">
        <rect x={z.x} y={z.y} width={z.w} height={z.h} fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="14 10" />
        {[
          [z.x, z.y, 1, 1],
          [z.x + z.w, z.y, -1, 1],
          [z.x, z.y + z.h, 1, -1],
          [z.x + z.w, z.y + z.h, -1, -1],
        ].map(([x, y, dx, dy], i) => (
          <path key={i} d={`M${x},${y + dy * 34} L${x},${y} L${x + dx * 34},${y}`} fill="none" stroke="currentColor" strokeWidth="9" />
        ))}
      </g>
    </svg>
  )
}

export default BlankTee
