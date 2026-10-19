// S08 COSPLAY & PROPS (#32 spotlight · #40 Basic vs LED crossfade · #15 stage scale-to-full-bleed).
// Owner: S08 section agent. Server component: reads props + partnerships from the cached repo
// (page.tsx's cosplay list has no 'hat' type, so the full catalogue is read here — still 'use cache', static).
import Image from 'next/image'
import Link from 'next/link'
import type { Product } from '@/lib/types'
import { getPartnerships, getProducts } from '@/lib/data/repo'
import { productPriceLabel } from '@/lib/pricing'
import KatanaStage, { type KatanaPick } from './s08/KatanaStage'
import { S08_CSS } from './s08/styles'

const PROP_TYPES = new Set(['katana', 'cape', 'figurine', 'accessory', 'hat', 'cosplay'])

const thumb = (p: Product) => {
  const src = p.images[0]?.src ?? `/mockups/${p.slug}-front.webp`
  return src.startsWith('/mockups/') ? src.replace(/\.webp$/, '-600.webp') : src
}

const pick = (p: Product | undefined): KatanaPick | null =>
  p ? { name: p.name, design: p.designTitle, href: `/product/${p.slug}`, price: productPriceLabel(p) } : null

export default async function S08Cosplay({ products = [] }: { products?: Product[] }) {
  const [catalogue, partnerships] = await Promise.all([getProducts(), getPartnerships()])
  const seen = new Set<string>()
  const pool = [...products, ...catalogue].filter((p) => PROP_TYPES.has(p.type) && !seen.has(p.id) && seen.add(p.id))

  const katanas = pool.filter((p) => p.type === 'katana')
  const led = katanas.find((p) => p.tags.includes('led'))
  const basic = katanas.find((p) => !p.tags.includes('led'))

  const look = [
    { label: 'Capes', jp: 'マント', p: pool.find((p) => p.type === 'cape') },
    { label: 'Figurines', jp: 'フィギュア', p: pool.find((p) => p.type === 'figurine') },
    {
      label: 'Earrings & accessories',
      jp: 'アクセサリー',
      p: pool.find((p) => p.type === 'accessory' && p.tags.includes('earrings')) ?? pool.find((p) => p.type === 'accessory'),
    },
    { label: 'Cosplay hats', jp: '帽子', p: pool.find((p) => p.type === 'hat') },
  ].filter((x): x is { label: string; jp: string; p: Product } => !!x.p)

  const contests = partnerships.filter((p) => /cosplay/i.test(p.role)).sort((a, b) => a.order - b.order)

  return (
    <section id="cosplay" aria-labelledby="cosplay-title" className="s08 relative overflow-hidden border-t-4 border-ink bg-ink text-paper">
      <style>{S08_CSS}</style>
      <div className="container-x relative pt-[72px] md:pt-24 lg:pt-32">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="label text-volt">Chapter 08 · Cosplay &amp; props</p>
            <h2 id="cosplay-title" className="h-display mt-4 text-[clamp(48px,12vw,72px)] md:text-h2">
              Props for your next <em>cosplay</em>
            </h2>
            <span lang="ja" aria-hidden="true" className="jp-sub mt-4 block">
              コスプレ ・ 小道具
            </span>
          </div>
          <div className="lg:col-span-5 lg:pb-2">
            <p className="max-w-[46ch] text-[16px] leading-[1.55] text-paper/80">
              Katanas, capes, figurines and small accessories to finish your fest look. Every katana is a display and
              cosplay prop, not a real blade — we confirm the exact piece and price with you on WhatsApp.
            </p>
          </div>
        </div>
      </div>

      <KatanaStage basic={pick(basic)} led={pick(led)} />

      <div className="container-x relative pb-[72px] md:pb-24 lg:pb-32">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          {/* complete the look */}
          <div className="lg:col-span-8">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-display text-[clamp(28px,3vw,40px)] uppercase leading-none">Complete the look</h3>
              <span lang="ja" aria-hidden="true" className="jp-sub">
                仕上げ
              </span>
            </div>
            <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {look.map(({ label, jp, p }, i) => (
                <li key={p.id} className="s08-card-wrap" style={{ ['--r' as string]: `${[-1.5, 1, -0.5, 1.5][i % 4]}deg` }}>
                  <Link
                    href={`/product/${p.slug}`}
                    data-cursor="VIEW"
                    className="s08-card focus-ring group block h-full border-[3px] border-paper bg-paper text-ink"
                  >
                    <span className="relative block aspect-[4/5] overflow-hidden border-b-[3px] border-ink" style={{ background: p.colorBlock }}>
                      <Image
                        src={thumb(p)}
                        alt={p.images[0]?.alt ?? p.name}
                        fill
                        sizes="(min-width: 1024px) 220px, (min-width: 768px) 25vw, 50vw"
                        quality={75}
                        className="s08-card-img object-cover"
                      />
                    </span>
                    <span className="block p-3">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-display text-[20px] uppercase leading-none">{label}</span>
                        <span lang="ja" aria-hidden="true" className="hidden font-jp text-[10px] font-bold tracking-[0.2em] text-ink/50 sm:inline">
                          {jp}
                        </span>
                      </span>
                      <span className="mt-2 block font-mono text-[13px] font-bold">{productPriceLabel(p)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* cosplay contests we back */}
          {contests.length > 0 && (
            <div className="lg:col-span-4">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-display text-[clamp(28px,3vw,40px)] uppercase leading-none">On the cosplay stage</h3>
                <span lang="ja" aria-hidden="true" className="jp-sub">
                  大会
                </span>
              </div>
              <ul className="mt-5 grid gap-3">
                {contests.map((c) => (
                  <li key={c.id} className="s08-stub relative border-[3px] border-paper/80 bg-tone-1 py-3 pl-4 pr-10">
                    <p className="label text-volt">{c.role}</p>
                    <p className="mt-1.5 font-display text-[22px] uppercase leading-none">
                      {c.fest}
                      {c.institution && <span className="text-paper/60"> · {c.institution}</span>}
                    </p>
                    {c.detail && <p className="mt-1.5 text-[14px] text-paper/75">{c.detail}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/shop/cosplay-props"
            data-cursor="OPEN"
            className="press focus-ring label inline-flex min-h-12 items-center justify-center gap-3 border-[3px] border-ink bg-volt px-6 py-4 font-bold text-ink shadow-[6px_6px_0_0_var(--color-door)]"
          >
            Shop katanas &amp; capes <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/cosplay"
            className="press focus-ring label inline-flex min-h-12 items-center justify-center gap-3 border-[3px] border-paper px-6 py-4 font-bold text-paper can-hover:hover:bg-paper can-hover:hover:text-ink"
          >
            Plan your cosplay
          </Link>
        </div>
      </div>
    </section>
  )
}
