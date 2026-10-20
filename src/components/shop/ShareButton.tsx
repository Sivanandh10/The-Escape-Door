'use client'
// ShareButton — share a product (owner: UX). Touch devices with the Web Share API get the native sheet;
// everyone else (and any native-share failure) gets a manga panel menu: WhatsApp · Instagram (copies the link,
// then offers to open Instagram) · X · Copy link. Shares the canonical product URL + title + price.
// Rendered in a portal with fixed positioning, so it is never clipped by a card's overflow or a <Tilt>.
//
// PUBLIC PROPS (stable):
//   product   Pick<Product, 'slug'|'name'|'variants'|'priceFrom'|'priceOnRequest'> (required)
//   size?     'sm' | 'md'   (default 'md'; both ≥ 44px hit area)
//   tone?     'paper' | 'ink' (default 'paper')
//   withLabel? boolean — show "Share" text next to the icon
//   className?
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Camera, Check, Link2, MessageCircle, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Product } from '@/lib/types'
import { track } from '@/lib/analytics'
import { productPriceLabel } from '@/lib/pricing'
import { absUrl, SITE_NAME } from '@/lib/seo'
import { useIsClient, useReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'

export interface ShareButtonProps {
  product: Pick<Product, 'slug' | 'name' | 'variants' | 'priceFrom' | 'priceOnRequest'>
  size?: 'sm' | 'md'
  tone?: 'paper' | 'ink'
  withLabel?: boolean
  className?: string
}

type Method = 'native' | 'whatsapp' | 'instagram' | 'x' | 'copy'

const MENU_W = 236

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {}
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

const isTouch = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

export function ShareButton({ product: p, size = 'md', tone = 'paper', withLabel, className }: ShareButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; up: boolean } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const copiedTimer = useRef<number | undefined>(undefined)
  const reduced = useReducedMotion()
  const client = useIsClient()
  const menuId = useId()

  const url = absUrl(`/product/${p.slug}`)
  const price = productPriceLabel(p)
  const text = `${p.name} · ${price} | Original fan-inspired merch from ${SITE_NAME}`

  const done = useCallback(
    (method: Method) => {
      track('share', { product: p.slug, method })
    },
    [p.slug],
  )

  const flashCopied = () => {
    setCopied(true)
    window.clearTimeout(copiedTimer.current)
    copiedTimer.current = window.setTimeout(() => setCopied(false), 1600)
  }
  useEffect(() => () => window.clearTimeout(copiedTimer.current), [])

  const close = useCallback((focusBack = false) => {
    setOpen(false)
    if (focusBack) btn.current?.focus()
  }, [])

  const place = useCallback(() => {
    const b = btn.current
    if (!b) return
    const r = b.getBoundingClientRect()
    const h = menu.current?.offsetHeight ?? 248
    const vw = window.innerWidth
    const vh = window.innerHeight
    const left = Math.min(Math.max(8, r.right - MENU_W), vw - MENU_W - 8)
    const below = r.bottom + 8
    const up = below + h > vh - 8 && r.top - 8 - h > 8
    setPos({ left, top: up ? r.top - 8 - h : below, up })
  }, [])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  // close on outside pointer, scroll, resize; trap arrows inside the menu
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (menu.current?.contains(t) || btn.current?.contains(t)) return
      close()
    }
    const onScroll = () => close()
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    const first = menu.current?.querySelector<HTMLElement>('[role="menuitem"]')
    first?.focus({ preventScroll: true })
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, close])

  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const n = items.length
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n]?.focus()
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      items[e.key === 'Home' ? 0 : items.length - 1]?.focus()
    } else if (e.key === 'Tab') {
      close()
    }
  }

  const onClick = async (e: React.MouseEvent) => {
    // cards are one big link: never navigate when sharing
    e.preventDefault()
    e.stopPropagation()
    if (open) return close()
    if (isTouch() && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: p.name, text, url })
        done('native')
        return
      } catch (err) {
        if ((err as DOMException)?.name === 'AbortError') return
        // anything else (permissions, unsupported payload) → fall back to the menu
      }
    }
    setOpen(true)
  }

  const copy = async (method: 'copy' | 'instagram') => {
    const ok = await copyText(url)
    close(true)
    if (!ok) {
      toast.error('Could not copy the link', { description: url, duration: 5000 })
      return
    }
    flashCopied()
    done(method)
    if (method === 'instagram') {
      toast('Link copied for Instagram', {
        description: 'Paste it in your story (link sticker) or a DM.',
        action: { label: 'Open Instagram', onClick: () => window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer') },
        duration: 4500,
      })
    } else {
      toast('Link copied', { description: p.name, duration: 2200 })
    }
  }

  const openOut = (method: 'whatsapp' | 'x') => {
    const href =
      method === 'whatsapp'
        ? `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`
        : `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
    window.open(href, '_blank', 'noopener,noreferrer')
    done(method)
    close(true)
  }

  const label = `Share ${p.name}`
  const item =
    'focus-ring flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left font-body text-[15px] font-bold text-ink outline-none transition-colors duration-150 hover:bg-volt focus-visible:bg-volt'

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title="Share"
        data-cursor="SHARE"
        className={cn(
          'press relative inline-flex min-h-11 min-w-11 items-center justify-center gap-2 border-[3px] focus-ring',
          tone === 'paper' ? 'border-ink bg-paper text-ink shadow-hard-sm hover:bg-lav' : 'border-paper bg-ink text-paper hover:bg-tone-2',
          size === 'sm' ? 'h-11 w-11' : withLabel ? 'h-12 px-4' : 'h-12 w-12',
          copied && '!bg-volt !text-ink',
          className,
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={copied ? 'ok' : 'share'}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4, rotate: -30 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4, rotate: 30 }}
            transition={{ duration: 0.18 }}
            className="inline-flex"
            aria-hidden="true"
          >
            {copied ? <Check className="h-5 w-5" strokeWidth={3} /> : <Share2 className="h-5 w-5" strokeWidth={2.4} />}
          </motion.span>
        </AnimatePresence>
        {withLabel && <span className="label">{copied ? 'Copied' : 'Share'}</span>}
      </button>

      {client &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={menu}
                id={menuId}
                role="menu"
                aria-label={label}
                onKeyDown={onMenuKey}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: pos?.up ? 8 : -8, scale: 0.94, rotate: -1.5 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: pos?.up ? 6 : -6, scale: 0.96 }}
                transition={reduced ? { duration: 0.12 } : { type: 'spring', stiffness: 520, damping: 32 }}
                style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: MENU_W, transformOrigin: pos?.up ? '90% 100%' : '90% 0%' }}
                className="z-[140] border-[3px] border-ink bg-paper text-ink shadow-[6px_6px_0_0_var(--color-volt)]"
              >
                <div className="flex items-baseline justify-between gap-2 border-b-[3px] border-ink bg-ink px-3 py-2 text-paper">
                  <span className="label text-[11px] text-volt">Share this drop</span>
                  <span lang="ja" aria-hidden="true" className="font-jp text-[11px] font-bold tracking-[0.2em] text-paper/70">
                    シェア
                  </span>
                </div>
                <p className="truncate border-b-2 border-ink/15 px-3 py-2 font-mono text-[12px] text-tone-2">{price}</p>
                <div className="py-1">
                  <button type="button" role="menuitem" className={item} onClick={() => openOut('whatsapp')}>
                    <MessageCircle aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2.4} />
                    WhatsApp
                  </button>
                  <button type="button" role="menuitem" className={item} onClick={() => void copy('instagram')}>
                    <Camera aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2.4} />
                    <span className="flex flex-col leading-tight">
                      Instagram
                      <span className="text-[12px] font-medium text-tone-2">Copies the link for a story or DM</span>
                    </span>
                  </button>
                  <button type="button" role="menuitem" className={item} onClick={() => openOut('x')}>
                    <span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center font-display text-[18px] leading-none">
                      X
                    </span>
                    Post on X
                  </button>
                  <button type="button" role="menuitem" className={cn(item, 'border-t-2 border-ink/15')} onClick={() => void copy('copy')}>
                    <Link2 aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2.4} />
                    Copy link
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}

export default ShareButton
