'use client'
// S11 ticket-stub cards (#08 staggered reveal) with an inline "Remind me" form per event and a small
// #71-style success: the ticket gets stamped "SEE YOU THERE" + Kado cheers (no confetti — reserved for orders).
// Reminded events are remembered in localStorage so the stamp stays. Owner: S11.
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { BellRing, X } from 'lucide-react'
import { Mascot } from '@/components/brand'
import { prefersReducedMotion, registerGsap } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { FestEvent } from '@/lib/types'
import { RemindForm } from './RemindForm'
import { useRequireLogin } from '@/lib/auth/customer'

registerGsap()

const STORE = 'ted-remind-v1'
const KIND: Record<FestEvent['kind'], string> = { stall: 'Stall', popup: 'Pop-up', fest: 'Fest', online: 'Online' }

function readStore(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) || '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}
function writeStore(ids: string[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(ids))
  } catch {
    /* private mode: stamp just won't persist */
  }
}

/** Decorative barcode bars, deterministic per event. */
function Bars({ seed }: { seed: string }) {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const bars = Array.from({ length: 18 }, (_, i) => 1 + ((h >> (i % 24)) & 3))
  return (
    <span aria-hidden="true" className="flex h-12 items-stretch gap-[2px]">
      {bars.map((w, i) => (
        <span key={i} className="bg-ink" style={{ width: w + 'px' }} />
      ))}
    </span>
  )
}

function Ticket({ event, index, reminded, onReminded }: { event: FestEvent; index: number; reminded: 'no' | 'stored' | 'fresh'; onReminded: () => void }) {
  const [open, setOpen] = useState(false)
  const requireLogin = useRequireLogin() // reminders need an account (AUTH)
  const stampRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const formId = `remind-${event.id}`
  const place = event.venue && event.venue.includes(event.city) ? event.venue : [event.venue, event.city].filter(Boolean).join(' · ')
  const labelSaysTbc = /confirm/i.test(event.dateLabel)
  const done = reminded !== 'no'

  useEffect(() => {
    if (reminded !== 'fresh' || !stampRef.current || prefersReducedMotion()) return
    const tl = gsap.timeline()
    tl.fromTo(stampRef.current, { scale: 2.4, rotation: -30, opacity: 0 }, { scale: 1, rotation: -12, opacity: 1, duration: 0.42, ease: 'back.out(2.6)' })
      .fromTo(stampRef.current.closest('[data-ticket]'), { x: -5 }, { x: 0, duration: 0.25, ease: 'elastic.out(1.4, 0.3)', clearProps: 'x' }, 0.3)
    return () => {
      tl.kill()
    }
  }, [reminded])

  return (
    <li data-ticket-wrap className="min-w-0">
      <article
        data-ticket
        className={cn(
          'group relative flex h-full min-w-0 border-4 border-ink bg-paper text-ink shadow-hard-volt transition-[transform,box-shadow] duration-200 ease-[var(--ease-hover)]',
          !open && 'can-hover:hover:-translate-y-1 can-hover:hover:shadow-[10px_10px_0_0_var(--color-volt)]',
        )}
        aria-labelledby={`${formId}-title`}
      >
        {/* main */}
        <div className="relative min-w-0 flex-1 p-5 sm:p-6">
          <div className="flex items-center gap-3 font-mono text-[12px] font-bold tracking-[0.14em] text-tone-3">
            <span className="border-2 border-ink bg-ink px-1.5 py-0.5 text-volt">{KIND[event.kind].toUpperCase()}</span>
            <span>No.{String(index + 1).padStart(2, '0')}</span>
          </div>
          <h3 id={`${formId}-title`} className="mt-4 font-display text-[clamp(36px,4vw,52px)] uppercase leading-[0.88]">
            {event.name}
          </h3>
          {place && <p className="mt-2 text-[15px] font-semibold text-tone-2">{place}</p>}
          <p className="mt-4 font-mono text-[15px] font-bold">{event.dateLabel}</p>
          {!event.confirmed && (
            <span
              aria-hidden={labelSaysTbc || undefined}
              className="mt-3 inline-block -rotate-3 border-[3px] border-hype px-2 py-0.5 font-mono text-[12px] font-bold uppercase tracking-[0.12em] text-hype"
            >
              Dates TBC
            </span>
          )}

          <div className="mt-6">
            {done ? (
              <div className="flex items-center gap-3" role="status">
                <Mascot mood="cheer" size={56} animate title="" className="shrink-0" />
                <p className="text-[15px] font-semibold leading-snug">
                  You&apos;re on the list. We&apos;ll remind you before {event.name}.
                </p>
              </div>
            ) : (
              <button
                ref={btnRef}
                type="button"
                aria-expanded={open}
                aria-controls={formId}
                onClick={() => (open ? setOpen(false) : requireLogin(`Log in to get a reminder for ${event.name}`, () => setOpen(true)))}
                className={cn(
                  'press focus-ring inline-flex min-h-12 items-center gap-2 border-[3px] border-ink px-4 font-bold shadow-hard-sm transition-colors duration-150',
                  open ? 'bg-paper text-ink' : 'bg-ink text-paper hover:bg-door',
                )}
              >
                {open ? <X className="size-5" aria-hidden="true" strokeWidth={2.5} /> : <BellRing className="size-5" aria-hidden="true" strokeWidth={2.5} />}
                {open ? 'Close' : 'Remind me'}
              </button>
            )}
          </div>

          {done && (
            <div ref={stampRef} aria-hidden="true" className="pointer-events-none absolute right-3 top-6 -rotate-12 sm:right-5">
              <span className="block border-4 border-double border-hype bg-paper/80 px-3 py-1 text-center font-display text-[30px] uppercase leading-[0.9] text-hype">
                See you
                <br />
                there
              </span>
            </div>
          )}
        </div>

        {/* stub */}
        <div aria-hidden="true" className="relative flex w-[78px] shrink-0 flex-col items-center justify-between border-l-[3px] border-dashed border-ink bg-volt py-5 sm:w-[92px]">
          <span className="absolute -left-[14px] -top-[14px] size-6 rounded-full bg-ink" />
          <span className="absolute -bottom-[14px] -left-[14px] size-6 rounded-full bg-ink" />
          <span className="font-mono text-[11px] font-bold tracking-[0.14em]">No.{String(index + 1).padStart(2, '0')}</span>
          <span className="font-display text-[26px] uppercase leading-none tracking-wide [writing-mode:vertical-rl]">Escape door</span>
          <span className="font-jp text-[13px] font-black [writing-mode:vertical-rl]">ライブ</span>
          <Bars seed={event.id} />
        </div>
      </article>

      {/* inline form panel (hangs under the ticket) */}
      <div
        id={formId}
        className={cn('grid transition-[grid-template-rows] duration-300 ease-[var(--ease-expo)]', open && !done ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
        inert={!open || done}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mx-2 border-x-4 border-b-4 border-ink bg-paper p-5 text-ink shadow-hard-volt sm:p-6">
            {open && !done && (
              <RemindForm
                event={event}
                onDone={() => {
                  setOpen(false)
                  onReminded()
                }}
              />
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

export function TicketList({ events }: { events: FestEvent[] }) {
  const root = useRef<HTMLUListElement>(null)
  const [stored, setStored] = useState<string[]>([])
  const [fresh, setFresh] = useState<string[]>([])

  useEffect(() => {
    setStored(readStore())
  }, [])

  useGSAP(
    () => {
      if (prefersReducedMotion() || !root.current) return
      const cards = root.current.querySelectorAll('[data-ticket-wrap]')
      gsap.from(cards, {
        y: 70,
        rotation: (i) => (i % 2 ? 3 : -3),
        opacity: 0,
        duration: 0.7,
        stagger: 0.12,
        ease: 'expo.out',
        clearProps: 'transform,opacity',
        scrollTrigger: { trigger: root.current, start: 'top 82%', once: true },
      })
    },
    { scope: root },
  )

  return (
    <ul ref={root} className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3" aria-label="Upcoming stalls">
      {events.map((e, i) => (
        <Ticket
          key={e.id}
          event={e}
          index={i}
          reminded={fresh.includes(e.id) ? 'fresh' : stored.includes(e.id) ? 'stored' : 'no'}
          onReminded={() => {
            setFresh((f) => [...f, e.id])
            const next = [...new Set([...readStore(), e.id])]
            writeStore(next)
          }}
        />
      ))}
    </ul>
  )
}

export default TicketList
