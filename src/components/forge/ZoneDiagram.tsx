// Print-zone diagram for the /custom content: tee front + back, zones drawn to scale with
// dimension callouts (#64 leader-line spec). Owner: P3 forge. Server-safe.
import type { ApparelCustomRules } from '@/lib/types'
import { BlankGarment, zoneRect, zoneStyle } from './BlankGarment'
import type { Side } from './model'

export function ZoneDiagram({ zones }: { zones: ApparelCustomRules['zones'] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-6">
      {(['front', 'back'] as Side[]).map((side) => {
        const z = zones[side]
        const r = zoneRect('tshirt', side, z)
        return (
          <figure key={side} className="relative border-4 border-ink bg-lav p-3 text-ink shadow-hard sm:p-6">
            <div aria-hidden="true" className="screentone screentone-light pointer-events-none absolute inset-0" style={{ ['--tone-opacity' as string]: 0.16 }} />
            <div className="relative mx-auto max-w-[420px]" style={{ aspectRatio: '1000 / 1100' }}>
              <BlankGarment kind="tshirt" side={side} id={`zd-${side}`} />
              <div className="absolute" style={zoneStyle(r)}>
                <div className="absolute inset-0 border-2 border-dashed border-volt bg-volt/15" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-volt px-1 font-mono text-[10px] font-bold text-ink sm:text-xs">
                  {z.w}×{z.h} in
                </span>
              </div>
            </div>
            <figcaption className="relative mt-3 flex items-baseline justify-between gap-2 border-t-[3px] border-ink pt-2">
              <span className="font-display text-2xl uppercase leading-none sm:text-4xl">{side}</span>
              <span className="font-mono text-xs font-bold sm:text-sm">
                {z.w} × {z.h} {z.unit}
              </span>
            </figcaption>
          </figure>
        )
      })}
    </div>
  )
}

export default ZoneDiagram
