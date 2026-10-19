// Site footer (server-rendered links for crawlability). Owner: F1.
// Drop-alerts form · Badge stamp · link columns (SITEMAP §6.1) · #47 giant outline wordmark · disclaimer (§10.9).
import Link from 'next/link'
import { cacheLife } from 'next/cache'
import { ArrowUpRight } from 'lucide-react'
import { BadgeArt } from '@/components/brand/BrandArt'
import { DISCLAIMER } from '@/lib/seo'
import { HELP_LINKS, INSTAGRAM_HANDLE, INSTAGRAM_URL, SHOP_CATEGORIES, type NavArc } from './nav'
import { NewsletterForm } from './NewsletterForm'
import { FooterWordmark } from './FooterWordmark'

export interface FooterProps {
  arcs: NavArc[]
}

async function Year() {
  'use cache'
  cacheLife('days')
  return <>{new Date().getFullYear()}</>
}

function Column({ title, jp, children }: { title: string; jp: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="flex items-baseline gap-2 border-b-2 border-tone-2 pb-2">
        <span className="label text-volt">{title}</span>
        <span lang="ja" aria-hidden="true" className="font-jp text-[10px] tracking-[0.2em] text-tone-3">
          {jp}
        </span>
      </h2>
      <ul className="mt-3 space-y-0.5">{children}</ul>
    </div>
  )
}

function FLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} data-nav="" className="ted-flink">
        {children}
      </Link>
    </li>
  )
}

export function Footer({ arcs }: FooterProps) {
  return (
    <footer className="relative overflow-hidden border-t-4 border-paper/10 bg-ink text-paper" aria-labelledby="footer-title">
      <h2 id="footer-title" className="sr-only">
        The Escape Door: site links and drop alerts
      </h2>
      <div className="container-x grid gap-12 pb-12 pt-16 md:pt-24 lg:grid-cols-12 lg:gap-10">
        {/* drop alerts */}
        <div className="relative lg:col-span-5">
          <div className="panel-paper relative p-5 shadow-hard-volt md:p-7">
            <p className="label text-tone-3">Final page · 次号予告</p>
            <p className="mt-3 font-display text-[clamp(40px,5vw,64px)] uppercase leading-[0.92] text-ink">
              Next chapter <em className="accent">drops</em> soon
            </p>
            <p className="mt-4 max-w-[38ch] text-[15px] text-tone-2">
              Get new designs, restocks and fest stall dates before anyone else.
            </p>
            <NewsletterForm className="mt-6" />
          </div>
          <div className="ted-stamp pointer-events-none absolute -right-2 -top-10 w-24 md:-right-6 md:w-32">
            <BadgeArt className="block h-auto w-full" />
          </div>
        </div>

        {/* links */}
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 lg:col-span-7 lg:pl-6">
          <Column title="Shop" jp="ショップ">
            {SHOP_CATEGORIES.map((c) => (
              <FLink key={c.href} href={c.href}>
                {c.label}
              </FLink>
            ))}
          </Column>
          <Column title="Arcs" jp="アーク">
            {arcs.map((a) => (
              <FLink key={a.slug} href={`/arc/${a.slug}`}>
                {a.name}
              </FLink>
            ))}
            <FLink href="/custom">Custom Forge</FLink>
          </Column>
          <Column title="Help" jp="ヘルプ">
            {HELP_LINKS.map((c) => (
              <FLink key={c.href} href={c.href}>
                {c.label}
              </FLink>
            ))}
          </Column>
          <Column title="Find us" jp="会場">
            <FLink href="/fests">Fests & stalls</FLink>
            <FLink href="/cosplay">Cosplay corner</FLink>
            <li>
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label={`Instagram ${INSTAGRAM_HANDLE} (opens in a new tab)`} className="ted-flink inline-flex items-center gap-1">
                Instagram
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </a>
            </li>
          </Column>
        </nav>
      </div>

      <FooterWordmark />

      <div className="border-t-2 border-tone-2">
        <div className="container-x flex flex-col gap-3 py-6 text-[13px] text-tone-4 md:flex-row md:items-center md:justify-between md:gap-8">
          <p className="max-w-[72ch]">{DISCLAIMER}</p>
          <p className="label shrink-0 text-tone-3">
            © <Year /> The Escape Door · <span lang="ja">逃げ道</span>
          </p>
        </div>
      </div>
      <style>{FOOTER_CSS}</style>
    </footer>
  )
}

const FOOTER_CSS = `@layer components{
.ted-flink{position:relative;display:inline-flex;align-items:center;min-height:32px;font-size:15px;color:var(--color-tone-4);transition:color 180ms var(--ease-hover),transform 220ms var(--ease-expo)}
.ted-flink::before{content:"";position:absolute;left:-14px;top:50%;width:8px;height:8px;margin-top:-4px;background:var(--color-volt);transform:scale(0) rotate(45deg);transition:transform 220ms var(--ease-slam)}
@media (hover:hover) and (pointer:fine){.ted-flink:hover{color:var(--color-paper);transform:translateX(6px)}.ted-flink:hover::before{transform:scale(1) rotate(45deg)}}
.ted-flink[aria-current="page"]{color:var(--color-volt)}
.ted-stamp{transform:rotate(12deg)}
@media (prefers-reduced-motion:no-preference){@supports (animation-timeline:view()){
  .ted-stamp{animation:ted-stamp linear both;animation-timeline:view();animation-range:entry 0% cover 30%}
}}
@keyframes ted-stamp{0%{transform:rotate(-30deg) scale(1.8);opacity:0}70%{transform:rotate(16deg) scale(.94);opacity:1}100%{transform:rotate(12deg) scale(1);opacity:1}}
}`

export default Footer
