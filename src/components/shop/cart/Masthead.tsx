// Page masthead for /cart and /wishlist: chapter label, big H1 with accent word, JP subtitle,
// outline type echo behind (#47). Server component. Owner: P2.
import type { ReactNode } from 'react'

export function Masthead({ kicker, jp, echo, children }: { kicker: string; jp: string; echo: string; children: ReactNode }) {
  return (
    <header className="relative overflow-hidden border-b-4 border-paper/10 pb-8 pt-10 md:pb-12 md:pt-16">
      <p
        aria-hidden="true"
        className="outline-text pointer-events-none absolute -right-4 top-2 select-none whitespace-nowrap font-display text-[clamp(120px,22vw,320px)] uppercase leading-none opacity-[0.14] [--stroke-w:1.5px]"
      >
        {echo}
      </p>
      <div className="container-x relative">
        <p className="label text-[11px] text-volt">{kicker}</p>
        <h1 className="h-display mt-3 text-[clamp(60px,10vw,144px)]">{children}</h1>
        <p lang="ja" className="jp-sub mt-3 text-[13px]">{jp}</p>
      </div>
    </header>
  )
}
