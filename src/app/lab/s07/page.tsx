// /lab/s07 — isolated preview of home S07 (GSM power levels) + S08 (cosplay & props). Dev QA only; noindex.
import type { Metadata } from 'next'
import { getHoodieTiers, getProducts } from '@/lib/data/repo'
import S07Gsm from '@/components/home/S07Gsm'
import S08Cosplay from '@/components/home/S08Cosplay'

export const metadata: Metadata = {
  title: 'Lab · S07 + S08',
  robots: { index: false, follow: false },
}

const COSPLAY_TYPES = new Set(['cosplay', 'katana', 'cape', 'figurine', 'accessory'])

export default async function LabS07() {
  const [tiers, products] = await Promise.all([getHoodieTiers(), getProducts()])
  return (
    <>
      <div className="flex h-[60vh] items-end bg-paper p-8 text-ink">
        <p className="label">Lab · S07 + S08 · scroll ↓</p>
      </div>
      <S07Gsm tiers={tiers} />
      <S08Cosplay products={products.filter((p) => COSPLAY_TYPES.has(p.type))} />
      <div className="h-[60vh] bg-paper" />
    </>
  )
}
