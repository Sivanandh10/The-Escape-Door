// STUB by F1 so the home page composes. Owner: P5 (CONTRACTS §10.8) — replace freely.
// Visible Q&A (SITEMAP §4 #1, #2, #9) + the matching FAQPage JSON-LD.
import Link from 'next/link'
import JsonLd from '@/components/seo/JsonLd'
import { faqJsonLd } from '@/lib/seo'

const QA = [
  {
    q: 'How much does an anime oversized t-shirt cost?',
    a: 'At The Escape Door, an anime oversized t-shirt costs ₹800, which keeps it under ₹1000. Regular-fit anime t-shirts cost ₹600 and baby tees cost ₹400. Every design is fan-inspired and original, chosen from a library of around 2000 t-shirt designs spanning anime, shows, movies, games, sports and more.',
  },
  {
    q: 'How are hoodies priced by GSM?',
    a: 'Hoodies at The Escape Door are priced by fabric weight. A 280–330 GSM hoodie costs ₹1200, 330–380 GSM costs ₹1500, 380–430 GSM costs ₹1800, and the heaviest 430–600 GSM hoodie costs ₹2500. Higher GSM means a thicker, warmer hoodie. Any hoodie design can also be printed with your own artwork.',
  },
  {
    q: 'Is this official licensed anime merch?',
    a: 'No. The Escape Door sells original, fan-inspired designs made by fans for fans. It is not affiliated with, endorsed by or licensed by the creators, publishers or studios of any series named on the site. Series names are used only to describe what each design is inspired by.',
  },
]

export default function S14Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="section-y border-t-4 border-ink bg-paper text-ink grain">
      <div className="container-x">
        <p className="label text-tone-3">Chapter 13 · Questions, answered</p>
        <h2 id="faq-title" className="h-display mt-4 max-w-[16ch] text-h2">
          Questions fans ask us <em>first</em>
        </h2>
        <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
          よくある質問
        </span>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {QA.map((x) => (
            <article key={x.q} className="border-4 border-ink bg-paper p-5 shadow-hard">
              <h3 className="text-[20px] font-bold leading-tight">{x.q}</h3>
              <p className="mt-3 text-[15px] text-tone-2">{x.a}</p>
            </article>
          ))}
        </div>
        <Link href="/faq" className="label mt-8 inline-flex min-h-11 items-center underline decoration-2 underline-offset-4">
          Every question about prices, custom orders and fests
        </Link>
      </div>
      <JsonLd id="ld-home-faq" data={faqJsonLd(QA)} />
    </section>
  )
}
