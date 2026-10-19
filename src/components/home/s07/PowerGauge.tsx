// "POWER LEVEL" gauge. Fill + marker read the section's --g var (0..1) — clip-path / transform only.
// Equal segment per tier; ticks show the real GSM boundaries from data. Decorative (readout is in text).
import type { HoodieTier } from '@/lib/types'
import { cn } from '@/lib/utils'

export function PowerGauge({
  tiers,
  active,
  orientation,
  className,
}: {
  tiers: HoodieTier[]
  active: number
  orientation: 'v' | 'h'
  className?: string
}) {
  const n = tiers.length
  const v = orientation === 'v'
  const ticks = [...tiers.map((t) => t.gsmMin), tiers[n - 1].gsmMax]
  return (
    <div aria-hidden="true" className={cn('relative', v ? 'ml-9 h-full min-h-[300px] w-12' : 'mb-6 h-11 w-full', className)}>
      <div className={cn('absolute inset-0 overflow-hidden border-[3px] bg-tone-1', active === n - 1 ? 'border-volt' : 'border-paper')}>
        <div className="s07-gauge-tone absolute inset-0" />
        <div className={cn('s07-fill absolute inset-0', v ? 's07-fill-v' : 's07-fill-h')} />
        {tiers.slice(1).map((t, i) => (
          <span
            key={t.id}
            className={cn('absolute bg-ink', v ? 'inset-x-0 h-[3px]' : 'inset-y-0 w-[3px]')}
            style={v ? { bottom: `${((i + 1) / n) * 100}%` } : { left: `${((i + 1) / n) * 100}%` }}
          />
        ))}
        {tiers.map((t, i) => (
          <span
            key={t.id}
            className={cn(
              'absolute flex items-center justify-center font-mono text-[10px] font-bold',
              v ? 'inset-x-0' : 'inset-y-0',
              i <= active ? 'text-ink' : 'text-paper/50',
            )}
            style={v ? { bottom: `${(i / n) * 100}%`, height: `${100 / n}%` } : { left: `${(i / n) * 100}%`, width: `${100 / n}%` }}
          >
            {v ? `L${t.level}` : t.code}
          </span>
        ))}
      </div>
      {/* scanner marker */}
      <div className={cn('pointer-events-none absolute inset-0', v ? 's07-mark-v' : 's07-mark-h')}>
        <span className={cn('absolute bg-paper', v ? '-inset-x-2 top-0 h-[3px] -translate-y-1/2' : '-inset-y-2 right-0 w-[3px] translate-x-1/2')} />
      </div>
      {ticks.map((gsm, i) => (
        <span
          key={i}
          className={cn('absolute font-mono text-[10px] tabular-nums text-paper/60', v ? 'right-full mr-2 translate-y-1/2' : 'top-full mt-1.5')}
          style={
            v
              ? { bottom: `${(i / n) * 100}%` }
              : { left: `${(i / n) * 100}%`, transform: i === 0 ? 'none' : i === n ? 'translateX(-100%)' : 'translateX(-50%)' }
          }
        >
          {gsm}
        </span>
      ))}
    </div>
  )
}
