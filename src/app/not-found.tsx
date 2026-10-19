// 404 — "ゴゴゴ… wrong door!" (SITEMAP §1: HTTP 404, noindex; links to /shop, the arcs and /custom). Owner: P5.
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Mascot } from '@/components/brand'
import { DoorIcon } from '@/components/brand'
import { SpeedLines } from '@/components/fx/SpeedLines'
import { Sfx } from '@/components/fx/Sfx'
import { NotFoundSearch } from '@/components/content/NotFoundSearch'
import { getCollections } from '@/lib/data/repo'
import { readableOn } from '@/components/layout/nav'
import { cn } from '@/lib/utils'
import s from '@/components/content/content.module.css'

export const metadata: Metadata = {
  title: 'Wrong door — page not found',
  robots: { index: false, follow: true },
}

export default async function NotFound() {
  const collections = (await getCollections()).slice().sort((a, b) => a.order - b.order)

  return (
    <section aria-labelledby="nf-title" className={cn('relative overflow-hidden bg-ink text-paper', s.hero)}>
      <SpeedLines intensity={0.45} focus={{ x: 0.72, y: 0.42 }} color="var(--color-tone-2)" count={110} />
      <div className="container-x relative grid gap-10 pb-16 pt-12 sm:pb-24 sm:pt-16 lg:grid-cols-12 lg:items-center lg:pb-28">
        <div className="lg:col-span-7">
          <p className="label flex items-center gap-2 text-hype">
            <span aria-hidden="true" className="inline-block size-2 animate-pulse bg-hype" />
            Error 404 · Page not found
          </p>
          <h1 id="nf-title" className="h-display mt-5 text-h1">
            Wrong <em>door</em>!
          </h1>
          <span lang="ja" aria-hidden="true" className="jp-sub mt-5 block">
            ゴゴゴ… 扉を間違えた
          </span>
          <p className="mt-6 max-w-[48ch] text-[18px] leading-[1.6] text-tone-4">
            This page doesn&apos;t exist, or it moved to another arc. Search the shop, or pick a door below.
          </p>
          <div className="mt-8">
            <NotFoundSearch />
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="press focus-ring label inline-flex min-h-12 items-center gap-2 border-[3px] border-paper bg-paper px-4 py-3 font-bold text-ink hover:bg-volt">
              Back to the cover
            </Link>
            <Link href="/shop" className="focus-ring label inline-flex min-h-12 items-center gap-2 border-[3px] border-paper px-4 py-3 hover:bg-paper hover:text-ink">
              Shop everything
            </Link>
            <Link href="/custom" className="focus-ring label inline-flex min-h-12 items-center gap-2 border-[3px] border-paper px-4 py-3 hover:bg-paper hover:text-ink">
              Custom Forge
            </Link>
          </div>
        </div>
        <div className="relative flex justify-center lg:col-span-5">
          <span aria-hidden="true" className="absolute -top-6 left-0 sm:left-[6%]">
            <Sfx text="ゴゴゴ" size="lg" tone="door" rotate={-10} pop />
          </span>
          <div className={s.shake}>
            <Mascot mood="shock" size={260} animate title="Kado the door spirit, shocked" />
          </div>
        </div>
      </div>

      <nav aria-label="Arcs" className="relative border-t-4 border-paper bg-tone-1">
        <div className="container-x py-10 sm:py-12">
          <p className="label text-tone-4">Or open a different door · 別の扉</p>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {collections.map((c) => {
              const fg = readableOn(c.accentA) === 'ink' ? 'text-ink' : 'text-paper'
              return (
                <li key={c.slug}>
                  <Link
                    href={`/arc/${c.slug}`}
                    data-cursor="OPEN"
                    className={cn('press group focus-ring flex min-h-[132px] flex-col justify-between border-[3px] border-ink p-3 shadow-[5px_5px_0_0_var(--color-paper)] transition-transform duration-200 can-hover:hover:-translate-y-1', fg)}
                    style={{ backgroundColor: c.accentA }}
                  >
                    <span className="flex items-start justify-between">
                      <DoorIcon size={28} className="transition-transform duration-300 can-hover:group-hover:scale-110" />
                      <ArrowRight aria-hidden="true" className="size-4 opacity-0 transition-opacity duration-200 can-hover:group-hover:opacity-100" />
                    </span>
                    <span>
                      <span className="font-display block text-[22px] uppercase leading-[0.9]">{c.name}</span>
                      <span lang="ja" aria-hidden="true" className="jp-sub mt-1 block text-[10px]">{c.jp}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>
    </section>
  )
}
