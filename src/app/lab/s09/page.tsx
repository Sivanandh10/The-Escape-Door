// /lab/s09 — isolated preview of S09 Forge teaser, S10 Partners, S11 Live. Dev QA only; noindex. Owner: S09–S11 agent.
import type { Metadata } from 'next'
import { getEvents, getPartnerships } from '@/lib/data/repo'
import S09ForgeTeaser from '@/components/home/S09ForgeTeaser'
import S10Partners from '@/components/home/S10Partners'
import S11Live from '@/components/home/S11Live'

export const metadata: Metadata = {
  title: 'Lab · S09–S11',
  robots: { index: false, follow: false },
}

export default async function LabS09() {
  const [partnerships, events] = await Promise.all([getPartnerships(), getEvents()])
  return (
    <>
      <S09ForgeTeaser />
      <S10Partners partnerships={partnerships} />
      <S11Live events={events} />
    </>
  )
}
