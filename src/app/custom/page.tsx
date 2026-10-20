// /custom — the Custom Forge studio + service content (SITEMAP §2.6). Owner: P3 forge.
// Static: data comes from 'use cache' repo reads; the studio reads ?product= inside <Suspense>.
import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import JsonLd from '@/components/seo/JsonLd'
import { Sfx } from '@/components/fx/Sfx'
import { ForgeStudio } from '@/components/forge/ForgeStudio'
import { StudioSkeleton } from '@/components/forge/StudioSkeleton'
import { ZoneDiagram } from '@/components/forge/ZoneDiagram'
import { ForgeFaq } from '@/components/forge/ForgeFaq'
import { KindIcon } from '@/components/forge/KindIcon'
import { KIND_META, type ForgeData } from '@/components/forge/model'
import { getApparelCustom, getCustomRules, getHoodieTiers, getPartnerships, getTeeFits } from '@/lib/data/repo'
import { formatINR } from '@/lib/pricing'
import { breadcrumbJsonLd, faqJsonLd, serviceJsonLd } from '@/lib/seo'

const TITLE = 'Custom Anime T-Shirt Printing India — Design Your Own | Escape Door'
const DESCRIPTION =
  'Print your own design: front 4×4 in, back 12×15 in. Send your art, or we design it for ₹200 extra. Custom polaroids from 20 pcs, badges in bulk.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/custom' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/custom', type: 'website' },
  twitter: { title: TITLE, description: DESCRIPTION },
}

function SectionHead({ id, kicker, jp, children, className }: { id: string; kicker: string; jp: string; children: React.ReactNode; className?: string }) {
  return (
    <header className={className}>
      <p className="label text-volt">{kicker}</p>
      <h2 id={id} className="h-display mt-3 max-w-[18ch] text-[clamp(40px,6vw,92px)]">
        {children}
      </h2>
      <span lang="ja" aria-hidden="true" className="jp-sub mt-3 block">
        {jp}
      </span>
    </header>
  )
}

export default async function CustomPage() {
  const [rules, fits, tiers, partnerships, apparelCustom] = await Promise.all([getCustomRules(), getTeeFits(), getHoodieTiers(), getPartnerships(), getApparelCustom()])
  const data: ForgeData = { fits, tiers, rules, apparel: apparelCustom }
  const z = apparelCustom.zones
  const fee = formatINR(apparelCustom.companyDesignFee)
  const flat = (['polaroid', 'bookmark', 'sticker', 'badge'] as const)
    .map((k) => ({ k, rule: rules.find((r) => r.type === k) }))
    .filter((x): x is { k: typeof x.k; rule: NonNullable<typeof x.rule> } => !!x.rule)
  const polaroid = rules.find((r) => r.type === 'polaroid')

  const faq = [
    {
      q: 'Can I print my own artwork on a tee or hoodie?',
      a: `Yes. Upload your artwork in Design Your Own, or ask us to draw it for ${fee} extra. The front print area is ${z.front.w}×${z.front.h} inches and the back print area is ${z.back.w}×${z.back.h} inches. The garment you pick sets the final price, and we confirm it on WhatsApp before printing.`,
    },
    {
      q: 'How many custom polaroids do I need to order?',
      a: polaroid
        ? `Custom polaroid-style prints start at ${polaroid.minQty} pieces, and every piece can be a different design. At ${formatINR(polaroid.unitPrice ?? 0)} each, ${polaroid.minQty} pieces come to ${formatINR((polaroid.unitPrice ?? 0) * polaroid.minQty)}.`
        : 'Custom polaroid-style prints have a minimum order; Design Your Own shows it when you pick polaroids.',
    },
    {
      q: 'How do I pay and confirm a custom order?',
      a: 'Design Your Own does not charge you. It sends your request — product, quantity, print placement and files — to us on WhatsApp. We reply with the confirmed price and next steps before anything is printed.',
    },
  ]

  return (
    <>
      <JsonLd
        data={[
          serviceJsonLd({ name: 'Design Your Own — custom anime merch printing', serviceType: 'Custom merchandise printing', path: '/custom', description: DESCRIPTION }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Design Your Own', path: '/custom' },
          ]),
          faqJsonLd(faq),
        ]}
      />

      {/* ───────── hero */}
      <section aria-labelledby="forge-h1" className="relative overflow-hidden border-b-4 border-paper/10 pb-10 pt-8 sm:pb-14 sm:pt-12">
        <div aria-hidden="true" className="screentone screentone-dense pointer-events-none absolute inset-0 text-door" style={{ ['--tone-opacity' as string]: 0.22 }} />
        <div className="container-x relative">
          <nav aria-label="Breadcrumb" className="label text-paper/60">
            <ol className="flex gap-2">
              <li>
                <Link href="/" className="focus-ring can-hover:hover:text-volt">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-paper">
                Design Your Own
              </li>
            </ol>
          </nav>
          <div className="mt-6 grid items-end gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <p className="label text-volt">Design Your Own · 特注工房</p>
              <h1 id="forge-h1" className="h-display mt-4 max-w-[14ch] text-[clamp(52px,8.4vw,132px)]">
                Design your <em>own</em>: your art, our press
              </h1>
              <p className="mt-6 max-w-[56ch] text-[17px] leading-relaxed text-paper/85 sm:text-lg">
                Put your own art on an oversized tee, a heavyweight hoodie, polaroids, bookmarks, stickers or badges. Upload a file, or tell us the idea and we draw it. You see the
                price as you go, then send the whole request to us on WhatsApp.
              </p>
            </div>
            <ul className="flex flex-wrap gap-2 lg:col-span-4 lg:flex-col lg:items-end" aria-label="Design Your Own facts">
              {[
                `Front ${z.front.w}×${z.front.h} in`,
                `Back ${z.back.w}×${z.back.h} in`,
                `We design it +${fee}`,
                polaroid ? `Polaroids from ${polaroid.minQty} pcs` : null,
              ]
                .filter(Boolean)
                .map((t, i) => (
                  <li key={t} className={i === 0 ? 'border-[3px] border-ink bg-volt px-3 py-2 font-mono text-sm font-bold text-ink shadow-hard-paper' : 'border-[3px] border-paper px-3 py-2 font-mono text-sm font-bold'}>
                    {t}
                  </li>
                ))}
            </ul>
          </div>
        </div>
        <span aria-hidden="true" className="pointer-events-none absolute -right-6 top-6 hidden opacity-90 lg:block">
          <Sfx text="ゴゴゴ" size="lg" tone="door" rotate={10} />
        </span>
      </section>

      {/* ───────── studio */}
      <section id="forge" aria-labelledby="forge-studio" className="relative scroll-mt-20 pb-16 pt-10 sm:pb-24 sm:pt-14">
        <div className="container-x">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
            <SectionHead id="forge-studio" kicker="Studio · open now" jp="工房、開店中">
              The press is <em>open</em>
            </SectionHead>
            <p className="max-w-[40ch] text-[15px] text-paper/75">Four steps. Your choices save on this device, so you can come back to them.</p>
          </div>
          <Suspense fallback={<StudioSkeleton />}>
            <ForgeStudio data={data} />
          </Suspense>
        </div>
      </section>

      {/* ───────── how it works */}
      <section aria-labelledby="forge-how" className="section-y border-t-4 border-ink bg-paper text-ink grain">
        <div className="container-x">
          <SectionHead id="forge-how" kicker="How it works" jp="三つのステップ" className="[&_.label]:text-door">
            How <em>Design Your Own</em> works in three steps
          </SectionHead>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { n: '01', t: 'Pick the product', d: `Tee in your fit (${fits.map((f) => `${f.label.toLowerCase()} ${formatINR(f.price)}`).join(', ')}), a hoodie by GSM, or a bulk run of polaroids, bookmarks, stickers or badges.` },
              { n: '02', t: 'Bring the design', d: `Upload PNG, JPG, WebP, SVG or PDF up to 10 MB, or choose “Let us design it” and describe the idea (${fee} extra on apparel).` },
              { n: '03', t: 'Get it on WhatsApp', d: 'Your request arrives in our WhatsApp, typed out with placement, quantity and files. We confirm the price, then print.' },
            ].map((s, i) => (
              <li key={s.n} className={`relative border-4 border-ink p-5 shadow-hard sm:p-6 ${i === 1 ? 'bg-lav' : i === 2 ? 'bg-volt' : 'bg-paper'}`}>
                <span className="font-display text-7xl leading-none">{s.n}</span>
                <h3 className="mt-3 font-display text-3xl uppercase leading-none">{s.t}</h3>
                <p className="mt-3 text-[15px] leading-relaxed">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────── print zones */}
      <section aria-labelledby="forge-zones" className="section-y">
        <div className="container-x grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <SectionHead id="forge-zones" kicker="Print zones" jp="プリント範囲">
              Print <em>zones</em>: front {z.front.w}×{z.front.h} in, back {z.back.w}×{z.back.h} in
            </SectionHead>
            <p className="mt-6 max-w-[48ch] text-[16px] leading-relaxed text-paper/85">
              The front zone is a {z.front.w}×{z.front.h} inch square on the chest — right for a mark, a kanji or a small character crest of your own. The back zone is a full{' '}
              {z.back.w}×{z.back.h} inch panel for the big piece. The live preview draws both zones to scale on the garment, so what you place is what we print.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="border-[3px] border-paper p-4">
                <p className="label text-volt">Tees by fit</p>
                <ul className="mt-2 space-y-1 font-mono text-sm">
                  {fits.map((f) => (
                    <li key={f.id} className="flex justify-between gap-2">
                      <span>{f.label}</span>
                      <span className="font-bold">{formatINR(f.price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-[3px] border-paper p-4">
                <p className="label text-volt">Hoodies by GSM</p>
                <ul className="mt-2 space-y-1 font-mono text-sm">
                  {tiers.map((t) => (
                    <li key={t.id} className="flex justify-between gap-2">
                      <span>{t.gsmLabel}</span>
                      <span className="font-bold">{formatINR(t.price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-4 text-[14px] text-paper/70">
              The final price depends on the garment. Browse ready designs in{' '}
              <Link href="/shop/oversized-t-shirts" className="font-bold text-volt underline underline-offset-2">
                oversized t-shirts
              </Link>{' '}
              and{' '}
              <Link href="/shop/hoodies" className="font-bold text-volt underline underline-offset-2">
                hoodies
              </Link>
              .
            </p>
          </div>
          <div className="lg:col-span-7">
            <ZoneDiagram zones={z} />
          </div>
        </div>
      </section>

      {/* ───────── your art or ours */}
      <section aria-labelledby="forge-draw" className="section-y border-y-4 border-ink bg-door text-paper">
        <div className="container-x">
          <SectionHead id="forge-draw" kicker="Design source" jp="あなたの絵、または私たちの絵" className="[&_.label]:text-volt">
            Your art, or we <em>draw</em> it for {fee}
          </SectionHead>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="border-4 border-ink bg-paper p-6 text-ink shadow-hard">
              <p className="font-display text-4xl uppercase leading-none">Your art</p>
              <p className="mt-3 text-[15px] leading-relaxed">
                Send the file you already have: PNG, JPG, WebP, SVG or PDF, up to 10 MB each and up to six per request. A transparent background and the largest version you own give the
                cleanest print. No file on this device? Send the request anyway and share the art in the WhatsApp chat.
              </p>
            </div>
            <div className="border-4 border-ink bg-volt p-6 text-ink shadow-hard">
              <p className="flex items-baseline justify-between gap-3">
                <span className="font-display text-4xl uppercase leading-none">We draw it</span>
                <span className="bg-ink px-2 py-1 font-mono text-sm font-bold text-volt">+{fee}</span>
              </p>
              <p className="mt-3 text-[15px] leading-relaxed">
                Describe the idea — the fandom, a line you love, colours, where it sits — and add reference images if you have them. On tees and hoodies the design fee is {fee}; for bulk
                items we quote the design on WhatsApp. Original art only: we don&apos;t copy official logos or key art.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── minimums */}
      <section aria-labelledby="forge-min" className="section-y">
        <div className="container-x">
          <SectionHead id="forge-min" kicker="Bulk minimums" jp="最小ロット">
            Bulk minimums in <em>plain</em> numbers
          </SectionHead>
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {flat.map(({ k, rule }, i) => (
              <li key={k} className={`relative border-4 border-ink p-4 text-ink shadow-hard sm:p-5 ${['bg-volt', 'bg-lav', 'bg-pink', 'bg-paper'][i % 4]}`}>
                <KindIcon kind={k} className="absolute right-3 top-3 h-9 w-9 opacity-80" />
                <p className="label">{KIND_META[k].plural}</p>
                <p className="mt-2 font-display text-[clamp(56px,7vw,96px)] leading-[0.85]">{rule.minQty}</p>
                <p className="label mt-1">pieces minimum</p>
                {rule.unitPrice != null ? (
                  <p className="mt-3 border-t-[3px] border-ink pt-2 font-mono text-[13px] font-bold">
                    {formatINR(rule.unitPrice)} each · {rule.minQty} × {formatINR(rule.unitPrice)} = {formatINR(rule.unitPrice * rule.minQty)}
                  </p>
                ) : (
                  <p className="mt-3 border-t-[3px] border-ink pt-2 font-mono text-[13px] font-bold">Price on request</p>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-[60ch] text-[15px] text-paper/75">
            Designs can be the same or all different within one order. Ready-made packs live in the shop:{' '}
            <Link href="/shop/polaroids" className="font-bold text-volt underline underline-offset-2">
              polaroids
            </Link>{' '}
            and{' '}
            <Link href="/shop/badges" className="font-bold text-volt underline underline-offset-2">
              badges
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ───────── clubs & fests */}
      <section aria-labelledby="forge-fests" className="section-y border-t-4 border-ink bg-lav text-ink">
        <div className="container-x grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <SectionHead id="forge-fests" kicker="Clubs · teams · fests" jp="サークルとフェス" className="[&_.label]:text-door [&_.jp-sub]:text-ink">
              Custom for clubs, teams and <em>fests</em>
            </SectionHead>
            <p className="mt-6 max-w-[54ch] text-[16px] leading-relaxed">
              Committee tees, club hoodies, badge runs for a whole fest, polaroid sets for a farewell — Design Your Own handles bulk the same way it handles one tee. Pick the product, set the
              quantity, attach the art. For stalls and fest partnerships, start on the fests page.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/fests" className="label focus-ring press inline-flex min-h-12 items-center border-[3px] border-ink bg-ink px-5 font-bold text-paper shadow-hard-volt">
                Fest partnerships →
              </Link>
              <a href="#forge" className="label focus-ring press inline-flex min-h-12 items-center border-[3px] border-ink bg-paper px-5 font-bold shadow-hard">
                Start a bulk request
              </a>
            </div>
          </div>
          <div className="lg:col-span-5">
            <p className="label mb-3">We&apos;ve partnered with</p>
            <ul className="flex flex-wrap gap-2">
              {partnerships.slice(0, 6).map((p) => (
                <li key={p.id} className="border-[3px] border-ink bg-paper px-3 py-1.5 font-display text-xl uppercase leading-none">
                  {p.fest}
                  {p.institution ? <span className="ml-1.5 font-mono text-[11px] normal-case">{p.institution}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────── FAQ */}
      <section aria-labelledby="forge-faq" className="section-y">
        <div className="container-x grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHead id="forge-faq" kicker="Questions" jp="よくある質問">
              Questions before you <em>design</em>
            </SectionHead>
            <p className="mt-6 text-[15px] text-paper/75">
              More answers on the{' '}
              <Link href="/faq#custom" className="font-bold text-volt underline underline-offset-2">
                full FAQ
              </Link>
              .
            </p>
          </div>
          <div className="lg:col-span-7">
            <ForgeFaq items={faq} />
          </div>
        </div>
      </section>
    </>
  )
}
