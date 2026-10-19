// Dev QA preview of every brand asset (F3). Not linked from the site; noindex.
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Badge, DoorIcon, INK_SPLATS, MASCOT_MOODS, Mascot, Wordmark } from '@/components/brand'
import { ArcMotif } from '@/components/fx/ArcMotif'
import { ProductArt } from '@/components/shop/ProductArt'
import { TeeArt } from '@/components/shop/TeeArt'
import { getCollections, getProducts } from '@/lib/data/repo'

export const metadata: Metadata = {
  title: 'Lab · Brand',
  robots: { index: false, follow: false },
}

function Block({ title, note, children, tone = 'paper' }: { title: string; note?: string; children: ReactNode; tone?: 'paper' | 'ink' }) {
  return (
    <section className={tone === 'ink' ? 'border-y-4 border-ink bg-ink text-paper' : 'border-y-4 border-ink bg-paper text-ink'}>
      <div className="container-x py-12 md:py-16">
        <h2 className="font-display text-[clamp(36px,6vw,72px)] uppercase leading-[0.9]">{title}</h2>
        {note && <p className="label mt-3 max-w-2xl opacity-70">{note}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  )
}

function Cell({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <figure className={`flex flex-col items-center justify-end gap-3 ${className}`}>
      {children}
      <figcaption className="label opacity-70">{label}</figcaption>
    </figure>
  )
}

const MOOD_NOTE: Record<string, string> = {
  idle: 'idle · bob + blink',
  peek: 'peek · loader',
  wave: 'wave · hello',
  shock: 'shock · 404',
  sleepy: 'sleepy · empty cart',
  cheer: 'cheer · success',
  work: 'work · admin',
}

export default async function BrandLab() {
  const [collections, products] = await Promise.all([getCollections(), getProducts()])
  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="container-x flex flex-wrap items-end justify-between gap-6 py-10">
        <h1 className="font-display text-[clamp(48px,9vw,120px)] uppercase leading-[0.85]">
          Brand <em className="accent">lab</em>
        </h1>
        <p className="label max-w-sm opacity-70">Wordmarks and badge are recreations — replace with the original vector files. Kado, icons and textures are original.</p>
      </header>

      <Block title="Door-bracket wordmark" note="variant='full' · animated → #24 stroke-draw (reload to replay)">
        <div className="grid gap-10 md:grid-cols-2">
          <Cell label="full · animated" className="screentone screentone-light rounded-none border-4 border-ink bg-lav p-6">
            <Wordmark variant="full" animated className="w-full max-w-[460px]" />
          </Cell>
          <Cell label="full · on ink" className="border-4 border-ink bg-ink p-6">
            <Wordmark variant="full" className="w-full max-w-[460px]" />
          </Cell>
        </div>
      </Block>

      <Block title="Stacked · inline · bracket" tone="ink">
        <div className="grid items-end gap-10 md:grid-cols-3">
          <Cell label="stacked · on door purple" className="bg-door p-8">
            <Wordmark variant="stacked" className="w-full max-w-[280px]" />
          </Cell>
          <Cell label="stacked · animated · on volt" className="bg-volt p-8">
            <Wordmark variant="stacked" animated className="w-full max-w-[280px]" />
          </Cell>
          <div className="flex flex-col gap-8">
            <Cell label="inline · header" className="bg-paper p-4">
              <Wordmark variant="inline" className="h-10 w-auto max-w-full" />
            </Cell>
            <Cell label="inline · on ink" className="border-2 border-paper/30 p-4">
              <Wordmark variant="inline" className="h-8 w-auto max-w-full" />
            </Cell>
          </div>
        </div>
        <div className="mt-12 flex flex-wrap items-end gap-8">
          {[16, 24, 32, 48, 96, 160].map((s) => (
            <Cell key={s} label={`bracket ${s}px`}>
              <span style={{ width: s, height: s }} className="block">
                <Wordmark variant="bracket" className="h-full w-full" title="" />
              </span>
            </Cell>
          ))}
          <Cell label="bracket · animated">
            <Wordmark variant="bracket" animated className="h-24 w-24" />
          </Cell>
        </div>
      </Block>

      <Block title="Cover-stamp badge" note="Spicy Rice (OFL) outlines · rust → orange · feTurbulence grain">
        <div className="flex flex-wrap items-end gap-10">
          <Cell label="240px">
            <Badge size={240} />
          </Cell>
          <Cell label="120px · on ink" className="bg-ink p-4">
            <Badge size={120} />
          </Cell>
          <Cell label="64px">
            <Badge size={64} />
          </Cell>
          <Cell label="40px · no grain">
            <Badge size={40} grain={false} />
          </Cell>
        </div>
      </Block>

      <Block title="Kado · the door-spirit" tone="ink" note="one SVG rig · 7 moods · animate = CSS idle loop (off for reduced motion)">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {MASCOT_MOODS.map((m) => (
            <Cell key={m} label={MOOD_NOTE[m]}>
              <Mascot mood={m} animate className="w-full max-w-[200px]" />
            </Cell>
          ))}
        </div>
      </Block>

      <Block title="Kado · sizes + door" note="48px legibility · open = 0 → 1 (loader)">
        <div className="flex flex-wrap items-end gap-6">
          {MASCOT_MOODS.map((m) => (
            <Cell key={m} label={m}>
              <Mascot mood={m} size={48} title="" />
            </Cell>
          ))}
          <Cell label="96 · idle on volt" className="bg-volt p-3">
            <Mascot size={96} />
          </Cell>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-5">
          {[0, 0.25, 0.5, 0.75, 1].map((o) => (
            <Cell key={o} label={`peek · open ${o}`}>
              <Mascot mood="peek" open={o} className="w-full max-w-[160px]" title="" />
            </Cell>
          ))}
        </div>
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <Cell label="320px · idle" className="bg-lav p-6">
            <Mascot mood="idle" size={320} animate className="max-w-full" />
          </Cell>
          <Cell label="320px · cheer on ink" className="bg-ink p-6">
            <Mascot mood="cheer" size={320} animate className="max-w-full" />
          </Cell>
        </div>
      </Block>

      <Block title="Door icon (cart)" tone="ink" note="open 0 → 1 · currentColor lines · volt light">
        <div className="flex flex-wrap items-end gap-8">
          {[0, 0.3, 0.6, 1].map((o) => (
            <Cell key={o} label={`open ${o}`}>
              <span className="flex gap-4">
                <DoorIcon open={o} size={24} className="text-paper" />
                <DoorIcon open={o} size={48} className="text-paper" />
              </span>
            </Cell>
          ))}
          <Cell label="on paper button" className="bg-paper p-3">
            <span className="flex h-11 items-center gap-2 border-[3px] border-ink bg-volt px-3 text-ink">
              <DoorIcon open={0.35} size={24} />
              <span className="font-mono text-sm font-bold">2</span>
            </span>
          </Cell>
        </div>
      </Block>

      <Block title="Arc motifs" tone="ink" note="<ArcMotif motif colorA colorB animated /> · original drawings per arc · reduced motion = static">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <Cell key={c.slug} label={`${c.slug} · ${c.motif}`}>
              <span className="block aspect-[4/3] w-full overflow-hidden border-4 border-paper" style={{ background: c.accentA }}>
                <ArcMotif motif={c.motif} colorA={c.accentA} colorB={c.accentB} animated className="h-full w-full" />
              </span>
            </Cell>
          ))}
          <Cell label="speedlines (admin-added arcs)">
            <span className="block aspect-[4/3] w-full overflow-hidden border-4 border-paper bg-door">
              <ArcMotif motif="speedlines" colorA="#6D3BFF" colorB="#FFE14D" animated className="h-full w-full" />
            </span>
          </Cell>
        </div>
      </Block>

      <Block title="Product art" note="<TeeArt product side /> · <ProductArt product side? framed? /> — same builders as public/mockups">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {(() => {
            const tee = products.find((p) => p.dropOfWeek) ?? products.find((p) => p.type === 'tshirt')!
            const hoodie = products.find((p) => p.type === 'hoodie')!
            const flat = ['polaroid', 'katana', 'badge', 'poster'].map((t) => products.find((p) => p.type === t)!).filter(Boolean)
            return (
              <>
                <Cell label={`TeeArt back · ${tee.slug}`} className="bg-lav p-3"><TeeArt product={tee} className="w-full" /></Cell>
                <Cell label="TeeArt front" className="bg-lav p-3"><TeeArt product={tee} side="front" className="w-full" /></Cell>
                <Cell label={`hoodie back · ${hoodie.slug}`} className="bg-pink p-3"><TeeArt product={hoodie} className="w-full" /></Cell>
                <Cell label="ProductArt framed" className="p-0"><ProductArt product={tee} side="back" framed className="w-full" /></Cell>
                {flat.map((p) => (
                  <Cell key={p.slug} label={`ProductArt · ${p.type}`} className="bg-volt p-3"><ProductArt product={p} className="w-full" /></Cell>
                ))}
              </>
            )
          })()}
        </div>
      </Block>

      <Block title="Textures" note="public/textures · screentone ×3 · paper-grain.webp · speed lines · 6 ink splats">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {(['light', 'mid', 'dense'] as const).map((d) => (
            <Cell key={d} label={`screentone-${d}`}>
              <span className="block aspect-square w-full border-4 border-ink bg-lav" style={{ backgroundImage: `url(/textures/screentone-${d}.svg)` }} />
            </Cell>
          ))}
          <Cell label="paper-grain.webp">
            <span className="block aspect-square w-full border-4 border-ink bg-paper" style={{ backgroundImage: 'url(/textures/paper-grain.webp)' }} />
          </Cell>
          <Cell label="speedlines.svg">
            <span className="block aspect-square w-full border-4 border-ink bg-volt" style={{ backgroundImage: 'url(/textures/speedlines.svg)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
          </Cell>
          <Cell label="speedlines-horizontal.svg">
            <span className="block aspect-square w-full border-4 border-ink bg-pink" style={{ backgroundImage: 'url(/textures/speedlines-horizontal.svg)', backgroundSize: '100% 100%' }} />
          </Cell>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-4 sm:grid-cols-6">
          {INK_SPLATS.map((d, i) => (
            <Cell key={i} label={`splat-${i + 1}`}>
              <svg viewBox="0 0 200 200" className={`w-full ${['text-ink', 'text-door', 'text-hype', 'text-ink', 'text-door', 'text-ink'][i]}`} aria-hidden="true">
                <path d={d} fill="currentColor" />
              </svg>
            </Cell>
          ))}
        </div>
      </Block>
    </main>
  )
}
