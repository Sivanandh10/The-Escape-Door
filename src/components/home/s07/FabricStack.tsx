// #23 exploded fabric: isometric fabric sheets (CSS 3D, orthographic rotateX/rotateZ faces) stacked on one
// anchor. Separation follows --sp (scroll), sheet count follows the tier, and each sheet's ink slab underneath
// is its hard offset "thickness". Sheets drop in with a stagger when a heavier tier adds them. Decorative.
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

const SHEETS = [3, 4, 6, 8]
/** illustrative sheet count per tier index (heavier tier = more sheets) */
export const sheetsFor = (i: number) => SHEETS[i] ?? 3 + i * 2

const FACE = ['#C9B8FF', '#F4EFE6', '#FFB8DE', '#F4EFE6', '#C9B8FF', '#F4EFE6', '#FFB8DE', '#F4EFE6']

export function FabricStack({ count, max, armed, label }: { count: number; max: number; armed: boolean; label: string }) {
  return (
    <div aria-hidden="true" className="s07-anchor absolute left-1/2 top-[62%] h-0 w-0">
      <div className="s07-float">
        {Array.from({ length: max }, (_, i) => {
          const on = armed && i < count
          const top = i === count - 1
          return (
            <div key={i} className="s07-layer absolute left-0 top-0" style={{ '--i': i, zIndex: i } as CSSProperties}>
              <div
                className={cn('s07-drop', on && 's07-on')}
                style={{ transitionDelay: on ? `${i * 55}ms` : `${(max - i) * 20}ms` }}
              >
                <div className="s07-edge" style={{ '--t': `${6 + Math.min(i, 4)}px` } as CSSProperties} />
                <div className={cn('s07-face', top && 's07-top')} style={{ backgroundColor: top ? '#FFE14D' : FACE[i % FACE.length] }}>
                  {top && <HoodiePrint />}
                </div>
              </div>
            </div>
          )
        })}
        {/* dimension bracket: stack height = fabric weight */}
        <div className={cn('s07-dim', armed && 's07-dim-on')}>
          <span className="s07-dim-line" />
          <span className="s07-dim-cap s07-dim-cap-top" />
          <span className="s07-dim-cap" />
          <span className="s07-dim-label">
            <span className="block font-mono text-[13px] font-bold leading-tight text-volt">{label}</span>
            <span className="label mt-0.5 block text-[10px] text-paper/60">stack weight</span>
          </span>
        </div>
      </div>
    </div>
  )
}

/** original hoodie silhouette printed on the top sheet (no marks, no franchise art) */
function HoodiePrint() {
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-[14%] rotate-45" fill="none">
      <path
        d="M37 17 Q50 5 63 17 L80 25 L95 60 L84 65 L76 47 L76 92 L24 92 L24 47 L16 65 L5 60 L20 25 Z"
        fill="#0B0B0F"
      />
      <path d="M40 19 Q50 35 60 19" stroke="#FFE14D" strokeWidth="3" />
      <path d="M46 30 L45 44 M54 30 L55 44" stroke="#F4EFE6" strokeWidth="2" strokeLinecap="round" />
      <path d="M35 68 H65 L62 82 H38 Z" stroke="#F4EFE6" strokeWidth="2.5" />
      <path d="M24 86 H76" stroke="#6D3BFF" strokeWidth="4" />
    </svg>
  )
}
