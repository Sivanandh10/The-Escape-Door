// /policies/privacy | shipping | returns | terms (+ any page added in Admin → Pages). Owner: CMS.
// Text comes from public.pages (cached, tag 'pages' — admin saves refresh it instantly) with the built-in
// copy in @/components/content/policies as the fallback. Rendered with the tiny safe markdown renderer
// (no raw HTML). A {pending} section gets an "Ask us for details" badge that links to the contact page.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, MessageCircle } from 'lucide-react'
import JsonLd from '@/components/seo/JsonLd'
import { PageHero } from '@/components/content/PageHero'
import { pageMeta } from '@/components/content/meta'
import { POLICIES } from '@/components/content/policies'
import { absUrl, WEBSITE_ID } from '@/lib/seo'
import { cn } from '@/lib/utils'
import { getPublicPage, getPublicPages } from '../_lib/data'
import { MD_BODY_CLASS, MdBlocks, MdInline, parsePageMarkdown } from '../_lib/markdown'

type Props = { params: Promise<{ policy: string }> }

export async function generateStaticParams() {
  const pages = await getPublicPages()
  return (pages.length ? pages : POLICIES).map((p) => ({ policy: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getPublicPage((await params).policy)
  if (!p) return {}
  return pageMeta({ title: p.seoTitle, description: p.description, path: `/policies/${p.slug}` })
}

export default async function PolicyPage({ params }: Props) {
  const { policy } = await params
  const [p, all] = await Promise.all([getPublicPage(policy), getPublicPages()])
  if (!p) notFound()
  const doc = parsePageMarkdown(p.body)
  const others = all.filter((x) => x.slug !== p.slug)
  const withToc = doc.sections.length > 1

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
            <MdBlocks blocks={doc.intro} />
            <p className="label mt-5 text-tone-3">Last updated · {p.updatedLabel}</p>
          </>
        }
      />

      <div className="relative border-t-4 border-ink bg-paper text-ink grain">
        <div className="container-x grid gap-10 py-12 sm:py-16 lg:grid-cols-12 lg:gap-14 lg:py-20">
          {withToc && (
            <nav aria-label="On this page" className="lg:col-span-3">
              <div className="border-4 border-ink bg-paper p-4 shadow-hard-sm lg:sticky lg:top-28">
                <p className="label text-tone-2">On this page</p>
                <ol className="mt-3 space-y-1">
                  {doc.sections.map((s, i) => (
                    <li key={s.id}>
                      <Link href={`#${s.id}`} className="focus-ring group flex min-h-10 items-center gap-2 py-1 text-[15px] font-medium hover:text-door">
                        <span className="font-mono text-[11px] text-tone-3 transition-colors group-hover:text-door">{String(i + 1).padStart(2, '0')}</span>
                        <span className="flex-1">{s.toc}</span>
                        {s.pending && <MessageCircle aria-label="ask us for details" className="size-3.5 shrink-0 text-tone-3" />}
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            </nav>
          )}

          <article className={withToc ? 'lg:col-span-8 lg:col-start-5' : 'lg:col-span-8 lg:col-start-3'}>
            {doc.sections.length === 0 && doc.intro.length === 0 && (
              <p className="text-[17px]">
                This page is being written. Message us through the{' '}
                <Link href="/contact" className="font-semibold underline decoration-2 underline-offset-4 hover:text-door">
                  contact page
                </Link>{' '}
                for anything you need now.
              </p>
            )}
            {doc.sections.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className={cn('scroll-mt-28', i > 0 && 'mt-14 border-t-[3px] border-ink pt-10')}>
                <p className="label text-tone-2">{String(i + 1).padStart(2, '0')}</p>
                <h2 id={`${s.id}-h`} className="h-display mt-2 text-[clamp(36px,5vw,64px)]">
                  <MdInline nodes={s.title} />
                </h2>
                {s.pending && (
                  <p className="mt-4 inline-flex flex-wrap items-center gap-2 border-[3px] border-ink bg-volt px-3 py-2 text-[14px] font-semibold shadow-hard-sm">
                    <MessageCircle aria-hidden="true" className="size-4" />
                    <Link href="/contact" className="underline decoration-2 underline-offset-2 hover:text-door">
                      Ask us for details
                    </Link>
                  </p>
                )}
                <div className={cn('mt-5', MD_BODY_CLASS)}>
                  <MdBlocks blocks={s.blocks} />
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
          name: p.seoTitle,
          url: absUrl(`/policies/${p.slug}`),
          description: p.description,
          isPartOf: { '@id': WEBSITE_ID },
          inLanguage: 'en-IN',
        }}
      />
    </>
  )
}
