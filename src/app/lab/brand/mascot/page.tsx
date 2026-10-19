// Dev QA sheet for Kado (F3). noindex. Every mood at 220px + 48px on paper and ink, and the loader door-open range.
import type { Metadata } from 'next'
import { MASCOT_MOODS, Mascot } from '@/components/brand'

export const metadata: Metadata = { title: 'Lab · Kado', robots: { index: false, follow: false } }

export default function MascotLab() {
  return (
    <main className="min-h-dvh bg-paper p-6 text-ink">
      {(['#F4EFE6', '#0B0B0F', '#C9B8FF'] as const).map((bg) => (
        <div key={bg} className="flex flex-wrap items-end gap-6 p-6" style={{ background: bg }}>
          {MASCOT_MOODS.map((m) => (
            <div key={m} className="flex flex-col items-center gap-2">
              <Mascot mood={m} size={170} />
              <div className="flex items-end gap-3">
                <Mascot mood={m} size={48} title="" />
                <Mascot mood={m} size={32} title="" />
              </div>
              <span className="label" style={{ color: bg === '#0B0B0F' ? '#F4EFE6' : '#0B0B0F' }}>{m}</span>
            </div>
          ))}
        </div>
      ))}
      <div className="flex flex-wrap items-end gap-6 bg-ink p-6">
        {[0, 0.25, 0.5, 0.75, 1].map((o) => (
          <div key={o} className="flex flex-col items-center gap-2">
            <Mascot mood="peek" open={o} size={150} />
            <span className="label text-paper">peek open={o}</span>
          </div>
        ))}
      </div>
    </main>
  )
}
