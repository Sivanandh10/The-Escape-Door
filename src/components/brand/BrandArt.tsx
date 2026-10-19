// Static-file versions of brand art (perf): Badge / Kado rendered once by scripts/export-art.mts into
// public/art/brand-*.svg, so the 9–18 KB of path data stays out of the HTML and the RSC payload.
// Decorative only (alt=""). Falls back to the live component if the file wasn't exported.
import { BRAND_ART } from '@/lib/art/static-art.generated'
import { Badge } from './Badge'
import { Mascot } from './Mascot'

export function BadgeArt({ className }: { className?: string }) {
  const src = BRAND_ART.badge
  if (!src) return <Badge title="" className={className} />
  // eslint-disable-next-line @next/next/no-img-element -- static vector file
  return <img src={src} alt="" aria-hidden="true" width={300} height={300} loading="lazy" decoding="async" draggable={false} className={className} />
}

/** Kado, static file. `name` = a BRAND_ART key ('kado-wave-anim-flat' | 'kado-sleepy'). */
export function KadoArt({ name, size, className }: { name: 'kado-wave-anim-flat' | 'kado-sleepy'; size?: number; className?: string }) {
  const src = BRAND_ART[name]
  if (!src) {
    return name === 'kado-sleepy' ? (
      <Mascot mood="sleepy" size={size} title="" className={className} />
    ) : (
      <Mascot mood="wave" animate shadow={false} size={size} title="" className={className} />
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static vector file (CSS idle loop plays inside)
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size ?? 200}
      height={size ? Math.round(size * 1.1) : 220}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={className}
      style={{ overflow: 'visible' }}
    />
  )
}
