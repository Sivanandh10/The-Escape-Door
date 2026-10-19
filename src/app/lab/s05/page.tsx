// /lab/s05 — isolated preview of S05 Squad grid + S06 Polaroid wall. Dev QA only; noindex. Owner: s05-s06 agent.
import type { Metadata } from 'next'
import { getProducts } from '@/lib/data/lab'
import S05Squad from '@/components/home/S05Squad'
import S06Wall from '@/components/home/S06Wall'

export const metadata: Metadata = {
  title: 'Lab · S05 Squad + S06 Wall',
  robots: { index: false, follow: false },
}

const WALL_TYPES = new Set(['polaroid', 'sticker', 'poster', 'bookmark', 'badge'])

export default async function LabS05() {
  const products = await getProducts()
  return (
    <>
      <div className="flex h-[60vh] items-end bg-ink px-6 pb-10 text-paper">
        <p className="label text-tone-4">Lab · scroll ↓ for S05 + S06</p>
      </div>
      <S05Squad products={products.filter((p) => p.featured)} />
      <S06Wall products={products.filter((p) => WALL_TYPES.has(p.type))} />
      <div className="h-[80vh] bg-ink" />
    </>
  )
}
