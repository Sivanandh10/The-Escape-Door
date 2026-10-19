'use client'
// 404 search box → /shop?q=… (the WebSite SearchAction target). Owner: P5.
// Instant feedback: the field slams into its shadow on submit; empty submit nudges with a shake.
import { useRouter } from 'next/navigation'
import { useId, useState, type FormEvent } from 'react'
import { motion, useAnimationControls } from 'motion/react'
import { Search } from 'lucide-react'
import { track } from '@/lib/analytics'

export function NotFoundSearch() {
  const id = useId()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [going, setGoing] = useState(false)
  const shake = useAnimationControls()

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    if (!term) {
      shake.start({ x: [0, -6, 6, -4, 0], transition: { duration: 0.3 } })
      return
    }
    setGoing(true)
    track('search', { q: term.slice(0, 60), from: '404' })
    router.push(`/shop?q=${encodeURIComponent(term)}`)
  }

  return (
    <motion.form role="search" onSubmit={onSubmit} animate={shake} className="w-full max-w-[560px]">
      <label htmlFor={id} className="label block text-tone-4">
        Search the shop instead
      </label>
      <div className="mt-2 flex border-[3px] border-paper bg-paper shadow-[6px_6px_0_0_var(--color-volt)] focus-within:shadow-[6px_6px_0_0_var(--color-door)]">
        <input
          id={id}
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try “hoodie”, “polaroid” or “katana”"
          enterKeyHint="search"
          className="min-h-13 min-w-0 flex-1 bg-transparent px-4 text-[17px] text-ink placeholder:text-tone-3 focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Search"
          disabled={going}
          className="press label flex min-h-13 shrink-0 items-center gap-2 border-l-[3px] border-ink bg-volt px-4 font-bold text-ink hover:bg-volt-hot disabled:skeleton-tone"
        >
          <Search aria-hidden="true" className="size-5" />
          <span className="hidden sm:inline">{going ? 'Opening…' : 'Search'}</span>
        </button>
      </div>
    </motion.form>
  )
}

export default NotFoundSearch
