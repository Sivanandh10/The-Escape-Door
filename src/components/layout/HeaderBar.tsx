'use client'
// Site header bar (client): solid ink bar + screentone strip, manga "chapter tab" nav, Arcs mega-panel,
// search, wishlist, account, door-shaped cart, mobile manga-panel menu. Hides on scroll down, returns on scroll up.
// Rendered by the server wrapper `Header.tsx` (which adds the admin-editable announcement banner above it).
// Owner: F1 / HOME.
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, Heart, Menu, Search, X, ArrowRight } from 'lucide-react'
import { Wordmark } from '@/components/brand/Wordmark'
import { DoorIcon } from '@/components/brand/DoorIcon'
import { useCart, useCartCount, useHydrated, useWishlist } from '@/lib/cart'
import { SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { MAIN_NAV, readableOn, type NavArc } from './nav'
import { MobileMenu } from './MobileMenu'
import { AccountButton } from '@/components/auth/AccountButton'

const EASE_OUT = [0.16, 1, 0.3, 1] as const

export interface HeaderProps {
  arcs: NavArc[]
}

export function HeaderBar({ arcs }: HeaderProps) {
  const [hidden, setHidden] = useState(false)
  const [mega, setMega] = useState(false)
  const [search, setSearch] = useState(false)
  const [menu, setMenu] = useState(false)
  const megaTimer = useRef<number | undefined>(undefined)
  const megaId = useId()
  const searchId = useId()
  const lock = mega || search || menu

  // hide on scroll down / show on scroll up (rAF-throttled, transform only)
  useEffect(() => {
    let last = window.scrollY
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const y = window.scrollY
        const dy = y - last
        if (y < 96) setHidden(false)
        else if (dy > 6 && !lock) setHidden(true)
        else if (dy < -6) setHidden(false)
        if (Math.abs(dy) > 6) last = y
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [lock])

  // close everything on navigation + Escape; "/" opens search
  useEffect(() => {
    const close = () => {
      setMega(false)
      setSearch(false)
      setMenu(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      const t = e.target as HTMLElement | null
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setSearch(true)
        setMega(false)
      }
    }
    window.addEventListener('ted:navigate', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('ted:navigate', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const openMega = (delay = 60) => {
    window.clearTimeout(megaTimer.current)
    megaTimer.current = window.setTimeout(() => setMega(true), delay)
  }
  const closeMega = (delay = 160) => {
    window.clearTimeout(megaTimer.current)
    megaTimer.current = window.setTimeout(() => setMega(false), delay)
  }

  return (
    <>
      <header
        id="site-header"
        data-hidden={hidden && !lock ? 'true' : 'false'}
        className="ted-header sticky top-0 z-[80]"
        style={{ viewTransitionName: 'site-header' }}
      >
        <div className="relative bg-ink">
          <div className="container-x flex h-[var(--header-h)] items-center gap-3 lg:gap-6">
            <LogoLink />

            <nav aria-label="Main" className="ml-auto hidden h-full lg:block">
              <ul className="flex h-full items-stretch">
                {MAIN_NAV.map((item, i) =>
                  'mega' in item && item.mega ? (
                    <li
                      key={item.label}
                      className="relative flex"
                      onPointerEnter={(e) => e.pointerType === 'mouse' && openMega()}
                      onPointerLeave={(e) => e.pointerType === 'mouse' && closeMega()}
                    >
                      <button
                        type="button"
                        aria-expanded={mega}
                        aria-controls={megaId}
                        onClick={() => setMega((v) => !v)}
                        className="ted-tab group"
                        data-open={mega || undefined}
                      >
                        <TabInner n={i + 1} label={item.label} jp={item.jp} />
                        <ChevronDown
                          aria-hidden="true"
                          className={cn('relative z-[1] -ml-1 size-4 transition-transform duration-300 ease-expo', mega && 'rotate-180')}
                        />
                      </button>
                    </li>
                  ) : (
                    <li key={item.href} className="flex">
                      <Link href={item.href} data-nav="" className={cn('ted-tab group', 'hot' in item && item.hot && 'ted-tab-hot')}>
                        <TabInner n={i + 1} label={item.label} jp={item.jp} hot={'hot' in item && item.hot} />
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </nav>

            <div className="ml-auto flex items-center gap-0.5 sm:gap-2 lg:ml-2">
              <button
                type="button"
                className="ted-icon-btn"
                aria-label="Search the shop"
                aria-expanded={search}
                aria-controls={searchId}
                onClick={() => {
                  setSearch((v) => !v)
                  setMega(false)
                }}
              >
                {search ? <X aria-hidden="true" className="size-5" /> : <Search aria-hidden="true" className="size-5" />}
              </button>
              <WishlistLink />
              <AccountButton />
              <CartDoor />
              <button
                type="button"
                className="ted-icon-btn lg:hidden"
                aria-label="Open menu"
                aria-expanded={menu}
                onClick={() => setMenu(true)}
              >
                <Menu aria-hidden="true" className="size-6" />
              </button>
            </div>
          </div>
          {/* screentone bottom border */}
          <div aria-hidden="true" className="ted-header-strip" />
        </div>

        <MegaPanel
          id={megaId}
          open={mega}
          arcs={arcs}
          onEnter={() => openMega(0)}
          onLeave={() => closeMega()}
          onClose={() => setMega(false)}
        />
        <SearchPanel id={searchId} open={search} onClose={() => setSearch(false)} />
      </header>

      <MobileMenu open={menu} onClose={() => setMenu(false)} arcs={arcs} />
      <style>{HEADER_CSS}</style>
    </>
  )
}

function TabInner({ n, label, jp, hot }: { n: number; label: string; jp: string; hot?: boolean }) {
  return (
    <>
      <span aria-hidden="true" className="ted-tab-fill" />
      <span className="relative z-[1] flex flex-col items-start leading-none">
        <span aria-hidden="true" className="ted-tab-num">
          {String(n).padStart(2, '0')} <span lang="ja">{jp}</span>
        </span>
        <span className="ted-tab-label font-display text-[19px] uppercase tracking-[0.02em]">{label}</span>
      </span>
      {hot && (
        <span aria-hidden="true" className="ted-hot relative z-[1] -mt-4 ml-0.5 self-start">
          <span className="ted-hot-ping" />
          <span className="ted-hot-dot" />
        </span>
      )}
    </>
  )
}

function LogoLink() {
  return (
    <Link href="/" className="ted-logo group flex shrink-0 items-center gap-2.5" aria-label="The Escape Door — home">
      <span className="ted-logo-mark block size-10 md:size-11">
        <Wordmark variant="bracket" title="" className="block h-full w-full" />
      </span>
      <span aria-hidden="true" className="font-display text-[19px] uppercase leading-[0.9] tracking-[0.02em] md:text-[21px]">
        The Escape
        <br className="sm:hidden" />
        <span className="hidden sm:inline"> </span>Door
      </span>
    </Link>
  )
}

function WishlistLink() {
  const hydrated = useHydrated()
  const count = useWishlist((s) => s.ids.length)
  const n = hydrated ? count : 0
  return (
    <Link href="/wishlist" className="ted-icon-btn relative hidden xs:inline-flex" aria-label={`Wishlist, ${n} saved`}>
      <Heart aria-hidden="true" className={cn('size-5', n > 0 && 'fill-pink text-pink')} />
      {n > 0 && <span className="ted-count bg-pink text-ink">{n > 99 ? '99+' : n}</span>}
    </Link>
  )
}

/** Door-shaped cart button. Also the fly-to target for #66: #cart-door / [data-cart-door]. */
function CartDoor() {
  const hydrated = useHydrated()
  const count = useCartCount()
  const setOpen = useCart((s) => s.setOpen)
  const nonce = useCart((s) => s.lastAdded?.nonce)
  const [hover, setHover] = useState(false)
  // a product landed: the door cracks open and the plate bumps until the nonce is "settled" 650ms later
  const [settled, setSettled] = useState(nonce)
  const bump = !!nonce && nonce !== settled
  const n = hydrated ? count : 0

  useEffect(() => {
    if (!nonce || nonce === settled) return
    const t = window.setTimeout(() => setSettled(nonce), 650)
    return () => window.clearTimeout(t)
  }, [nonce, settled])

  return (
    <button
      id="cart-door"
      data-cart-door=""
      type="button"
      onClick={() => setOpen(true)}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      aria-label={`Open cart, ${n} ${n === 1 ? 'item' : 'items'}`}
      className="ted-cart press relative flex h-11 items-center gap-2 border-[3px] border-ink bg-volt pl-2.5 pr-3 text-ink shadow-hard-paper"
      data-bump={bump || undefined}
    >
      <DoorIcon open={bump ? 0.9 : hover ? 0.55 : 0.08} size={24} strokeWidth={2.2} light="var(--color-door)" />
      <span className="label hidden text-[11px] font-bold sm:inline">Cart</span>
      <span className="ted-cart-plate" aria-hidden="true">
        {n > 99 ? '99+' : n}
      </span>
    </button>
  )
}

function MegaPanel({
  id,
  open,
  arcs,
  onEnter,
  onLeave,
  onClose,
}: {
  id: string
  open: boolean
  arcs: NavArc[]
  onEnter: () => void
  onLeave: () => void
  onClose: () => void
}) {
  const anime = arcs.filter((a) => a.group === 'anime')
  const beyond = arcs.filter((a) => a.group !== 'anime')
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id={id}
          key="mega"
          role="region"
          aria-label="Arcs"
          className="absolute inset-x-0 top-full hidden lg:block"
          onPointerEnter={onEnter}
          onPointerLeave={onLeave}
          initial={{ clipPath: 'inset(0 0 100% 0)' }}
          animate={{ clipPath: 'inset(0 0 0% 0)' }}
          exit={{ clipPath: 'inset(0 0 100% 0)', transition: { duration: 0.18, ease: [0.7, 0, 0.84, 0] } }}
          transition={{ duration: 0.34, ease: EASE_OUT }}
          data-lenis-prevent=""
        >
          <div className="border-b-4 border-ink bg-paper text-ink grain">
            <div className="container-x grid grid-cols-[minmax(220px,0.8fr)_3fr] gap-8 py-8">
              <div className="flex flex-col justify-between gap-6 border-r-4 border-ink pr-8">
                <div>
                  <p className="label text-tone-3">Chapter 02 · Arcs</p>
                  <p className="mt-3 font-display text-[56px] uppercase leading-[0.86]">
                    Pick your <em className="accent">arc</em>
                  </p>
                  <p lang="ja" className="jp-sub mt-3">
                    物語を選べ
                  </p>
                </div>
                <Link href="/shop" onClick={onClose} className="label group inline-flex items-center gap-2 hover:text-door">
                  Every arc, every panel
                  <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 ease-expo group-hover:translate-x-1" />
                </Link>
              </div>
              <ul className="grid grid-cols-3 gap-3 xl:grid-cols-6">
                {[...anime, ...beyond].map((a, i) => (
                  <motion.li
                    key={a.slug}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING, delay: 0.04 + i * 0.035 }}
                  >
                    <ArcTile arc={a} index={i} onNavigate={onClose} />
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ArcTile({ arc, index, onNavigate }: { arc: NavArc; index: number; onNavigate: () => void }) {
  const fg = readableOn(arc.accentA) === 'ink' ? 'var(--color-ink)' : 'var(--color-paper)'
  return (
    <Link
      href={`/arc/${arc.slug}`}
      onClick={onNavigate}
      data-cursor="OPEN"
      className="ted-arc-tile group"
      style={{ ['--a' as string]: arc.accentA, ['--b' as string]: arc.accentB, ['--fg' as string]: fg }}
    >
      <span aria-hidden="true" className="ted-arc-door" />
      <span className="relative z-[1] flex h-full flex-col justify-between gap-6 p-3">
        <span className="flex items-start justify-between">
          <span className="label text-[10px] opacity-70">{String(index + 1).padStart(2, '0')}</span>
          <span aria-hidden="true" className="flex gap-1">
            <span className="block size-3 border-2 border-current" style={{ background: arc.accentA }} />
            <span className="block size-3 border-2 border-current" style={{ background: arc.accentB }} />
          </span>
        </span>
        <span>
          <span lang="ja" className="block font-jp text-[12px] font-bold tracking-[0.2em] opacity-70">
            {arc.jp}
          </span>
          <span className="mt-1 block font-display text-[26px] uppercase leading-[0.9]">{arc.name}</span>
        </span>
      </span>
    </Link>
  )
}

function SearchPanel({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const submit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      const term = q.trim()
      router.push(term ? `/shop?q=${encodeURIComponent(term)}` : '/shop')
      onClose()
    },
    [q, router, onClose],
  )
  useEffect(() => {
    if (open) requestAnimationFrame(() => input.current?.focus())
  }, [open])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id={id}
          key="search"
          className="absolute inset-x-0 top-full"
          initial={{ clipPath: 'inset(0 0 100% 0)' }}
          animate={{ clipPath: 'inset(0 0 0% 0)' }}
          exit={{ clipPath: 'inset(0 0 100% 0)', transition: { duration: 0.16 } }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
        >
          <div className="border-b-4 border-ink bg-volt text-ink">
            <form role="search" onSubmit={submit} className="container-x flex items-center gap-3 py-4 md:py-5">
              <label htmlFor={`${id}-q`} className="sr-only">
                Search tees, hoodies, arcs and props
              </label>
              <Search aria-hidden="true" className="size-6 shrink-0" />
              <input
                ref={input}
                id={`${id}-q`}
                type="search"
                name="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search tees, hoodies, arcs…"
                autoComplete="off"
                enterKeyHint="search"
                className="min-w-0 flex-1 bg-transparent font-display text-[26px] uppercase leading-none tracking-[0.01em] placeholder:text-ink/45 focus:outline-none md:text-[36px]"
              />
              <button type="submit" className="press label shrink-0 border-[3px] border-ink bg-ink px-4 py-3 text-paper shadow-hard-sm">
                Search
              </button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const HEADER_CSS = `@layer components{
.ted-header{transition:transform 320ms var(--ease-expo)}
.ted-header[data-hidden="true"]{transform:translateY(calc(-100% - 2px))}
.ted-header-strip{position:absolute;left:0;right:0;top:100%;height:7px;pointer-events:none;
  background-image:radial-gradient(circle at center,var(--color-tone-3) 34%,transparent 38%);background-size:5px 5px;
  -webkit-mask:linear-gradient(to bottom,#000,transparent);mask:linear-gradient(to bottom,#000,transparent);
  border-top:2px solid var(--color-tone-2)}
.ted-tab{position:relative;display:flex;align-items:center;gap:6px;padding:0 14px;height:100%;color:var(--color-paper);isolation:isolate}
.ted-tab-fill{position:absolute;inset:10px 2px;background:var(--color-volt);transform:scaleY(0);transform-origin:bottom;
  transition:transform 260ms var(--ease-expo);border:2px solid var(--color-ink);box-shadow:3px 3px 0 0 var(--color-door)}
.ted-tab-num{font:500 9px/1 var(--font-mono);letter-spacing:.14em;color:var(--color-tone-4);margin-bottom:4px;display:flex;gap:6px;transition:color 200ms}
.ted-tab-num [lang="ja"]{font-family:var(--font-jp);letter-spacing:.1em}
@media (hover:hover) and (pointer:fine){
  .ted-tab:hover .ted-tab-fill{transform:scaleY(1)}
  .ted-tab:hover{color:var(--color-ink)}
  .ted-tab:hover .ted-tab-num{color:var(--color-ink)}
}
.ted-tab[aria-current="page"],.ted-tab[data-open]{color:var(--color-ink)}
.ted-tab[aria-current="page"] .ted-tab-fill,.ted-tab[data-open] .ted-tab-fill{transform:scaleY(1)}
.ted-tab[aria-current="page"] .ted-tab-num,.ted-tab[data-open] .ted-tab-num{color:var(--color-ink)}
.ted-tab:focus-visible{outline-offset:-4px}
.ted-tab-hot .ted-tab-label{color:var(--color-volt);transition:color 200ms}
@media (hover:hover) and (pointer:fine){.ted-tab-hot:hover .ted-tab-label{color:var(--color-ink)}}
.ted-tab-hot[aria-current="page"] .ted-tab-label{color:var(--color-ink)}
.ted-hot{display:inline-grid;width:9px;height:9px}
.ted-hot>span{grid-area:1/1;border-radius:9999px;background:var(--color-hype)}
.ted-hot-dot{border:1.5px solid var(--color-ink)}
.ted-hot-ping{animation:ted-hot-ping 1.8s cubic-bezier(0,0,.2,1) infinite}
@keyframes ted-hot-ping{75%,100%{transform:scale(2.4);opacity:0}}
@media (prefers-reduced-motion:reduce){.ted-hot-ping{animation:none;opacity:0}}
.ted-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;color:var(--color-paper);
  border:2px solid transparent;transition:border-color 180ms var(--ease-hover),background-color 180ms var(--ease-hover),color 180ms}
@media (hover:hover) and (pointer:fine){.ted-icon-btn:hover{border-color:var(--color-paper);background:var(--color-tone-1)}}
.ted-icon-btn:active{transform:translate(1px,1px)}
.ted-count{position:absolute;top:2px;right:0;min-width:18px;height:18px;padding:0 4px;display:grid;place-items:center;
  font:700 10px/1 var(--font-mono);border:2px solid var(--color-ink)}
.ted-cart-plate{display:grid;place-items:center;min-width:24px;height:24px;padding:0 5px;background:var(--color-ink);color:var(--color-volt);
  font:700 12px/1 var(--font-mono);transition:transform 260ms var(--ease-slam),background-color 200ms}
.ted-cart[data-bump] .ted-cart-plate{transform:scale(1.35) rotate(-8deg);background:var(--color-hype);color:var(--color-paper)}
@media (hover:hover) and (pointer:fine){.ted-cart:hover{background:var(--color-volt-hot)}}
.ted-logo-mark{transition:transform 360ms var(--ease-slam);transform-origin:left center}
@media (hover:hover) and (pointer:fine){.ted-logo:hover .ted-logo-mark{transform:perspective(300px) rotateY(-22deg) rotate(-3deg)}}
.ted-arc-tile{position:relative;display:block;height:100%;min-height:150px;border:3px solid var(--color-ink);background:var(--color-paper);
  color:var(--color-ink);overflow:hidden;isolation:isolate;transition:transform 260ms var(--ease-slam),box-shadow 260ms var(--ease-hover),color 200ms}
.ted-arc-door{position:absolute;inset:0;z-index:0;background:var(--a);transform:scaleX(0);transform-origin:left;transition:transform 340ms var(--ease-expo)}
.ted-arc-door::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at center,var(--b) 30%,transparent 34%);background-size:7px 7px;opacity:.55;
  -webkit-mask:linear-gradient(135deg,transparent 45%,#000);mask:linear-gradient(135deg,transparent 45%,#000)}
@media (hover:hover) and (pointer:fine){
  .ted-arc-tile:hover{transform:translate(-3px,-3px);box-shadow:6px 6px 0 0 var(--color-ink);color:var(--fg)}
  .ted-arc-tile:hover .ted-arc-door{transform:scaleX(1)}
}
.ted-arc-tile:focus-visible{color:var(--fg)}
.ted-arc-tile:focus-visible .ted-arc-door{transform:scaleX(1)}
}`

export default HeaderBar
