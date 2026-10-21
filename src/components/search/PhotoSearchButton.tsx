'use client'
// Camera button that opens photo search (owner: SEARCH). Used in the header search overlay and the /shop search box.
// Only this tiny button ships with the page: the modal is a separate chunk (next/dynamic) and the model + matcher
// (transformers.js in a Web Worker) download only after the modal opens. Hover / focus prefetches the modal code
// (not the model) so the click feels instant.
import dynamic from 'next/dynamic'
import { useCallback, useState } from 'react'
import { Camera } from 'lucide-react'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/utils'

const loadModal = () => import('./PhotoSearchModal')
const PhotoSearchModal = dynamic(loadModal, { ssr: false, loading: () => <OpeningShell /> })

export interface PhotoSearchButtonProps {
  /** analytics: where it was opened from */
  from: 'header' | 'shop'
  className?: string
  /** show the "Photo" word next to the icon */
  label?: boolean
}

export function PhotoSearchButton({ from, className, label }: PhotoSearchButtonProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const prefetch = () => void loadModal()
  return (
    <>
      <button
        type="button"
        aria-label="Search with a photo"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Search with a photo"
        onPointerEnter={prefetch}
        onFocus={prefetch}
        onClick={() => {
          setMounted(true)
          setOpen(true)
          track('image_search_open', { from })
        }}
        className={cn('press focus-ring inline-flex shrink-0 items-center justify-center gap-2', className)}
      >
        <Camera aria-hidden="true" className="size-5" strokeWidth={2.4} />
        {label && <span className="label text-[0.6875rem] font-bold">Photo</span>}
      </button>
      {mounted && <PhotoSearchModal open={open} from={from} onClose={close} />}
    </>
  )
}

/** Shown for the few ms the modal chunk takes on a slow phone (feedback < 100 ms). */
function OpeningShell() {
  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-ink/70" role="status" aria-live="polite">
      <span className="label border-[3px] border-ink bg-volt px-4 py-3 text-ink shadow-hard">Opening photo search…</span>
    </div>
  )
}

export default PhotoSearchButton
