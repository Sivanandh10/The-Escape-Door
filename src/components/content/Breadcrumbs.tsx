// Thin screentone breadcrumb strip (SITEMAP §6.1) + BreadcrumbList JSON-LD. Owner: P5. Server component.
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import JsonLd from '@/components/seo/JsonLd'
import { breadcrumbJsonLd } from '@/lib/seo'
import { cn } from '@/lib/utils'

export interface Crumb {
  name: string
  path: string
}

export function Breadcrumbs({ items, tone = 'ink', className }: { items: Crumb[]; tone?: 'ink' | 'paper'; className?: string }) {
  const trail: Crumb[] = [{ name: 'Home', path: '/' }, ...items]
  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className={cn(
          'relative border-b-[3px]',
          tone === 'ink' ? 'border-tone-2 bg-ink text-tone-4' : 'border-ink bg-paper text-tone-2',
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="tone-bg pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{ ['--tone-color' as string]: tone === 'ink' ? 'var(--color-tone-3)' : 'var(--color-tone-4)', ['--tone-step' as string]: '5px' }}
        />
        <ol className="container-x relative flex min-h-10 flex-wrap items-center gap-x-1.5 gap-y-1 py-2">
          {trail.map((c, i) => {
            const last = i === trail.length - 1
            return (
              <li key={c.path} className="label flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className={tone === 'ink' ? 'text-volt' : 'text-ink'}>
                    {c.name}
                  </span>
                ) : (
                  <>
                    <Link
                      href={c.path}
                      className="focus-ring inline-flex min-h-8 items-center underline-offset-4 transition-colors duration-150 hover:underline hover:decoration-2"
                    >
                      {c.name}
                    </Link>
                    <ChevronRight aria-hidden="true" className="size-3.5 opacity-60" />
                  </>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
      <JsonLd data={breadcrumbJsonLd(trail)} />
    </>
  )
}

export default Breadcrumbs
