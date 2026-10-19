'use client'
// "Basic or LED katana?" (#40 crossfade compare) for /cosplay. Owner: P5.
// Native radio group (arrow keys work), both mockups stacked and crossfaded (opacity only), a drawn
// "blade" bar that lights up with a sweeping edge in LED mode, and an SFX pop on every switch (< 100 ms).
// Reduced motion: instant swap, no sweep. Prices come from product data (never hardcoded).
import Image from 'next/image'
import Link from 'next/link'
import { useId, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import s from './content.module.css'

export interface KatanaSide {
  slug: string
  name: string
  src: string
  alt: string
  price: string
  line: string
}

const SFX = { basic: 'シャキン', led: 'ピカッ!' } as const

export function KatanaCompare({ basic, led }: { basic: KatanaSide; led: KatanaSide }) {
  const uid = useId()
  const reduce = useReducedMotion()
  const [mode, setMode] = useState<'basic' | 'led'>('led')
  const [bump, setBump] = useState(0)
  const cur = mode === 'led' ? led : basic

  const pick = (m: 'basic' | 'led') => {
    if (m === mode) return
    setMode(m)
    setBump((b) => b + 1)
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
      <div className="relative lg:col-span-7">
        <div className="relative aspect-[4/5] overflow-hidden border-4 border-paper bg-tone-1 shadow-[8px_8px_0_0_var(--color-volt)] sm:aspect-[5/4]">
          {[basic, led].map((k) => {
            const on = k === cur
            return (
              <Image
                key={k.slug}
                src={k.src}
                alt={k.alt}
                fill
                sizes="(min-width:1024px) 55vw, 92vw"
                aria-hidden={!on}
                className={cn('object-cover transition-opacity duration-500 sm:object-[50%_55%]', on ? 'opacity-100' : 'opacity-0')}
              />
            )
          })}
          <AnimatePresence>
            <motion.span
              key={bump}
              aria-hidden="true"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.7, rotate: -18 }}
              animate={reduce ? { opacity: 0 } : { opacity: [0, 1, 1, 0], scale: [1.7, 0.95, 1, 1], rotate: -10 }}
              transition={{ duration: 0.9, times: [0, 0.25, 0.7, 1], ease: 'easeOut' }}
              className="sfx font-sfx-jp pointer-events-none absolute left-[6%] top-[10%] text-[clamp(44px,7vw,84px)]"
              style={{ ['--sfx-fill' as string]: mode === 'led' ? 'var(--color-volt)' : 'var(--color-paper)' }}
            >
              {bump > 0 ? SFX[mode] : ''}
            </motion.span>
          </AnimatePresence>
        </div>
        {/* the blade bar — lights up for LED */}
        <div aria-hidden="true" className="relative mt-5 h-5 border-[3px] border-paper bg-tone-2" style={{ clipPath: 'polygon(0 0, 94% 0, 100% 50%, 94% 100%, 0 100%)' }}>
          <span className={cn('absolute inset-0 bg-tone-4 transition-opacity duration-300', mode === 'led' ? 'opacity-0' : 'opacity-100')} />
          <span className={cn('absolute inset-0 bg-lav transition-opacity duration-300', mode === 'led' ? 'opacity-100' : 'opacity-0')} />
          {mode === 'led' && <span className={cn('absolute inset-0', s.ledSweep)} />}
        </div>
      </div>

      <div className="lg:col-span-5">
        <fieldset>
          <legend className="label text-tone-4">Pick a blade</legend>
          <div className="mt-3 grid grid-cols-2 border-4 border-paper">
            {(['basic', 'led'] as const).map((m) => (
              <label
                key={m}
                htmlFor={`${uid}-${m}`}
                className={cn(
                  'press relative flex min-h-14 cursor-pointer items-center justify-center gap-2 px-3 text-center font-display text-[24px] uppercase transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-door',
                  m === 'led' && 'border-l-4 border-paper',
                  mode === m ? (m === 'led' ? 'bg-volt text-ink' : 'bg-paper text-ink') : 'bg-ink text-paper hover:bg-tone-1',
                )}
              >
                <input
                  id={`${uid}-${m}`}
                  type="radio"
                  name={`${uid}-blade`}
                  value={m}
                  checked={mode === m}
                  onChange={() => pick(m)}
                  className="sr-only"
                />
                {m === 'led' ? 'LED' : 'Basic'}
              </label>
            ))}
          </div>
        </fieldset>

        <div aria-live="polite" className="mt-6 border-4 border-paper bg-ink p-5 sm:p-6">
          <p className="label text-tone-4">{mode === 'led' ? 'LED cosplay katana' : 'Basic cosplay katana'}</p>
          <p className="font-display mt-2 text-[clamp(36px,4vw,52px)] uppercase leading-[0.9]">{cur.name}</p>
          <p className="font-mono mt-4 inline-block border-[3px] border-paper bg-volt px-2.5 py-1 text-[20px] font-bold text-ink">{cur.price}</p>
          <p className="mt-4 text-[16px] leading-[1.6] text-tone-4">{cur.line}</p>
          <Link
            href={`/product/${cur.slug}`}
            className="press focus-ring label mt-6 inline-flex min-h-12 items-center gap-2 border-[3px] border-paper bg-paper px-4 py-3 font-bold text-ink shadow-[4px_4px_0_0_var(--color-volt)] hover:bg-volt"
          >
            See the {mode === 'led' ? 'LED' : 'basic'} katana
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default KatanaCompare
