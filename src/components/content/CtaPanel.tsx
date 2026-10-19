// "Next chapter" closing panel for content pages (SITEMAP §6.1). Owner: P5. Server component.
// A slanted volt panel with one primary route + secondary links. Feedback: press-slam on every link.
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Panel } from '@/components/fx/Panel'
import { Sfx } from '@/components/fx/Sfx'
import { Magnetic } from '@/components/motion/Magnetic'
import { Reveal } from '@/components/motion/Reveal'

export interface CtaPanelProps {
  kicker: string
  title: string
  jp: string
  primary: { href: string; label: string }
  links: Array<{ href: string; label: string; external?: boolean }>
  sfx?: string
}

export function CtaPanel({ kicker, title, jp, primary, links, sfx = 'バン!' }: CtaPanelProps) {
  return (
    <section aria-label={title} className="section-y relative overflow-hidden bg-ink">
      <div className="container-x">
        <Reveal variant="slam" self>
          <Panel tone="volt" slant="right" slantSize="9%" shadow="paper" innerClassName="p-6 pr-[14%] sm:p-10 sm:pr-[14%] lg:p-14 lg:pr-[14%]">
            <p className="label">{kicker}</p>
            <p className="h-display mt-4 max-w-[16ch] text-[clamp(44px,7vw,104px)]">{title}</p>
            <span lang="ja" aria-hidden="true" className="jp-sub mt-3 block">
              {jp}
            </span>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Magnetic>
                <Link
                  href={primary.href}
                  className="press focus-ring label inline-flex min-h-13 items-center gap-2 border-[3px] border-ink bg-ink px-5 py-3.5 text-[13px] font-bold text-paper shadow-[5px_5px_0_0_var(--color-paper)] hover:bg-door"
                >
                  {primary.label}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </Magnetic>
              {links.map((l) =>
                l.external ? (
                  <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="focus-ring label inline-flex min-h-11 items-center underline decoration-2 underline-offset-4 hover:text-door">
                    {l.label} ↗
                  </a>
                ) : (
                  <Link key={l.href} href={l.href} className="focus-ring label inline-flex min-h-11 items-center underline decoration-2 underline-offset-4 hover:text-door">
                    {l.label}
                  </Link>
                ),
              )}
            </div>
          </Panel>
        </Reveal>
      </div>
      <span aria-hidden="true" className="pointer-events-none absolute bottom-[12%] right-[4%] hidden md:block">
        <Sfx text={sfx} size="lg" tone="paper" rotate={-10} pop />
      </span>
    </section>
  )
}

export default CtaPanel
