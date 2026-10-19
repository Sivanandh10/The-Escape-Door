'use client'
// BundleHint — live bundle maths for a product page (owner: P1 shop).
// Simulates "cart + what you're about to add" through computeTotals() and shows the nudge/saving.
// PROPS: product, variant, qty, className?
import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import type { CartItem, Product, Variant } from '@/lib/types'
import { useCart, useHydrated } from '@/lib/cart'
import { computeTotals, formatINR, ruleMatches } from '@/lib/pricing'
import { bundleRules } from '@/lib/data/rules'
import { cn } from '@/lib/utils'

export function BundleHint({ product, variant, qty, className }: { product: Product; variant: Variant | null; qty: number; className?: string }) {
  const hydrated = useHydrated()
  const items = useCart((s) => s.items)
  const out = useMemo(() => {
    if (!variant || typeof variant.price !== 'number') return null
    const candidate: CartItem = {
      key: '__candidate', productId: product.id, slug: product.slug, name: product.name, type: product.type,
      collection: product.collection, variantId: variant.id, variantLabel: variant.label, variantAttrs: variant.attrs,
      unitPrice: variant.price, qty, image: '',
    }
    const rule = bundleRules.find((r) => ruleMatches(r, candidate))
    if (!rule) return null
    const base = hydrated ? items : []
    const t = computeTotals([...base, candidate])
    const applied = t.applied.find((a) => a.ruleId === rule.id)
    const inCart = base.filter((i) => ruleMatches(rule, i)).reduce((n, i) => n + i.qty, 0)
    const hint = t.hints.find((h) => h.includes(rule.label))
    return { rule, applied, hint, inCart }
  }, [product, variant, qty, items, hydrated])

  if (!out) return null
  return (
    <div className={cn('relative flex items-start gap-3 border-[3px] border-ink bg-volt p-3 text-ink shadow-hard-sm', className)} aria-live="polite">
      <Sparkles aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2.6} />
      <div className="flex flex-col gap-0.5">
        <p className="h-display text-xl leading-none">{out.rule.label}</p>
        <p className="text-sm">
          {out.applied ? (
            <>With this, your cart unlocks the deal — <strong>you save {formatINR(out.applied.saving)}</strong>.{out.hint ? ` ${out.hint}` : ''}</>
          ) : (
            out.hint ?? 'Mix designs and arcs — the deal applies automatically in the cart.'
          )}
        </p>
        {out.inCart > 0 && <p className="label text-[0.625rem] opacity-70">{out.inCart} already in your cart</p>}
      </div>
    </div>
  )
}

export default BundleHint
