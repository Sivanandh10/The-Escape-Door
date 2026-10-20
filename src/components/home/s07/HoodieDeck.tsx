// S07 hoodie deck: one REAL hoodie product image per GSM tier, stacked like manga panels on the scanner stage.
// The active tier's hoodie sits front and centre; earlier tiers fan out behind it, later tiers wait off-stage.
// "Fabric weight" reads as physical thickness: the active card carries N hard-offset layers (more GSM = more layers),
// padded to a fixed shadow count so the change animates. Transforms / opacity only; reduced motion = no transitions.
import type { CSSProperties } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { HoodieTier } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface TierShot {
  src: string
  alt: string
  slug: string
  name: string
  sample: boolean
  color: string
}

const SHEETS = [3, 4, 6, 8]
/** fabric layers drawn under the active card per tier index (heavier tier = more layers) */
export const sheetsFor = (i: number) => SHEETS[i] ?? 3 + i * 2

const FACE = ['#C9B8FF', '#F4EFE6', '#FFB8DE', '#FFE14D', '#C9B8FF', '#F4EFE6', '#FFB8DE', '#FFE14D']

/** hard-offset "fabric layers": face strip + ink edge per layer, padded to `max` so box-shadow interpolates */
function layerShadow(count: number, max: number): string {
  const out: string[] = []
  for (let k = 1; k <= max; k++) {
    const on = k <= count
    const o = on ? `calc(var(--st) * ${k})` : '0px'
    out.push(`${o} ${o} 0 -2px ${on ? FACE[(k - 1) % FACE.length] : 'transparent'}`)
    out.push(`${o} ${o} 0 0 ${on ? 'var(--color-ink)' : 'transparent'}`)
  }
  return out.join(', ')
}

export function HoodieDeck({
  tiers,
  shots,
  active,
  armed,
}: {
  tiers: HoodieTier[]
  shots: Array<TierShot | null>
  active: number
  armed: boolean
}) {
  const max = sheetsFor(tiers.length - 1)
  return (
    <div className="s07-deck-wrap absolute inset-0 grid place-items-center">
      <div className="s07-float relative">
        <div className="s07-deck relative" data-armed={armed || undefined}>
          {tiers.map((tier, i) => {
            const shot = shots[i] ?? null
            const d = i - active
            const pos = d === 0 ? 'on' : d < 0 ? 'past' : 'next'
            const style = {
              '--d': Math.abs(d),
              '--i': i,
              zIndex: d === 0 ? 20 : 10 - Math.abs(d),
              boxShadow: d === 0 ? layerShadow(sheetsFor(i), max) : layerShadow(0, max),
              backgroundColor: shot?.color ?? 'var(--color-tone-1)',
            } as CSSProperties
            const face = shot ? (
              <Image
                src={shot.src}
                alt={d === 0 ? shot.alt : ''}
                fill
                quality={75}
                sizes="(min-width: 1024px) 22vw, (min-width: 640px) 40vw, 62vw"
                className="object-cover"
              />
            ) : (
              <span className="absolute inset-0 grid place-items-center screentone-mid">
                <span className="h-display text-[40px] text-ink/70">{tier.name}</span>
              </span>
            )
            return (
              <div
                key={tier.id}
                className="s07-card absolute inset-0 border-[3px] border-ink"
                data-pos={pos}
                style={style}
                aria-hidden={d !== 0 || undefined}
              >
                {d === 0 && shot ? (
                  <Link
                    href={`/product/${shot.slug}`}
                    tabIndex={-1}
                    aria-hidden="true"
                    data-cursor="VIEW"
                    className="absolute inset-0 block overflow-hidden"
                  >
                    {face}
                  </Link>
                ) : (
                  <div className="absolute inset-0 overflow-hidden">{face}</div>
                )}
                <span
                  className={cn(
                    'label pointer-events-none absolute -bottom-3 -left-3 z-[2] border-[3px] border-ink px-2 py-1 text-[11px] font-bold',
                    i === tiers.length - 1 ? 'bg-hype text-paper' : 'bg-volt text-ink',
                  )}
                >
                  {tier.code} · {tier.gsmLabel}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
