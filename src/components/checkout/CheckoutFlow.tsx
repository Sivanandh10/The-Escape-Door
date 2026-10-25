'use client'
// /checkout — the whole pipeline on one page, as manga panels (one open at a time on phones). ONE flow for everyone:
//   member: 01 Deliver to (saved addresses / add + save new) → 02 Gift → 03 Voucher → 04 Review & place
//   guest:  01 Your details (name + WhatsApp number; "I'll share the address on WhatsApp" [default] / "Add address
//           now") → straight to 05 Review & place. 02 Deliver to (only when adding the address now), 03 Gift and
//           04 Voucher stay optional — collapsed panels the guest can open. Login is optional (policy.ts).
// "Place order on WhatsApp": a tab opens inside the click → POST /api/orders FIRST (server re-prices everything,
// dedupes on the nonce, stores the order + contact + address + voucher redemption → admin desk + the customer's
// orders) → only then that tab goes to wa.me with the order text → /checkout-success?order=<id>. Popup blocked →
// the success page's "Open WhatsApp" is the main action. Signature moment (#66): the door on the button swings open
// as the label morphs "Stamping your order…" → "Opening WhatsApp…". Owner: CHECKOUT.
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, ArrowRight, Check, ChevronDown, Lock, MessageCircle, Pencil, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { DoorIcon } from '@/components/brand/DoorIcon'
import { useBundleRules, useWhatsappNumber } from '@/components/SiteSettingsProvider'
import { useCart, useHydrated } from '@/lib/cart'
import { computeTotals, formatINR } from '@/lib/pricing'
import { waLink } from '@/lib/whatsapp'
import { getAttribution, track } from '@/lib/analytics'
import { useReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useCustomer, useRequireLogin } from '@/lib/checkout/auth'
import {
  applyServerPrices, cartSignature, checkoutNonce, clearGuestDetails, openPendingTab, placeOrder, readGuestDetails, resetCheckoutNonce, saveGuestDetails, useAddresses,
} from '@/lib/checkout/client'
import {
  NO_GIFT, addressInputSchema, addressLines, formatPhone, giftSchema, fieldErrors,
  type Address, type AddressValues, type ContactValues, type GiftOptions as Gift,
} from '@/lib/checkout/schema'
import { saveLastOrder } from '@/components/shop/cart/order'
import { EmptyCart } from '@/components/shop/cart/EmptyCart'
import { AddressBook } from './AddressBook'
import { AddressForm } from './AddressForm'
import { ContactForm } from './ContactForm'
import { GiftOptions } from './GiftOptions'
import { OrderSummary, payableOf } from './OrderSummary'
import { VoucherBox, type AppliedVoucher } from './VoucherBox'
import { TextArea } from './fields'

/** wall-clock fallback for the saved order stamp (event-time only, never during render) */
const nowMs = () => Date.now()

type Step = 'contact' | 'address' | 'gift' | 'voucher' | 'review'
const ALL_STEPS: Array<{ id: Step; title: string; jp: string }> = [
  { id: 'contact', title: 'Your details', jp: '連絡先' },
  { id: 'address', title: 'Deliver to', jp: 'お届け先' },
  { id: 'gift', title: 'Gift it?', jp: 'ギフト' },
  { id: 'voucher', title: 'Voucher', jp: 'クーポン' },
  { id: 'review', title: 'Review & place', jp: '確認' },
]
const stepsFor = (guest: boolean) =>
  ALL_STEPS.filter((s) => guest || s.id !== 'contact').map((s, i) => ({ ...s, no: String(i + 1).padStart(2, '0') }))

const CONTACT_FORM = 'checkout-contact-form'
const GUEST_ADDRESS_FORM = 'checkout-guest-address-form'

export interface CheckoutFlowProps {
  /** member = signed in (saved addresses); guest = no login method is live yet → contact + typed address */
  mode?: 'member' | 'guest'
  initialAddresses: Address[]
  giftWrapFee: number
  /** prefill for the first address (profile name / phone) */
  seed?: { name?: string | null; phone?: string | null }
}

export function CheckoutFlow({ mode = 'member', initialAddresses, giftWrapFee, seed }: CheckoutFlowProps) {
  const guestMode = mode === 'guest'
  const STEPS = useMemo(() => stepsFor(guestMode), [guestMode])
  const router = useRouter()
  const hydrated = useHydrated()
  const items = useCart((s) => s.items)
  const rules = useBundleRules()
  const waNumber = useWhatsappNumber()
  const requireLogin = useRequireLogin()
  const { openLogin } = useCustomer()
  const reduced = useReducedMotion()
  const book = useAddresses(initialAddresses)

  const totals = useMemo(() => computeTotals(items, rules), [items, rules])
  const [step, setStep] = useState<Step>(guestMode ? 'contact' : 'address')
  // guest: who's ordering + the typed address (remembered in this browser for next time)
  const [remembered, setRemembered] = useState(() => (guestMode ? readGuestDetails() : null))
  /** contact step extras: honeypot value + "remember my details" opt-in */
  const contactMeta = useRef<{ hp: string; remember: boolean }>({ hp: '', remember: !!remembered })
  // signed in → a guest's remembered details on this device are no longer needed (and may be someone else's)
  useEffect(() => {
    if (!guestMode) clearGuestDetails()
  }, [guestMode])
  const [contact, setContact] = useState<ContactValues | null>(remembered?.contact ?? null)
  const [guestAddress, setGuestAddress] = useState<AddressValues | null>(remembered?.address ?? null)
  /** guest: give the address now, or share it in the WhatsApp chat (default — fastest) */
  const [addressMode, setAddressMode] = useState<'whatsapp' | 'now'>(() => (remembered?.address ? 'now' : 'whatsapp'))
  const addressOnWhatsApp = guestMode && addressMode === 'whatsapp'
  const [editingGuestAddress, setEditingGuestAddress] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)
  /** after a price-changed answer: the server total, valid only for the exact cart + gift + voucher it was quoted for */
  const [acceptedPayable, setAcceptedPayable] = useState<{ key: string; payable: number } | null>(null)
  const [addressId, setAddressId] = useState<string | null>(() => initialAddresses.find((a) => a.isDefault)?.id ?? initialAddresses[0]?.id ?? null)
  const [gift, setGift] = useState<Gift>(NO_GIFT)
  const [giftErrors, setGiftErrors] = useState<Record<string, string>>({})
  const [voucher, setVoucher] = useState<AppliedVoucher | null>(null)
  const [voucherError, setVoucherError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [phase, setPhase] = useState<'idle' | 'saving' | 'opening'>('idle')
  const [problem, setProblem] = useState<{ message: string; cart?: boolean } | null>(null)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [placed, setPlaced] = useState(false)
  const started = useRef(false)

  // the selected address must still exist (deleted / not loaded yet → fall back to the default)
  const saved = book.addresses.find((a) => a.id === addressId) ?? null
  const address: (AddressValues & { id?: string }) | null = guestMode ? (addressOnWhatsApp ? null : guestAddress) : saved
  /** everything needed before gift / voucher / review can open */
  const ready = guestMode ? !!contact && (addressOnWhatsApp || !!guestAddress) : !!saved
  useEffect(() => {
    if (guestMode || saved || !book.addresses.length) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep a valid selection after deletes
    setAddressId(book.addresses.find((a) => a.isDefault)?.id ?? book.addresses[0].id)
  }, [guestMode, saved, book.addresses])

  useEffect(() => {
    if (!hydrated || !items.length || started.current) return
    started.current = true
    track('checkout_view', { pieces: items.reduce((n, i) => n + i.qty, 0), total: totals.total })
  }, [hydrated, items, totals.total])

  const giftFee = gift.enabled ? giftWrapFee : 0
  // the total shown everywhere AND sent as the shopper's consent: the server's quote while it still applies to this
  // exact cart / gift / voucher (e.g. a bundle-rule change the browser can't recompute), else the browser's own maths
  const priceKey = `${cartSignature(items)}#${gift.enabled ? 'g' : ''}#${voucher?.code ?? ''}`
  const payable = acceptedPayable && acceptedPayable.key === priceKey ? acceptedPayable.payable : payableOf(totals, voucher, giftFee)
  const priced = totals.lines.some((l) => l.unitPrice != null)
  const busy = phase !== 'idle'

  // ---------------------------------------------------------------- step plumbing
  const order = STEPS.map((s) => s.id)
  const idx = order.indexOf(step)
  const goto = (s: Step) => {
    setStep(s)
    // bring the opened panel into view on phones (Lenis owns scrolling)
    requestAnimationFrame(() => {
      const el = document.getElementById(`step-${s}`)
      if (!el) return
      const top = el.getBoundingClientRect().top
      if (top < 80 || top > window.innerHeight * 0.6) {
        const lenis = (window as unknown as { __lenis?: { scrollTo: (t: HTMLElement, o?: object) => void } }).__lenis
        if (lenis) lenis.scrollTo(el, { offset: -96, duration: reduced ? 0 : 0.6 })
        else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
      }
    })
  }

  const validateGift = (): boolean => {
    const r = giftSchema.safeParse(gift)
    const errs = r.success ? {} : fieldErrors(r.error.issues)
    setGiftErrors(errs)
    return r.success
  }

  /** submit a step's own form from an outside button (phone bar "Next") */
  const submitForm = (id: string): boolean => {
    const f = document.getElementById(id) as HTMLFormElement | null
    if (!f) return false
    f.requestSubmit()
    return true
  }

  const next = () => {
    if (step === 'contact') {
      submitForm(CONTACT_FORM)
      return
    }
    if (step === 'address' && guestMode && !addressOnWhatsApp && (!guestAddress || editingGuestAddress) && submitForm(GUEST_ADDRESS_FORM)) return
    // guests: address (or "on WhatsApp") → straight to review; gift + voucher stay optional panels
    if (step === 'address' && addressOnWhatsApp) {
      setAddressError(null)
      goto('review')
      return
    }
    if (step === 'address') {
      if (!address) {
        setAddressError('Pick an address — or add one — so we know where to send it.')
        return
      }
      setAddressError(null)
    }
    if (step === 'gift' && !validateGift()) return
    if (step === 'address' && guestMode) {
      goto('review')
      return
    }
    if (idx < order.length - 1) goto(order[idx + 1])
  }

  // ---------------------------------------------------------------- place the order
  const doPlace = async () => {
    if (busy || !items.length) return
    if (guestMode && !contact) {
      setContactError('Add your name and mobile number so we can confirm the order.')
      goto('contact')
      return
    }
    if (!address && !addressOnWhatsApp) {
      setAddressError(guestMode ? 'Add the address — or choose “I’ll share it on WhatsApp”.' : 'Pick an address — or add one — so we know where to send it.')
      goto('address')
      return
    }
    if (!validateGift()) {
      goto('gift')
      return
    }
    setProblem(null)
    setVoucherError(null)
    const tab = openPendingTab() // inside the click: popup blockers allow it, WhatsApp feels instant
    setPhase('saving')
    const who = guestMode ? `${contact!.phone}#${address ? `${address.pin}#${address.line1}` : 'wa'}` : address?.id ?? ''
    const nonce = checkoutNonce(`${cartSignature(items)}#${who}#${gift.enabled ? 'g' : ''}#${voucher?.code ?? ''}`)
    const attribution = getAttribution()
    const r = await placeOrder({
      nonce,
      items,
      ...(guestMode ? { address: addressOnWhatsApp ? null : guestAddress, contact, website: contactMeta.current.hp || undefined } : { addressId: address?.id }),
      expectedPayable: payable,
      gift,
      voucherCode: voucher?.code ?? null,
      note,
      source: attribution as Record<string, string | undefined>,
    })

    if (!r.ok) {
      tab.close()
      setPhase('idle')
      if (r.error === 'login') {
        // member: session expired · guest: a login method just went live (then login is mandatory)
        openLogin(guestMode ? 'Log in to place your order' : 'Your login expired — log in again to place the order.', () => (guestMode ? router.refresh() : void doPlace()))
        return
      }
      if (r.error === 'contact' && !guestMode) {
        // member whose session ran out mid-checkout: the server saw a guest without contact details
        openLogin('Your login expired — log in again to place the order.', () => void doPlace())
        return
      }
      if (r.error === 'contact') {
        setContactError(r.message)
        goto('contact')
        return
      }
      if (r.error === 'price-changed') {
        if (r.lines) applyServerPrices(r.lines, (fn) => useCart.setState((st) => ({ items: fn(st.items) })))
        setAcceptedPayable(typeof r.payable === 'number' ? { key: priceKey, payable: r.payable } : null)
        setProblem({ message: r.message })
        goto('review')
        return
      }
      if (r.error === 'voucher') {
        setVoucher(null)
        setVoucherError(r.message)
        goto('voucher')
        toast.error('Voucher removed', { description: r.message })
        return
      }
      if (r.error === 'address') {
        setAddressError(r.message)
        goto('address')
        return
      }
      setProblem({ message: r.message || 'We couldn’t save your order. Nothing was charged — try again.', cart: r.error === 'item-missing' || r.error === 'sold-out' })
      return
    }

    // saved → WhatsApp with the server's order text, then the success moment
    if (guestMode && contact) {
      if (contactMeta.current.remember) saveGuestDetails({ contact, address: addressOnWhatsApp ? null : guestAddress })
      else clearGuestDetails()
    }
    setPlaced(true)
    setPhase('opening')
    const link = waLink(r.message, waNumber)
    const opened = tab.go(link)
    const o = r.order
    track('whatsapp_click', { where: 'checkout', order: o.ref, pieces: o.items.reduce((n, l) => n + l.qty, 0), total: o.totals.payable, voucher: o.voucherCode ?? null, gift: !!o.gift?.enabled, opened })
    saveLastOrder({
      ref: o.ref,
      items: o.items,
      totals: {
        subtotal: o.totals.subtotal,
        savings: o.totals.savings,
        total: o.totals.payable,
        hasPriceOnRequest: o.totals.hasPriceOnRequest,
        applied: o.totals.applied,
        lines: o.items.map((l) => ({ key: l.key, lineTotal: l.lineTotal, saving: l.saving })),
      },
      name: o.contact?.name || o.address?.name || '',
      city: o.address?.city ?? '',
      link,
      at: Date.parse(o.createdAt) || nowMs(),
      opened,
      order: o,
    })
    resetCheckoutNonce()
    router.push(`/checkout-success?order=${encodeURIComponent(o.id)}`)
  }

  const place = () => (guestMode ? void doPlace() : requireLogin('Log in to place your order', () => void doPlace()))

  // ---------------------------------------------------------------- states
  if (!hydrated) {
    return (
      <div className="grid gap-6 lg:grid-cols-12" aria-busy="true">
        <span className="sr-only">Loading your checkout…</span>
        <div className="flex flex-col gap-4 lg:col-span-7">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-tone h-24 w-full" />
          ))}
        </div>
        <div className="skeleton-tone h-80 w-full lg:col-span-5" />
      </div>
    )
  }

  if (!items.length && !placed) {
    return (
      <div className="panel-paper mx-auto max-w-xl shadow-hard-volt">
        <EmptyCart />
      </div>
    )
  }

  const summaryOf = (s: Step): ReactNode => {
    if (s === 'contact') return contact ? `${contact.name} · ${formatPhone(contact.phone)}${contact.email ? ` · ${contact.email}` : ''}` : 'Name and mobile number'
    if (s === 'address') return addressOnWhatsApp ? 'You’ll share it on WhatsApp' : address ? `${address.name} · ${address.line1}, ${address.city} ${address.pin}` : 'No address yet'
    if (s === 'gift') return gift.enabled ? `Packed as a gift${giftFee ? ` (+${formatINR(giftFee)})` : ''}${gift.note ? ` · “${gift.note.slice(0, 40)}${gift.note.length > 40 ? '…' : ''}”` : ''}` : 'No gift wrap'
    if (s === 'voucher') return voucher ? `${voucher.code} · −${formatINR(voucher.discount)}` : 'No voucher'
    return ''
  }

  const placeButton = (className?: string) => (
    <PlaceButton phase={phase} disabled={busy || !ready} onClick={place} payable={priced || giftFee > 0 ? payable : null} className={className} />
  )

  return (
    <div className="grid gap-8 pb-28 lg:grid-cols-12 lg:gap-10 lg:pb-0">
      {/* ── steps ─────────────────────────────────────── */}
      <ol className="flex flex-col gap-4 lg:col-span-7" aria-label="Checkout steps">
        {STEPS.map((s, i) => {
          const open = s.id === step
          const done = i < idx
          return (
            <li key={s.id} id={`step-${s.id}`} className={cn('panel-paper scroll-mt-28 transition-shadow duration-200', open ? 'shadow-hard-volt' : 'shadow-hard-sm')}>
              <h2 className="m-0">
                <button
                  type="button"
                  onClick={() => (i <= idx || ready ? goto(s.id) : undefined)}
                  aria-expanded={open}
                  aria-controls={`step-${s.id}-body`}
                  disabled={!open && i > idx && !ready}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left focus-ring disabled:cursor-default sm:px-5"
                >
                  <span className={cn('grid size-10 shrink-0 place-items-center border-[3px] border-ink font-mono text-[13px] font-bold', done ? 'bg-door text-paper' : open ? 'bg-volt' : 'bg-paper text-tone-3')}>
                    {done ? <Check aria-hidden className="size-5" strokeWidth={3} /> : s.no}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="font-display text-[26px] uppercase leading-none sm:text-[30px]">{s.title}</span>
                      <span lang="ja" className="jp-sub text-[10.5px] text-ink">{s.jp}</span>
                    </span>
                    {!open && s.id !== 'review' && (done || summaryOf(s.id) !== '') && (
                      <span className="mt-1 block truncate text-[13px] text-tone-2">{summaryOf(s.id)}</span>
                    )}
                  </span>
                  {!open && done && (
                    <span className="label inline-flex items-center gap-1 text-[10px] text-door">
                      <Pencil aria-hidden className="size-3" /> Change
                    </span>
                  )}
                  {open && <ChevronDown aria-hidden className="size-5 rotate-180" />}
                </button>
              </h2>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    id={`step-${s.id}-body`}
                    key="body"
                    initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    animate={reduced ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                    exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t-[3px] border-ink px-4 pb-5 pt-4 sm:px-5">
                      {s.id === 'contact' && (
                        <>
                          <ContactForm
                            formId={CONTACT_FORM}
                            initial={contact}
                            submitLabel={addressMode === 'now' && !guestAddress ? 'Continue to address' : 'Review order'}
                            extra={<AddressChoice value={addressMode} onChange={setAddressMode} />}
                            remembered={!!remembered}
                            onForget={() => {
                              clearGuestDetails()
                              setRemembered(null)
                              setContact(null)
                              setGuestAddress(null)
                            }}
                            onSubmit={(c, meta) => {
                              contactMeta.current = meta
                              setContact(c)
                              setContactError(null)
                              goto(addressMode === 'now' && !guestAddress ? 'address' : 'review')
                            }}
                          />
                          {contactError && <Problem className="mt-3">{contactError}</Problem>}
                        </>
                      )}
                      {s.id === 'address' && guestMode && addressOnWhatsApp && (
                        <div className="flex flex-col gap-3">
                          <p className="flex items-start gap-2 border-[3px] border-ink bg-volt/40 p-4 text-[14px] leading-snug">
                            <MessageCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
                            <span>
                              <strong>You’ll share the address on WhatsApp.</strong> The order message says “Address: will share here” — just reply with it in the same chat.
                            </span>
                          </p>
                          <button type="button" onClick={() => setAddressMode('now')} className="label inline-flex min-h-11 items-center gap-1.5 self-start text-[10.5px] text-door focus-ring">
                            <Pencil aria-hidden className="size-3.5" /> Add the address now instead
                          </button>
                        </div>
                      )}
                      {s.id === 'address' && guestMode && !addressOnWhatsApp && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setAddressMode('whatsapp')
                              setEditingGuestAddress(false)
                              setAddressError(null)
                            }}
                            className="label mb-3 inline-flex min-h-11 items-center gap-1.5 text-[10.5px] text-door focus-ring"
                          >
                            <MessageCircle aria-hidden className="size-3.5" /> Skip — I’ll share it on WhatsApp
                          </button>
                          {guestAddress && !editingGuestAddress ? (
                            <div className="border-[3px] border-ink bg-paper p-4 shadow-[5px_5px_0_0_var(--color-door)]">
                              <p className="font-bold leading-tight">{guestAddress.name}</p>
                              <p className="mt-1 text-[14px] leading-snug text-tone-2">
                                {addressLines(guestAddress).map((l) => <span key={l} className="block">{l}</span>)}
                              </p>
                              <p className="mt-1 font-mono text-[12.5px] text-tone-2">{formatPhone(guestAddress.phone)}</p>
                              <button type="button" onClick={() => setEditingGuestAddress(true)} className="label mt-2 inline-flex min-h-11 items-center gap-1.5 text-[10.5px] text-door focus-ring">
                                <Pencil aria-hidden className="size-3.5" /> Change address
                              </button>
                            </div>
                          ) : (
                            <AddressForm
                              formId={GUEST_ADDRESS_FORM}
                              initial={guestAddress ? { ...guestAddress, id: 'guest', createdAt: '' } : null}
                              seed={{ name: contact?.name, phone: contact?.phone }}
                              allowDefault={false}
                              submitLabel="Deliver here"
                              onCancel={guestAddress ? () => setEditingGuestAddress(false) : undefined}
                              onSubmit={async (input) => {
                                const r = addressInputSchema.safeParse(input)
                                if (!r.success) return false
                                setGuestAddress(r.data)
                                setEditingGuestAddress(false)
                                setAddressError(null)
                                goto('review')
                                return true
                              }}
                            />
                          )}
                          {addressError && <Problem className="mt-3">{addressError}</Problem>}
                        </>
                      )}
                      {s.id === 'address' && !guestMode && (
                        <>
                          <AddressBook
                            mode="select"
                            api={book}
                            selectedId={address?.id ?? null}
                            seed={seed}
                            onSelect={(a) => {
                              setAddressId(a.id)
                              setAddressError(null)
                            }}
                          />
                          {addressError && <Problem className="mt-3">{addressError}</Problem>}
                        </>
                      )}
                      {s.id === 'gift' && <GiftOptions value={gift} onChange={(g) => { setGift(g); if (Object.keys(giftErrors).length) setGiftErrors({}) }} fee={giftWrapFee} errors={giftErrors} />}
                      {s.id === 'voucher' && (
                        <VoucherBox
                          items={items}
                          applied={voucher}
                          onChange={(v) => {
                            setVoucher(v)
                            setVoucherError(null)
                          }}
                          externalError={voucherError}
                          onNeedLogin={() => openLogin('Log in to use a voucher')}
                          guest={guestMode && contact ? { phone: contact.phone, email: contact.email } : null}
                        />
                      )}
                      {s.id === 'review' && (
                        <div className="flex flex-col gap-5">
                          <dl className="grid gap-3 text-[14px] sm:grid-cols-2">
                            {guestMode && (
                              <ReviewBlock label="Ordered by" onEdit={() => goto('contact')}>
                                {contact ? (
                                  <>
                                    <span className="flex items-center gap-1.5 font-bold"><UserRound aria-hidden className="size-3.5" /> {contact.name}</span>
                                    <span className="block font-mono text-[12.5px]">{formatPhone(contact.phone)}</span>
                                    {contact.email && <span className="block break-all">{contact.email}</span>}
                                  </>
                                ) : (
                                  'Not added yet'
                                )}
                              </ReviewBlock>
                            )}
                            <ReviewBlock label="Deliver to" onEdit={() => goto('address')}>
                              {addressOnWhatsApp ? (
                                <span className="flex items-center gap-1.5 font-bold"><MessageCircle aria-hidden className="size-3.5" /> You’ll share it on WhatsApp</span>
                              ) : address ? (
                                <>
                                  <span className="block font-bold">{address.name}</span>
                                  {addressLines(address).map((l) => <span key={l} className="block">{l}</span>)}
                                  <span className="block font-mono text-[12.5px]">{formatPhone(address.phone)}</span>
                                </>
                              ) : (
                                'No address yet'
                              )}
                            </ReviewBlock>
                            <ReviewBlock label="Gift" onEdit={() => goto('gift')}>
                              {gift.enabled ? (
                                <>
                                  <span className="block font-bold">Packed as a gift{giftFee ? ` · +${formatINR(giftFee)}` : ''}</span>
                                  {gift.receiverName && <span className="block">For {gift.receiverName}{gift.receiverPhone ? ` · ${formatPhone(gift.receiverPhone)}` : ''}</span>}
                                  {gift.note && <span className="block italic">“{gift.note}”</span>}
                                  {gift.hidePrices && <span className="block">Prices hidden on the slip</span>}
                                </>
                              ) : (
                                'No gift wrap'
                              )}
                            </ReviewBlock>
                          </dl>
                          <div className="lg:hidden">
                            <OrderSummary totals={totals} voucher={voucher} giftFee={giftFee} />
                          </div>
                          <TextArea id="checkout-note" label="Note for us" hint="Sizes to double-check, a delivery time, a fest-stall pickup…" maxLength={500} value={note} onChange={setNote} />
                          {problem && (
                            <Problem>
                              {problem.message}{' '}
                              {problem.cart && (
                                <button type="button" onClick={() => useCart.getState().setOpen(true)} className="font-bold underline decoration-2 underline-offset-2">
                                  Open cart
                                </button>
                              )}
                            </Problem>
                          )}
                          {placeButton('lg:hidden')}
                          <PayNote />
                        </div>
                      )}
                      {s.id !== 'review' && s.id !== 'contact' && !(s.id === 'address' && guestMode && !addressOnWhatsApp && (!guestAddress || editingGuestAddress)) && (
                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          <button type="button" onClick={next} className="press inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-ink px-5 font-display text-[20px] uppercase leading-none text-paper shadow-[4px_4px_0_0_var(--color-door)]">
                            {s.id === 'voucher' ? (voucher ? 'Continue' : 'Skip — review order') : s.id === 'gift' ? (gift.enabled ? 'Continue' : 'No gift — continue') : addressOnWhatsApp ? 'Continue — review order' : guestMode ? 'Deliver here — review' : 'Deliver here'}
                            <ArrowRight aria-hidden className="size-5 text-volt" />
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ol>

      {/* ── order slip (desktop) ───────────────────────── */}
      <aside className="hidden lg:col-span-5 lg:block" aria-labelledby="checkout-summary-title">
        <div className="panel-paper shadow-hard-volt lg:sticky lg:top-[calc(var(--header-h)+24px)]">
          <div className="flex items-center justify-between border-b-4 border-ink bg-ink px-4 py-3 text-paper">
            <h2 id="checkout-summary-title" className="font-display text-[26px] uppercase leading-none">
              Order <span className="text-volt">slip</span>
            </h2>
            <span lang="ja" className="jp-sub text-[11px]">注文票</span>
          </div>
          <div className="max-h-[calc(100vh-var(--header-h)-120px)] overflow-y-auto overscroll-contain p-4 sm:p-5" data-lenis-prevent="">
            <OrderSummary totals={totals} voucher={voucher} giftFee={giftFee} />
            <div className="mt-5">{placeButton()}</div>
            {problem && step !== 'review' && <Problem className="mt-3">{problem.message}</Problem>}
            <div className="mt-3">
              <PayNote />
            </div>
          </div>
        </div>
      </aside>

      {/* ── phone bar: total + next action ─────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-[60] border-t-4 border-ink bg-paper px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 text-ink lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="label text-[10px] text-tone-2">Total to pay</p>
            <p className="font-display text-[28px] leading-none">{priced || giftFee > 0 ? formatINR(payable) : 'Quote'}</p>
          </div>
          {step === 'review' ? (
            <button type="button" onClick={place} disabled={busy || !ready} className="press inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-volt px-4 font-display text-[19px] uppercase leading-none shadow-hard-sm disabled:opacity-60">
              <MessageCircle aria-hidden className="size-5" /> {busy ? 'Placing…' : 'Place order'}
            </button>
          ) : (
            <button type="button" onClick={next} className="press inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-ink px-4 font-display text-[19px] uppercase leading-none text-paper">
              Next <ArrowRight aria-hidden className="size-5 text-volt" />
            </button>
          )}
        </div>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {phase === 'saving' ? 'Saving your order.' : phase === 'opening' ? 'Order saved. Opening WhatsApp.' : ''}
      </p>
    </div>
  )
}

/** Guest checkout: share the delivery address now, or later in the WhatsApp chat (default — the fastest way). */
function AddressChoice({ value, onChange }: { value: 'whatsapp' | 'now'; onChange: (v: 'whatsapp' | 'now') => void }) {
  const opts = [
    { id: 'whatsapp' as const, title: 'I’ll share it on WhatsApp', sub: 'Fastest — send the address in the order chat.' },
    { id: 'now' as const, title: 'Add address now', sub: 'Type it here so we can pack straight away.' },
  ]
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="label mb-2 text-[10.5px] text-tone-2">Delivery address</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {opts.map((o) => {
          const on = value === o.id
          return (
            <label
              key={o.id}
              className={cn(
                'flex min-h-14 cursor-pointer items-start gap-3 border-[3px] border-ink px-3 py-2.5 transition-[background-color,box-shadow] duration-150',
                on ? 'bg-volt shadow-hard-sm' : 'bg-paper can-hover:hover:bg-lav/50',
              )}
            >
              <input type="radio" name="checkout-address-mode" value={o.id} checked={on} onChange={() => onChange(o.id)} className="mt-1 size-4 shrink-0 accent-ink" />
              <span className="min-w-0">
                <span className="block font-bold leading-tight">{o.title}</span>
                <span className="block text-[12.5px] leading-snug text-tone-2">{o.sub}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function ReviewBlock({ label, onEdit, children }: { label: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="border-[3px] border-ink p-3">
      <dt className="flex items-center justify-between">
        <span className="label text-[10.5px] text-tone-2">{label}</span>
        <button type="button" onClick={onEdit} className="label inline-flex min-h-9 items-center gap-1 text-[10px] text-door focus-ring">
          <Pencil aria-hidden className="size-3" /> Edit
        </button>
      </dt>
      <dd className="mt-1 leading-snug">{children}</dd>
    </div>
  )
}

function Problem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn('flex items-start gap-2 border-[3px] border-ink bg-pink px-3 py-2 text-[13.5px] font-semibold leading-snug text-ink', className)}>
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

function PayNote() {
  return (
    <p className="flex items-start gap-2 text-[12.5px] leading-snug text-tone-2">
      <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>
        Nothing is charged here. Your order is saved, then WhatsApp opens with it typed out — we confirm stock and sizes and share payment details in the chat. See{' '}
        <Link href="/policies/shipping" className="font-semibold text-ink underline decoration-door decoration-2 underline-offset-2">shipping</Link> and{' '}
        <Link href="/policies/privacy" className="font-semibold text-ink underline decoration-door decoration-2 underline-offset-2">privacy</Link>.
      </span>
    </p>
  )
}

/** #66 storytelling button: the door opens while the label morphs. */
function PlaceButton({ phase, disabled, onClick, payable, className }: { phase: 'idle' | 'saving' | 'opening'; disabled: boolean; onClick: () => void; payable: number | null; className?: string }) {
  const label = phase === 'saving' ? 'Stamping your order…' : phase === 'opening' ? 'Opening WhatsApp…' : 'Place order on WhatsApp'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-cursor="SEND"
      aria-busy={phase !== 'idle'}
      className={cn(
        'press group relative flex min-h-16 w-full items-center justify-center gap-3 overflow-hidden border-[3px] border-ink bg-volt px-5 text-ink shadow-hard disabled:cursor-not-allowed',
        phase === 'idle' && disabled && 'opacity-60',
        phase !== 'idle' && 'cursor-progress',
        className,
      )}
    >
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center border-2 border-ink bg-paper">
        <DoorIcon open={phase === 'opening' ? 1 : phase === 'saving' ? 0.55 : 0.12} size={22} light="var(--color-door)" />
      </span>
      <span className="relative flex min-w-0 flex-col items-start">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={phase}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="font-display text-[22px] uppercase leading-none tracking-[0.02em] sm:text-[24px]"
          >
            {label}
          </motion.span>
        </AnimatePresence>
        {phase === 'idle' && payable != null && <span className="font-mono text-[12px] font-bold">{formatINR(payable)} · pay in chat</span>}
      </span>
      {phase === 'idle' && <MessageCircle aria-hidden="true" className="size-5 shrink-0 transition-transform duration-200 can-hover:group-hover:-rotate-12" />}
    </button>
  )
}
