'use client'
// Empty state: Kado asleep on the cart ("Your cart's taking a nap") + one clear action. Owner: P2.
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Mascot } from '@/components/brand/Mascot'
import { cn } from '@/lib/utils'

export function EmptyCart({ onNavigate, className, as: H = 'h2' }: { onNavigate?: () => void; className?: string; as?: 'h2' | 'h3' }) {
  return (
    <div className={cn('flex flex-col items-center px-4 py-8 text-center text-ink', className)}>
      <div className="relative">
        <span aria-hidden="true" className="screentone screentone-mid absolute inset-x-[-18px] bottom-1 top-6 -z-0 rounded-full text-lav [--tone-opacity:0.9]" />
        <Mascot mood="sleepy" size={150} animate title="" className="relative" />
      </div>
      <H className="mt-4 font-display text-[40px] uppercase leading-[0.9] tracking-[-0.01em] [&_em]:not-italic">
        Your cart&rsquo;s taking a <em className="accent">nap</em>
      </H>
      <p lang="ja" className="jp-sub mt-2 text-[12px]">カートはおやすみ中</p>
      <p className="mt-3 max-w-[30ch] text-[15px] text-tone-2">
        Nothing in here yet. Pick an arc, grab a tee or three polaroids, and wake it up.
      </p>
      <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/shop"
          onClick={onNavigate}
          data-cursor="OPEN"
          className="press group flex min-h-12 items-center justify-center gap-2 border-[3px] border-ink bg-volt px-5 font-mono text-[13px] font-bold uppercase tracking-[0.14em] shadow-hard"
        >
          Shop the drop
          <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-200 can-hover:group-hover:translate-x-1" />
        </Link>
        <Link
          href="/custom"
          onClick={onNavigate}
          className="press flex min-h-12 items-center justify-center border-[3px] border-ink bg-paper px-5 font-mono text-[12px] font-bold uppercase tracking-[0.14em]"
        >
          Design Your Own
        </Link>
      </div>
    </div>
  )
}
