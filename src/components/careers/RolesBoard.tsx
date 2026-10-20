'use client'
// /careers open-roles board: team + type filter chips (client-side, the page stays static) and role cards
// → /careers/[slug]. Designed empty state (no roles at all) and no-match state (filters). Owner: CAREERS.
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, Briefcase, MapPin, Wifi } from 'lucide-react'
import { Mascot } from '@/components/brand'
import { INSTAGRAM_URL } from '@/lib/seo'
import { useReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { JOB_TYPES, jobTypeLabel, type Job } from './model'

export type RoleCard = Pick<Job, 'id' | 'slug' | 'title' | 'team' | 'location' | 'type' | 'isRemote' | 'createdAt'> & { blurb: string }

const TONES = ['bg-volt', 'bg-lav', 'bg-pink'] as const

function FilterChips({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ id: string; label: string; count: number }> }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cn(
              'press focus-ring label inline-flex min-h-11 items-center gap-2 border-[3px] border-ink px-3.5 font-bold transition-[background-color,box-shadow,translate] duration-150',
              on ? 'bg-ink text-paper shadow-[4px_4px_0_var(--color-door)]' : 'bg-paper text-ink can-hover:hover:-translate-y-0.5 can-hover:hover:shadow-hard-sm',
            )}
          >
            {o.label}
            <span className={cn('tabular-nums', on ? 'text-volt' : 'text-tone-3')}>{o.count}</span>
          </button>
        )
      })}
    </div>
  )
}

export function RolesBoard({ roles }: { roles: RoleCard[] }) {
  const reduced = useReducedMotion()
  const [team, setTeam] = useState('all')
  const [type, setType] = useState('all')

  const teams = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of roles) if (r.team) m.set(r.team, (m.get(r.team) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [roles])
  const types = useMemo(() => JOB_TYPES.map((t) => ({ id: t.id as string, label: t.label, count: roles.filter((r) => r.type === t.id).length })).filter((t) => t.count > 0), [roles])

  const shown = roles.filter((r) => (team === 'all' || r.team === team) && (type === 'all' || r.type === type))

  if (roles.length === 0) {
    return (
      <div className="relative grid gap-6 border-4 border-ink bg-paper p-6 text-ink shadow-hard-lg grain sm:grid-cols-[auto_1fr] sm:items-center sm:p-10">
        <Mascot mood="sleepy" size={120} animate title="" className="mx-auto sm:mx-0" />
        <div>
          <p className="label text-tone-2">No open roles right now</p>
          <p className="font-display mt-3 text-[clamp(32px,4.4vw,52px)] uppercase leading-[0.92]">The door is shut — for now</p>
          <p className="mt-4 max-w-[52ch] text-[17px] leading-[1.6]">
            We post every opening here first. Follow us on Instagram to catch the next one, or tell us what you’d love to work on.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="press focus-ring label inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-volt px-4 font-bold shadow-hard-sm hover:bg-volt-hot">
              Follow @escapedoor.in <ArrowUpRight aria-hidden="true" className="size-4" />
            </a>
            <Link href="/contact" className="press focus-ring label inline-flex min-h-12 items-center gap-2 border-[3px] border-ink bg-paper px-4 font-bold hover:bg-lav">
              Say hello
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {(teams.length > 1 || types.length > 1) && (
        <div className="mb-8 flex flex-col gap-4 border-4 border-ink bg-paper p-4 text-ink shadow-hard-sm sm:p-5 lg:flex-row lg:items-start lg:gap-10">
          {teams.length > 1 && (
            <div>
              <p className="label mb-2 text-tone-2">Team</p>
              <FilterChips label="Filter by team" value={team} onChange={setTeam} options={[{ id: 'all', label: 'All', count: roles.length }, ...teams.map(([id, count]) => ({ id, label: id, count }))]} />
            </div>
          )}
          {types.length > 1 && (
            <div>
              <p className="label mb-2 text-tone-2">Type</p>
              <FilterChips label="Filter by type" value={type} onChange={setType} options={[{ id: 'all', label: 'All', count: roles.length }, ...types]} />
            </div>
          )}
        </div>
      )}

      <p className="sr-only" aria-live="polite">{shown.length} role{shown.length === 1 ? '' : 's'} shown</p>

      {shown.length === 0 ? (
        <div className="flex flex-col items-start gap-4 border-4 border-dashed border-ink bg-paper p-6 text-ink sm:flex-row sm:items-center">
          <Mascot mood="peek" size={80} title="" />
          <p className="flex-1 text-[17px]">No roles match those filters.</p>
          <button type="button" onClick={() => { setTeam('all'); setType('all') }} className="press focus-ring label inline-flex min-h-11 items-center border-[3px] border-ink bg-volt px-4 font-bold shadow-hard-sm">
            Show all roles
          </button>
        </div>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2">
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((r, i) => (
              <motion.li
                key={r.id}
                layout={!reduced}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, rotate: -1 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 400, damping: 28 }}
              >
                <Link
                  href={`/careers/${r.slug}`}
                  data-cursor="OPEN"
                  className={cn(
                    'group focus-ring relative flex h-full flex-col border-4 border-ink p-5 text-ink shadow-hard transition-[translate,box-shadow] duration-200 sm:p-6',
                    'can-hover:hover:-translate-x-1 can-hover:hover:-translate-y-1 can-hover:hover:shadow-[10px_10px_0_var(--color-ink)]',
                    TONES[i % TONES.length],
                  )}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    {r.team && <span className="label border-2 border-ink bg-paper px-2 py-0.5 font-bold">{r.team}</span>}
                    <span className="label border-2 border-ink bg-ink px-2 py-0.5 font-bold text-paper">{jobTypeLabel(r.type)}</span>
                  </span>
                  <span className="font-display mt-4 block text-[clamp(34px,4vw,52px)] uppercase leading-[0.9]">{r.title}</span>
                  {r.blurb && <span className="mt-3 line-clamp-3 block text-[16px] leading-[1.55]">{r.blurb}</span>}
                  <span className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-5 text-[14px] font-semibold">
                    <span className="inline-flex items-center gap-1.5"><MapPin aria-hidden="true" className="size-4" />{r.location || 'India'}</span>
                    {r.isRemote && <span className="inline-flex items-center gap-1.5"><Wifi aria-hidden="true" className="size-4" />Remote OK</span>}
                    <span className="label ml-auto inline-flex items-center gap-1.5 font-bold underline decoration-2 underline-offset-4">
                      <Briefcase aria-hidden="true" className="size-4" /> View &amp; apply
                      <ArrowUpRight aria-hidden="true" className="size-4 transition-transform duration-200 can-hover:group-hover:-translate-y-0.5 can-hover:group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </Link>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  )
}

export default RolesBoard
