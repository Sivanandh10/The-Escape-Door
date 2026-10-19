'use client'
// S03 buy panel: fit chips (from variants), size chips, live price, #66 add, view details. Owner: s03-s04-tee.
import { useId, useRef, useState } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import type { Product } from '@/lib/types'
import { variantPriceLabel } from '@/lib/pricing'
import { waLink } from '@/lib/whatsapp'
import { useCart } from '@/lib/cart'
import { prefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { AddButton } from './AddButton'

function Chips({
  label,
  options,
  value,
  onChange,
  invalid,
  describedBy,
  name,
}: {
  label: string
  options: { id: string; label: string; sub?: string }[]
  value: string | null
  onChange: (id: string) => void
  invalid?: boolean
  describedBy?: string
  name: string
}) {
  const id = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const idx = Math.max(0, options.findIndex((o) => o.id === value))
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const n = (i + d + options.length) % options.length
    onChange(options[n].id)
    refs.current[n]?.focus()
  }
  return (
    <div data-chips={name}>
      <p id={id} className="label mb-2 flex items-center gap-2 text-ink/70">
        {label}
        {value && <span className="text-ink">· {options.find((o) => o.id === value)?.label}</span>}
      </p>
      <div role="radiogroup" aria-labelledby={id} aria-invalid={invalid || undefined} aria-describedby={describedBy} className="flex flex-wrap gap-2">
        {options.map((o, i) => {
          const on = o.id === value
          return (
            <button
              key={o.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={i === idx ? 0 : -1}
              onClick={() => onChange(o.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                'focus-ring press min-h-11 min-w-11 border-[3px] border-ink px-3 font-mono text-[14px] font-bold uppercase',
                'transition-[background-color,color,box-shadow,translate] duration-150',
                on ? 'bg-ink text-volt shadow-[3px_3px_0_0_var(--color-door)]' : 'bg-paper text-ink can-hover:hover:bg-volt',
                invalid && !on && 'border-dashed',
              )}
            >
              {o.label}
              {o.sub && <span className="ml-1.5 font-normal opacity-70">{o.sub}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DropBuy({ product }: { product: Product }) {
  const variants = product.variants
  const [variantId, setVariantId] = useState(variants[0]?.id ?? '')
  const [size, setSize] = useState<string | null>(null)
  const [needSize, setNeedSize] = useState(false)
  const [added, setAdded] = useState(false)
  const sizesRef = useRef<HTMLDivElement>(null)
  const errId = useId()
  const setOpen = useCart((s) => s.setOpen)
  const variant = variants.find((v) => v.id === variantId) ?? variants[0]
  const sizes = product.sizes ?? []
  if (!variant) return null

  const guard = () => {
    if (!sizes.length || size) return true
    setNeedSize(true)
    if (!prefersReducedMotion() && sizesRef.current) {
      gsap.fromTo(sizesRef.current, { x: -8 }, { x: 0, duration: 0.45, ease: 'elastic.out(1, 0.28)' })
    }
    sizesRef.current?.querySelector<HTMLButtonElement>('[role="radio"]')?.focus()
    return false
  }

  const chartMsg = `Hi Escape Door! Could you send the size chart for ${product.name}?`

  return (
    <div className="flex flex-col gap-5">
      {variants.length > 0 && (
        <Chips
          name="fit"
          label="Fit"
          value={variant.id}
          onChange={setVariantId}
          options={variants.map((v) => ({ id: v.id, label: v.label, sub: variants.length > 1 ? variantPriceLabel(v) : undefined }))}
        />
      )}
      {sizes.length > 0 && (
        <div ref={sizesRef}>
          <Chips
            name="size"
            label="Size"
            value={size}
            onChange={(s) => {
              setSize(s)
              setNeedSize(false)
            }}
            invalid={needSize}
            describedBy={needSize ? errId : undefined}
            options={sizes.map((s) => ({ id: s, label: s }))}
          />
          <p id={errId} aria-live="assertive" className="mt-2 min-h-[1.25rem] text-[13px] font-semibold">
            {needSize ? (
              <span className="inline-block -rotate-1 bg-ink px-2 py-0.5 text-volt">Pick a size first — then it&rsquo;s yours.</span>
            ) : (
              <a
                href={waLink(chartMsg)}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring text-ink/75 underline decoration-2 underline-offset-4 can-hover:hover:text-door"
              >
                Size chart? Ask us on WhatsApp
              </a>
            )}
          </p>
        </div>
      )}

      <AddButton product={product} variant={variant} size={size ?? undefined} onBeforeAdd={guard} onAdded={() => setAdded(true)} />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Link
          href={`/product/${product.slug}`}
          data-cursor="VIEW"
          className="focus-ring group inline-flex min-h-11 items-center gap-2 font-mono text-[13px] font-bold uppercase tracking-[0.12em]"
        >
          View details
          <span aria-hidden="true" className="inline-block transition-transform duration-200 can-hover:group-hover:translate-x-1">→</span>
        </Link>
        {added && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="focus-ring min-h-11 font-mono text-[13px] font-bold uppercase tracking-[0.12em] text-door underline decoration-2 underline-offset-4"
          >
            Open cart
          </button>
        )}
      </div>
    </div>
  )
}

export default DropBuy
