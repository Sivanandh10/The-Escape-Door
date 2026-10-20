'use client'
// S09 CTA: magnetic volt button whose door icon creaks open on hover/focus and swings wide on press
// (instant feedback, then the normal route transition). Owner: S09.
import { useState } from 'react'
import Link from 'next/link'
import { DoorIcon } from '@/components/brand'
import { Magnetic } from '@/components/motion/Magnetic'

export function ForgeCta() {
  const [open, setOpen] = useState(0)
  return (
    <Magnetic strength={0.3}>
      <Link
        href="/custom"
        data-cursor="OPEN"
        onPointerEnter={() => setOpen(0.45)}
        onPointerLeave={() => setOpen(0)}
        onFocus={() => setOpen(0.45)}
        onBlur={() => setOpen(0)}
        onPointerDown={() => setOpen(1)}
        onClick={() => setOpen(1)}
        className="press focus-ring group inline-flex min-h-14 items-center gap-3 border-[3px] border-ink bg-volt px-6 py-3 font-display text-[22px] uppercase leading-none tracking-wide text-ink shadow-hard"
      >
        <span className="grid size-9 place-items-center border-[3px] border-ink bg-door text-paper">
          <DoorIcon open={open} size={22} strokeWidth={2.4} />
        </span>
        Design Your Own
      </Link>
    </Magnetic>
  )
}

export default ForgeCta
