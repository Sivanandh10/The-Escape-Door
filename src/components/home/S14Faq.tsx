// HOME · Questions, answered — 4 answer blocks (GEO) as the #49 accordion + "More questions" → /faq.
// Answers come from the shared FAQ data (src/components/content/faq.ts) so home, /faq and the FAQPage JSON-LD
// never drift. Answers stay in the DOM (crawlable) while closed. Owner: HOME.
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import JsonLd from '@/components/seo/JsonLd'
import { faqJsonLd } from '@/lib/seo'
import { Accordion } from '@/components/content/Accordion'
import { FAQ } from '@/components/content/faq'

const HOME_IDS = ['oversized-tee-price', 'hoodie-gsm', 'own-design', 'official-merch']

export default function S14Faq() {
  const items = HOME_IDS.map((id) => FAQ.find((f) => f.id === id)).filter((f): f is (typeof FAQ)[number] => !!f)
  return (
    <section id="faq" aria-labelledby="faq-title" className="border-t-4 border-ink bg-paper py-12 text-ink grain md:py-16">
      <div className="container-x grid gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-4">
          <p className="label text-tone-3">Chapter 05 · Questions, answered</p>
          <h2 id="faq-title" className="h-display mt-3 max-w-[12ch] text-[clamp(40px,5vw,72px)] leading-[0.88]">
            Asked <em>first</em>
          </h2>
          <span lang="ja" aria-hidden="true" className="jp-sub mt-3 block">
            よくある質問
          </span>
          <Link
            href="/faq"
            className="press focus-ring group mt-6 inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-volt px-5 font-bold text-ink shadow-hard-sm"
          >
            More questions
            <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={3} />
          </Link>
        </div>
        <Accordion items={items} level={3} defaultOpen={-1} tone="paper" className="lg:col-span-8" />
      </div>
      <JsonLd id="ld-home-faq" data={faqJsonLd(items.map(({ q, a }) => ({ q, a })))} />
    </section>
  )
}
