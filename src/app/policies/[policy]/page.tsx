// /policies/privacy | shipping | returns | terms (CONTRACTS §10.7, SITEMAP §2.11). Owner: P5.
// Static for the four slugs; anything else → 404. Unknown facts are marked "being finalised — message us".
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Hourglass } from 'lucide-react'
import JsonLd from '@/components/seo/JsonLd'
import { PageHero } from '@/components/content/PageHero'
import { pageMeta } from '@/components/content/meta'
import { POLICIES, POLICIES_UPDATED, policyBySlug } from '@/components/content/policies'
import { absUrl, WEBSITE_ID } from '@/lib/seo'
import { cn } from '@/lib/utils'

type Props = { params: Promise<{ policy: string }> }

export function generateStaticParams() {
  return POLICIES.map((p) => ({ policy: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = policyBySlug((await params).policy)
  if (!p) return {}
  return pageMeta({ title: p.title, description: p.description, path: `/policies/${p.slug}` })
}

export default async function PolicyPage({ params }: Props) {
  const p = policyBySlug((await params).policy)
  if (!p) notFound()
  const others = POLICIES.filter((x) => x.slug !== p.slug)

  return (
    <>
      <PageHero
        compact
        kicker={p.kicker}
        title={p.h1}
        jp={p.jp}
        crumbs={[{ name: p.h1, path: `/policies/${p.slug}` }]}
        intro={
          <>
            {p.intro}
            <p className="label mt-5 text-tone-3">Last updated · {POLICIES_UPDATED}</p>
          </>
        }
      />

      <div className="relative border-t-4 border-ink bg-paper text-ink grain">
        <div className="container-x grid gap-10 py-12 sm:py-16 lg:grid-cols-12 lg:gap-14 lg:py-20">
          <nav aria-label="On this page" className="lg:col-span-3">
            <div className="border-4 border-ink bg-paper p-4 shadow-hard-sm lg:sticky lg:top-28">
              <p className="label text-tone-2">On this page</p>
              <ol className="mt-3 space-y-1">
                {p.sections.map((s, i) => (
                  <li key={s.id}>
                    <Link href={`#${s.id}`} className="focus-ring group flex min-h-10 items-center gap-2 py-1 text-[15px] font-medium hover:text-door">
                      <span className="font-mono text-[11px] text-tone-3 transition-colors group-hover:text-door">{String(i + 1).padStart(2, '0')}</span>
                      <span className="flex-1">{s.toc}</span>
                      {s.pending && <Hourglass aria-label="being finalised" className="size-3.5 shrink-0 text-tone-3" />}
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <article className="lg:col-span-8 lg:col-start-5">
            {p.sections.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className={cn('scroll-mt-28', i > 0 && 'mt-14 border-t-[3px] border-ink pt-10')}>
                <p className="label text-tone-2">{String(i + 1).padStart(2, '0')}</p>
                <h2 id={`${s.id}-h`} className="h-display mt-2 text-[clamp(36px,5vw,64px)]">
                  {s.h2}
                </h2>
                {s.pending && (
                  <p className="mt-4 inline-flex flex-wrap items-center gap-2 border-[3px] border-ink bg-volt px-3 py-2 text-[14px] font-semibold shadow-hard-sm">
                    <Hourglass aria-hidden="true" className="size-4" />
                    Being finalised —{' '}
                    <Link href="/contact" className="underline decoration-2 underline-offset-2 hover:text-door">
                      message us
                    </Link>
                  </p>
                )}
                <div className="mt-5 max-w-[68ch] text-[17px] leading-[1.65] [&_li]:mt-2 [&_li]:pl-1 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p+p]:mt-4 [&_ul]:mt-4 [&_ul]:list-[square] [&_ul]:pl-6 [&_li::marker]:text-door">
                  {s.body}
                </div>
              </section>
            ))}

            <div className="mt-16 border-4 border-ink bg-ink p-6 text-paper shadow-hard">
              <p className="label text-volt">Other policies</p>
              <ul className="mt-3 flex flex-wrap gap-3">
                {others.map((o) => (
                  <li key={o.slug}>
                    <Link href={`/policies/${o.slug}`} className="press focus-ring label inline-flex min-h-11 items-center gap-2 border-[3px] border-paper px-3 py-2 hover:bg-paper hover:text-ink">
                      {o.h1}
                      <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/contact" className="press focus-ring label inline-flex min-h-11 items-center gap-2 border-[3px] border-paper bg-volt px-3 py-2 font-bold text-ink hover:bg-volt-hot">
                    Contact us
                  </Link>
                </li>
              </ul>
            </div>
          </article>
        </div>
      </div>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: p.title,
          url: absUrl(`/policies/${p.slug}`),
          description: p.description,
          isPartOf: { '@id': WEBSITE_ID },
          inLanguage: 'en-IN',
        }}
      />
    </>
  )
}
