// S09 CUSTOM FORGE TEASER (#05 fly-in slam + #66-style door CTA). Owner: S09 section agent.
// Server component: reads custom minimums + design fee from data (never hardcoded), hands the animated
// stage to a client island. H2 + JP subtitle + steps + minimum chips are static HTML.
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { getApparelCustom, getCustomRules } from '@/lib/data/repo'
import { formatINR } from '@/lib/pricing'
import { ForgeStage } from './s09/ForgeStage'
import { ForgeCta } from './s09/ForgeCta'

const MIN_LABEL: Record<string, string> = {
  polaroid: 'Polaroids',
  bookmark: 'Bookmarks',
  sticker: 'Stickers',
  badge: 'Badges',
}

export default async function S09ForgeTeaser() {
  const [rules, apparelCustom] = await Promise.all([getCustomRules(), getApparelCustom()])
  const mins = Object.keys(MIN_LABEL)
    .map((type) => rules.find((r) => r.type === type))
    .filter((r): r is NonNullable<typeof r> => !!r && r.minQty > 1)
  const fee = formatINR(apparelCustom.companyDesignFee)
  const { front, back } = apparelCustom.zones

  const steps = [
    { n: '01', t: 'Pick your product', d: 'Tee, hoodie, polaroids, bookmarks, stickers or badges.' },
    { n: '02', t: 'Upload, or let us design it', d: `Send your own artwork, or brief us and we draw it for ${fee} extra.` },
    { n: '03', t: 'Get it on WhatsApp', d: 'Your request lands in our WhatsApp with every detail, ready to confirm.' },
  ]

  return (
    <section id="forge" aria-labelledby="forge-title" className="section-y relative overflow-hidden border-t-4 border-ink bg-door text-paper">
      <div className="container-x grid items-start gap-10 lg:grid-cols-12 lg:gap-x-12 lg:gap-y-10">
        <div className="lg:col-span-5 lg:pt-4">
          <p className="label text-volt">Chapter 09 · Design Your Own</p>
          <h2 id="forge-title" className="h-display mt-4 max-w-[14ch] text-h2">
            Design your <em>own</em> — bring the art, we print it
          </h2>
          <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block text-paper/70">
            特注工房
          </span>
          <p className="mt-6 max-w-[46ch] text-paper/90">
            Send your own artwork, or have us create the design for {fee} extra. The front print area is{' '}
            <strong className="font-mono font-bold text-volt">
              {front.w}×{front.h} {front.unit}
            </strong>{' '}
            and the back goes up to{' '}
            <strong className="font-mono font-bold text-volt">
              {back.w}×{back.h} {back.unit}
            </strong>
            . The final price depends on the garment you choose.
          </p>
        </div>

        <div className="lg:col-span-7 lg:row-span-2">
          <ForgeStage />
        </div>

        <div className="lg:col-span-5">
          <ol className="grid gap-3" aria-label="How Design Your Own works">
            {steps.map((s, i) => (
              <li
                key={s.n}
                className="grid grid-cols-[auto_1fr] items-center gap-4 border-[3px] border-ink bg-paper p-3 pr-4 text-ink shadow-hard lg:ml-[calc(var(--i)*5%)]"
                style={{ '--i': i } as CSSProperties}
              >
                <span aria-hidden="true" className="grid size-14 place-items-center border-[3px] border-ink bg-volt font-display text-[34px] leading-none">
                  {s.n}
                </span>
                <span>
                  <span className="block font-display text-[clamp(22px,2vw,28px)] uppercase leading-none">{s.t}</span>
                  <span className="mt-1 block text-[15px] leading-snug text-tone-2">{s.d}</span>
                </span>
              </li>
            ))}
          </ol>

          {mins.length > 0 && (
            <div className="mt-8">
              <p className="label text-paper/85">Low minimums for custom packs</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {mins.map((r) => (
                  <li key={r.type} className="inline-flex items-baseline gap-2 border-[3px] border-ink bg-ink px-3 py-2 text-paper shadow-hard-volt">
                    <span className="text-[14px] font-bold">{MIN_LABEL[r.type]}</span>
                    <span className="font-mono text-[13px] text-volt">min {r.minQty}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            <ForgeCta />
            <Link href="/faq#custom" className="focus-ring inline-flex min-h-11 items-center font-bold text-paper underline decoration-volt decoration-[3px] underline-offset-4 hover:text-volt">
              Custom order questions
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
