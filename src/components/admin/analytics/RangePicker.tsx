// Date-range tabs (P4a). Server-safe: plain links to ?range=N.
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { RANGES } from './types'

export function RangePicker({ basePath, current, from, to }: { basePath: string; current: number; from: string; to: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <nav aria-label="Date range" className="inline-flex border-2 border-paper/20 bg-ink">
        {RANGES.map((d) => (
          <Link
            key={d}
            href={`${basePath}?range=${d}`}
            scroll={false}
            aria-current={d === current ? 'true' : undefined}
            className={cn(
              'grid min-h-11 min-w-14 place-items-center px-3 font-mono text-[12px] font-bold uppercase tracking-[0.1em] focus-ring transition-colors duration-150',
              d === current ? 'bg-volt text-ink' : 'text-paper/70 can-hover:hover:bg-paper/5 can-hover:hover:text-paper',
            )}
          >
            {d}D
          </Link>
        ))}
      </nav>
      <p className="font-mono text-[11.5px] text-paper/50">
        {from} → {to} · UTC
      </p>
    </div>
  )
}
