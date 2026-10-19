'use client'
// Interactive demos for /lab/system (toasts, arc theme). Owner: F1.
import { toast } from 'sonner'
import { useArcTheme } from '@/components/Providers'
import { cn } from '@/lib/utils'

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      <button type="button" className="press label border-[3px] border-ink bg-paper px-4 py-3 text-ink shadow-hard" onClick={() => toast('Saved to wishlist', { description: 'Cursed Static tee' })}>
        Toast
      </button>
      <button type="button" className="press label border-[3px] border-ink bg-volt px-4 py-3 text-ink shadow-hard" onClick={() => toast.success('Added to cart', { description: 'Oversized tee · L' })}>
        Success
      </button>
      <button
        type="button"
        className="press label border-[3px] border-ink bg-pink px-4 py-3 text-ink shadow-hard"
        onClick={() => toast.error('That did not go through', { description: 'Check your connection and try again.', action: { label: 'Retry', onClick: () => {} } })}
      >
        Error
      </button>
    </div>
  )
}

export function ArcDemo() {
  const { arcs, current, set } = useArcTheme()
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => set(null)}
          aria-pressed={current === null}
          className={cn('press label min-h-11 border-[3px] border-ink px-3 py-2 shadow-hard-sm', current === null ? 'bg-volt text-ink' : 'bg-paper text-ink')}
        >
          Default
        </button>
        {arcs.map((a) => (
          <button
            key={a.slug}
            type="button"
            onClick={() => set(a.slug)}
            aria-pressed={current === a.slug}
            className={cn('press label inline-flex min-h-11 items-center gap-2 border-[3px] border-ink px-3 py-2 shadow-hard-sm', current === a.slug ? 'bg-volt text-ink' : 'bg-paper text-ink')}
          >
            <span aria-hidden="true" className="block size-3 border-2 border-ink" style={{ background: a.accentA }} />
            {a.slug}
          </button>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="flex h-28 items-end border-4 border-ink bg-arc-a p-3">
          <span className="label text-paper">bg-arc-a</span>
        </div>
        <div className="flex h-28 items-end border-4 border-ink bg-arc-b p-3">
          <span className="label text-ink">bg-arc-b</span>
        </div>
      </div>
    </div>
  )
}
