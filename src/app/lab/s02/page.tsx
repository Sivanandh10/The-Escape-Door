// /lab/s02 — isolated preview of S02 Choose Your Arc. Dev QA only; noindex. Owner: S02.
import type { Metadata } from 'next'
import { getCollections, getProducts } from '@/lib/data/lab'
import S02ChooseArc from '@/components/home/S02ChooseArc'

export const metadata: Metadata = {
  title: 'Lab · S02 Choose your arc',
  robots: { index: false, follow: false },
}

export default async function LabS02() {
  const [collections, products] = await Promise.all([getCollections(), getProducts()])
  return (
    <>
      <div className="grid min-h-[70svh] place-items-center bg-ink text-paper">
        <p className="label text-volt">Lab · S02 — scroll down</p>
      </div>
      <S02ChooseArc collections={collections} products={products} />
      <div className="grid min-h-[80svh] place-items-center border-t-4 border-ink bg-paper text-ink">
        <p className="label">Next section</p>
      </div>
    </>
  )
}
