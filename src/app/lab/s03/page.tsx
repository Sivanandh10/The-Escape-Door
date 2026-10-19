// Lab preview for S03 Drop of the Week + S04 Back-Print Reveal (owner: s03-s04-tee). Not indexed.
import type { Metadata } from 'next'
import { getDropOfWeek } from '@/lib/data/repo'
import S03Drop from '@/components/home/S03Drop'
import S04BackPrint from '@/components/home/S04BackPrint'

export const metadata: Metadata = { title: 'Lab · S03/S04', robots: { index: false, follow: false } }

export default async function LabS03() {
  const drop = await getDropOfWeek()
  return (
    <>
      <div className="grid h-[60svh] place-items-center bg-ink text-paper">
        <p className="label">Lab · S03 Drop + S04 Back print · scroll ↓</p>
      </div>
      <S03Drop product={drop} />
      <S04BackPrint product={drop} />
      <div className="grid h-[80svh] place-items-center bg-paper text-ink">
        <p className="label">End of lab</p>
      </div>
    </>
  )
}
