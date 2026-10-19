// /admin/products (P4b) — catalogue CRUD. Live rows load in the browser under RLS; demo mode shows the repo catalogue.
import type { Metadata } from 'next'
import { getBundleRules, getCollections, getProducts } from '@/lib/data/repo'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { requireAdmin } from '@/components/admin/server'
import { NoAccess } from '@/components/admin/NoAccess'
import { ProductsManager } from '@/components/admin/crud/ProductsManager'

export const metadata: Metadata = { title: 'Products' }

export default async function ProductsPage() {
  const gate = await requireAdmin('catalog.edit')
  if (!gate.allowed) return <NoAccess perm="catalog.edit" session={gate.session} />
  const live = isSupabaseConfigured()
  const [products, collections, bundleRules] = await Promise.all([live ? [] : getProducts(), getCollections(), getBundleRules()])
  return (
    <ProductsManager
      initial={products.map((p, i) => ({ ...p, published: true, sortOrder: i + 1 }))}
      collections={collections.map((c) => ({ ...c, published: true }))}
      bundleRules={bundleRules}
    />
  )
}
