'use client'
// <AddressBook/> — the customer's saved delivery addresses. Owner: CHECKOUT.
//   /account (AUTH renders it):  <AddressBook />                         → manage: add, edit, delete (Undo), set default
//   /checkout:                   <AddressBook mode="select" api={…} selectedId onSelect />  → pick one (radio cards) + manage
// Data: public.addresses under RLS (own rows only) via useAddresses(); pass `api` to share one list with a parent.
import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Building2, Check, GraduationCap, Home, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/lib/motion'
import { useAddresses, type AddressBookApi } from '@/lib/checkout/client'
import { ADDRESS_KINDS, addressLines, formatPhone, type Address, type AddressKind } from '@/lib/checkout/schema'
import { AddressForm } from './AddressForm'

const KIND_ICON: Record<AddressKind, typeof Home> = { home: Home, college: GraduationCap, work: Building2 }
const kindLabel = (k: AddressKind) => ADDRESS_KINDS.find((x) => x.id === k)?.label ?? 'Home'

export interface AddressBookProps {
  mode?: 'manage' | 'select'
  /** share state with a parent (checkout); otherwise the book loads its own list */
  api?: AddressBookApi
  initial?: Address[] | null
  selectedId?: string | null
  onSelect?: (a: Address) => void
  /** prefill for the first address form */
  seed?: { name?: string | null; phone?: string | null }
  className?: string
  /** heading level for the empty state (default h3) */
  headingLevel?: 'h2' | 'h3'
}

export function AddressBook(props: AddressBookProps) {
  // a stable hook call whether or not the parent shares its api
  const own = useAddresses(props.api ? [] : props.initial)
  const api = props.api ?? own
  return <AddressBookView {...props} api={api} />
}

function AddressBookView({ mode = 'manage', api, selectedId, onSelect, seed, className, headingLevel = 'h3' }: AddressBookProps & { api: AddressBookApi }) {
  const groupId = useId()
  const reduced = useReducedMotion()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const { addresses, status } = api
  const H = headingLevel

  if (status === 'loading') {
    return (
      <div className={cn('flex flex-col gap-3', className)} aria-busy="true">
        <span className="sr-only">Loading your addresses…</span>
        {[0, 1].map((i) => (
          <div key={i} className="border-[3px] border-ink/20 bg-paper p-4">
            <span className="skeleton-tone block h-4 w-1/3" />
            <span className="skeleton-tone mt-3 block h-3 w-3/4" />
            <span className="skeleton-tone mt-2 block h-3 w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (status === 'error' || status === 'offline') {
    return (
      <div className={cn('border-[3px] border-ink bg-pink p-4 text-ink', className)} role="alert">
        <p className="font-bold">{status === 'offline' ? 'Addresses are offline right now.' : 'We couldn’t load your addresses.'}</p>
        <p className="mt-1 text-[14px]">{api.error ?? 'Check your connection and try again.'}</p>
        {status === 'error' && (
          <button type="button" onClick={api.reload} className="press mt-3 inline-flex min-h-11 items-center border-[3px] border-ink bg-paper px-4 font-mono text-[12px] font-bold uppercase tracking-[0.12em]">
            Try again
          </button>
        )}
      </div>
    )
  }

  const openNew = () => setEditing('new')
  const first = addresses.length === 0

  return (
    <div className={cn('flex flex-col gap-3 text-ink', className)}>
      {first && editing !== 'new' && (
        <div className="flex flex-col items-start gap-3 border-[3px] border-dashed border-ink/60 bg-paper p-5">
          <MapPin aria-hidden className="size-7 text-door" />
          <H className="font-display text-[26px] uppercase leading-none">No address <span className="text-door">yet</span></H>
          <p className="max-w-[44ch] text-[14px] leading-snug text-tone-2">Add where the parcel should go — home, hostel or work. You can save more than one and pick at checkout.</p>
          <button type="button" onClick={openNew} className="press inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-volt px-5 font-display text-[20px] uppercase leading-none shadow-hard-sm">
            <Plus aria-hidden className="size-5" /> Add address
          </button>
        </div>
      )}

      {addresses.length > 0 && (
        <ul
          className="flex flex-col gap-3"
          role={mode === 'select' ? 'radiogroup' : undefined}
          aria-label={mode === 'select' ? 'Delivery address' : 'Saved addresses'}
          id={groupId}
        >
          <AnimatePresence initial={false}>
            {addresses.map((a) => {
              const Icon = KIND_ICON[a.kind]
              const selected = mode === 'select' && a.id === selectedId
              if (editing === a.id) {
                return (
                  <motion.li key={a.id} layout={!reduced} className="border-[3px] border-ink bg-paper p-4 shadow-hard-sm">
                    <p className="label mb-3 text-[11px] text-door">Editing · {kindLabel(a.kind)}</p>
                    <AddressForm
                      initial={a}
                      allowDefault={!a.isDefault}
                      onCancel={() => setEditing(null)}
                      onSubmit={async (input) => {
                        const saved = await api.update(a.id, input)
                        if (saved) {
                          setEditing(null)
                          if (mode === 'select') onSelect?.(saved)
                        }
                        return !!saved
                      }}
                    />
                  </motion.li>
                )
              }
              return (
                <motion.li
                  key={a.id}
                  layout={!reduced}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, x: -40, rotate: -2, transition: { duration: 0.22 } }}
                  className={cn(
                    'relative border-[3px] border-ink bg-paper transition-shadow duration-150',
                    selected ? 'shadow-[5px_5px_0_0_var(--color-door)]' : 'shadow-hard-sm',
                  )}
                >
                  <div className="flex items-start gap-3 p-4">
                    {mode === 'select' ? (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`Deliver to ${a.name}, ${a.line1}, ${a.city}`}
                        onClick={() => onSelect?.(a)}
                        className="absolute inset-0 z-0 focus-ring"
                      />
                    ) : null}
                    <span
                      aria-hidden="true"
                      className={cn('relative z-[1] mt-0.5 grid size-7 shrink-0 place-items-center border-[3px] border-ink', selected ? 'bg-door text-paper' : 'bg-paper')}
                    >
                      {mode === 'select' ? selected && <Check className="size-4" strokeWidth={3} /> : <Icon className="size-4" />}
                    </span>
                    <div className="pointer-events-none relative z-[1] min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-bold leading-tight">{a.name}</span>
                        <span className="label inline-flex items-center gap-1 border-2 border-ink px-1.5 py-0.5 text-[9.5px]">
                          <Icon aria-hidden className="size-3" /> {kindLabel(a.kind)}
                        </span>
                        {a.isDefault && <span className="label border-2 border-ink bg-volt px-1.5 py-0.5 text-[9.5px]">Default</span>}
                      </p>
                      <p className="mt-1 text-[14px] leading-snug text-tone-2">
                        {addressLines(a).map((l) => (
                          <span key={l} className="block">{l}</span>
                        ))}
                      </p>
                      <p className="mt-1 font-mono text-[12.5px] text-tone-2">{formatPhone(a.phone)}</p>
                    </div>
                  </div>
                  <div className="relative z-[1] flex flex-wrap border-t-2 border-ink/15">
                    <button type="button" onClick={() => setEditing(a.id)} className="inline-flex min-h-11 items-center gap-1.5 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] focus-ring can-hover:hover:text-door">
                      <Pencil aria-hidden className="size-3.5" /> Edit
                    </button>
                    {!a.isDefault && (
                      <button type="button" onClick={() => void api.setDefault(a.id)} className="inline-flex min-h-11 items-center gap-1.5 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] focus-ring can-hover:hover:text-door">
                        <Star aria-hidden className="size-3.5" /> Set default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => api.remove(a.id)}
                      className="ml-auto inline-flex min-h-11 items-center gap-1.5 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#b3001b] focus-ring can-hover:hover:bg-pink"
                      aria-label={`Delete address: ${a.name}, ${a.city}`}
                    >
                      <Trash2 aria-hidden className="size-3.5" /> Delete
                    </button>
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}

      <AnimatePresence initial={false}>
        {editing === 'new' ? (
          <motion.div
            key="new"
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="border-[3px] border-ink bg-paper p-4 shadow-hard-volt">
              <p className="label mb-3 text-[11px] text-door">New address · 新しい住所</p>
              <AddressForm
                seed={first ? seed : undefined}
                allowDefault={!first}
                submitLabel={mode === 'select' ? 'Save & deliver here' : 'Save address'}
                onCancel={() => setEditing(null)}
                onSubmit={async (input) => {
                  const saved = await api.add(input)
                  if (saved) {
                    setEditing(null)
                    if (mode === 'select') onSelect?.(saved)
                  }
                  return !!saved
                }}
              />
            </div>
          </motion.div>
        ) : (
          !first && (
            <motion.button
              key="add"
              type="button"
              onClick={openNew}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="press inline-flex min-h-12 items-center justify-center gap-2 border-[3px] border-dashed border-ink bg-paper/70 px-4 font-mono text-[12px] font-bold uppercase tracking-[0.12em] text-ink can-hover:hover:bg-volt"
            >
              <Plus aria-hidden className="size-4" /> Add new address
            </motion.button>
          )
        )}
      </AnimatePresence>
    </div>
  )
}

export default AddressBook
