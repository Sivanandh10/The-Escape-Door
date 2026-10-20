'use client'
// Drop-in, login-gated "Remind me" for a stall/fest card outside the home S11 section (owner: AUTH).
// Reuses S11's RemindForm (same lead kind 'remind_me', same localStorage stamp key) so a reminder set on /fests
// also shows as set on the home page and vice versa. Login is mandatory (owner requirement): signed-out visitors get
// the login modal with a reason, and the form opens by itself right after they sign in.
//   <li><EventStub event={e} index={i} /><RemindMeButton event={e} /></li>
import { useEffect, useId, useState } from 'react'
import { BellRing, Check, X } from 'lucide-react'
import { RemindForm } from '@/components/home/s11/RemindForm'
import { useRequireLogin } from '@/lib/auth/customer'
import { cn } from '@/lib/utils'
import type { FestEvent } from '@/lib/types'

const STORE = 'ted-remind-v1' // shared with src/components/home/s11/TicketList.tsx

function readStore(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) || '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}
function remember(id: string) {
  try {
    const ids = readStore()
    if (!ids.includes(id)) localStorage.setItem(STORE, JSON.stringify([...ids, id]))
  } catch {
    /* private mode: the "on the list" state just won't persist */
  }
}

export function RemindMeButton({ event, className }: { event: FestEvent; className?: string }) {
  const requireLogin = useRequireLogin()
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const formId = useId()

  useEffect(() => {
    // localStorage is client-only: read after mount so the server HTML stays static
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser storage
    if (readStore().includes(event.id)) setDone(true)
  }, [event.id])

  if (done) {
    return (
      <p role="status" className={cn('mt-3 flex min-h-12 items-center gap-2 border-[3px] border-ink bg-volt px-4 font-bold text-ink shadow-hard-sm', className)}>
        <Check aria-hidden="true" className="size-5 shrink-0" strokeWidth={3} />
        You&apos;re on the list for {event.name}.
      </p>
    )
  }

  return (
    <div className={cn('mt-3', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => (open ? setOpen(false) : requireLogin('Log in to get a reminder', () => setOpen(true)))}
        className={cn(
          'press focus-ring inline-flex min-h-12 items-center gap-2 border-[3px] border-ink px-4 font-bold shadow-hard-sm transition-colors duration-150',
          open ? 'bg-paper text-ink' : 'bg-volt text-ink hover:bg-paper',
        )}
      >
        {open ? <X aria-hidden="true" className="size-5" strokeWidth={2.5} /> : <BellRing aria-hidden="true" className="size-5" strokeWidth={2.5} />}
        {open ? 'Close' : 'Remind me'}
      </button>
      <div
        id={formId}
        className={cn('grid transition-[grid-template-rows] duration-300 ease-[var(--ease-expo)] motion-reduce:transition-none', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-3 border-4 border-ink bg-paper p-5 text-ink shadow-hard-volt sm:p-6">
            {open && (
              <RemindForm
                event={event}
                onDone={() => {
                  remember(event.id)
                  setOpen(false)
                  setDone(true)
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RemindMeButton
