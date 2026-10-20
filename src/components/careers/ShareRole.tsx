'use client'
// Share a job post: Web Share sheet on phones, copy-link fallback elsewhere (instant "Copied!" feedback). Owner: CAREERS.
import { useEffect, useRef, useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ShareRole({ title, path, className }: { title: string; path: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const onShare = async () => {
    const url = `${window.location.origin}${path}`
    const text = `${title} — open role at The Escape Door`
    try {
      if (typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: text, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1800)
    } catch {
      /* share sheet dismissed / clipboard blocked — nothing to do */
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      className={cn(
        'press focus-ring label inline-flex min-h-13 items-center gap-2 border-[3px] border-paper px-5 py-3.5 text-[13px] font-bold transition-colors duration-150',
        copied ? 'bg-paper text-ink' : 'bg-transparent text-paper hover:bg-paper/10',
        className,
      )}
    >
      {copied ? <Check aria-hidden="true" className="size-4" /> : <Share2 aria-hidden="true" className="size-4" />}
      <span aria-live="polite">{copied ? 'Link copied' : 'Share role'}</span>
    </button>
  )
}

export default ShareRole
