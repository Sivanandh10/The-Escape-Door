// /admin/deals — bundle deals CRUD (bundle_rules). Saves → updateTag('rules') → cart, cards and /fests update.
import type { Metadata } from 'next'
import { getBundleRules, getProducts } from '@/lib/data/repo'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { DealsManager, type AttrOptions, type UnitPrices } from '@/components/admin/crud/RulesManagers'

export const metadata: Metadata = { title: 'Deals' }

/** most common variant price per type (and per type + variant attr), for the "saves ₹…" preview */
function priceMaps(products: Awaited<ReturnType<typeof getProducts>>): { unitPrices: UnitPrices; attrOptions: AttrOptions } {
  const counts = new Map<string, Map<number, number>>()
  const attrs = new Map<string, Set<string>>()
  const bump = (k: string, price: number) => {
    const m = counts.get(k) ?? new Map<number, number>()
    m.set(price, (m.get(price) ?? 0) + 1)
    counts.set(k, m)
  }
  for (const p of products) {
    for (const v of p.variants) {
      if (typeof v.price !== 'number') continue
      bump(p.type, v.price)
      for (const [k, val] of Object.entries(v.attrs ?? {})) {
        if (k === 'range') continue
        bump(`${p.type}|${k}|${val}`, v.price)
        const set = attrs.get(p.type) ?? new Set<string>()
        set.add(`${k}\u0000${val}`)
        attrs.set(p.type, set)
      }
    }
  }
  const unitPrices: UnitPrices = {}
  for (const [k, m] of counts) unitPrices[k] = [...m.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
  const attrOptions: AttrOptions = {}
  for (const [t, set] of attrs) attrOptions[t] = [...set].sort().slice(0, 12).map((s) => s.split('\u0000') as [string, string])
  return { unitPrices, attrOptions }
}

export default async function DealsPage() {
  const gate = await requireAdmin('catalog.edit')
  if (!gate.allowed) return <NoAccess perm="catalog.edit" session={gate.session} />
  const live = isSupabaseConfigured()
  const [rules, products] = await Promise.all([live ? [] : getBundleRules(), getProducts()])
  const { unitPrices, attrOptions } = priceMaps(products)
  return <DealsManager initial={rules.map((r) => ({ ...r, active: true }))} unitPrices={unitPrices} attrOptions={attrOptions} />
}
