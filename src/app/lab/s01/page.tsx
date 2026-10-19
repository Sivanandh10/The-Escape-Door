// /lab/s01 — isolated preview of the S01 hero (dev QA only; noindex). Owner: S01.
import type { Metadata } from 'next'
import S01Hero from '@/components/home/S01Hero'
import { getSettings } from '@/lib/data/repo'

export const metadata: Metadata = {
  title: 'Lab · S01 Hero',
  robots: { index: false, follow: false },
}

export default async function LabS01() {
  const settings = await getSettings()
  return (
    <>
      <S01Hero settings={settings} />
      <section className="container-x min-h-[140vh] bg-ink py-24 text-paper">
        <p className="label text-volt">Lab spacer</p>
        <p className="mt-4 max-w-[50ch] text-tone-4">S02 (Choose your arc) starts here on the home page.</p>
      </section>
    </>
  )
}
