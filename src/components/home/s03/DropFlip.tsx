'use client'
// Compact Drop of the Week stage with the back-print reveal folded in (old S04 turntable → one tap / hover).
// Front and back mockups stacked; "Turn it around" flips with a 3D rotateY (320 ms, slam ease). Hover flips on
// fine pointers; the button works everywhere (touch, keyboard). Reduced motion: a plain crossfade. Owner: HOME.
import Image from 'next/image'
import { useState } from 'react'
import { RotateCw } from 'lucide-react'
import type { Product } from '@/lib/types'
import { cn } from '@/lib/utils'

export function DropFlip({ product, label }: { product: Product; label: string }) {
  const front = product.images.find((i) => i.side === 'front') ?? product.images[0]
  const back = product.images.find((i) => i.side === 'back')
  const [flipped, setFlipped] = useState(false)
  if (!front) return null

  return (
    <div className="relative">
      <div
        className="group/flip relative mx-auto aspect-[4/5] w-full max-w-[420px] [perspective:1400px]"
        onPointerEnter={(e) => e.pointerType === 'mouse' && back && setFlipped(true)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && back && setFlipped(false)}
      >
        <div
          className={cn(
            'relative size-full transition-transform duration-[380ms] ease-[cubic-bezier(.34,1.56,.64,1)] [transform-style:preserve-3d] motion-reduce:transition-none',
            flipped && back && 'motion-safe:[transform:rotateY(180deg)]',
          )}
        >
          <div className={cn('absolute inset-0 border-4 border-ink bg-paper shadow-hard-lg [backface-visibility:hidden]', flipped && back && 'motion-reduce:opacity-0')}>
            <Image src={front.src} alt={front.alt} fill sizes="(min-width:1024px) 420px, 80vw" className="object-cover" />
          </div>
          {back && (
            <div
              className={cn(
                'absolute inset-0 border-4 border-ink bg-paper shadow-hard-lg [backface-visibility:hidden] motion-safe:[transform:rotateY(180deg)]',
                !flipped && 'motion-reduce:opacity-0',
              )}
            >
              <Image src={back.src} alt={back.alt} fill sizes="(min-width:1024px) 420px, 80vw" className="object-cover" />
            </div>
          )}
        </div>
        <span className="label pointer-events-none absolute -left-2 top-4 z-[2] -rotate-6 border-[3px] border-ink bg-volt px-2 py-1 text-ink shadow-hard-sm">
          {label}
        </span>
        {back && (
          <span className="label pointer-events-none absolute -right-2 bottom-5 z-[2] rotate-3 border-[3px] border-ink bg-ink px-2 py-1 text-volt">
            {flipped ? 'Back' : 'Front'}
          </span>
        )}
      </div>
      {back && (
        <button
          type="button"
          aria-pressed={flipped}
          onClick={() => setFlipped((f) => !f)}
          className="press focus-ring mx-auto mt-3 flex min-h-11 items-center gap-2 border-[3px] border-ink bg-paper px-3 sm:px-4 font-mono text-[13px] font-bold uppercase tracking-[0.12em] text-ink shadow-hard-sm"
        >
          <RotateCw aria-hidden="true" className={cn('size-4 transition-transform duration-300', flipped && 'rotate-180')} strokeWidth={2.6} />
          <span className="sm:hidden">{flipped ? 'Front' : 'See back'}</span>
          <span className="hidden sm:inline">{flipped ? 'Show the front' : 'Turn it around'}</span>
        </button>
      )}
    </div>
  )
}
