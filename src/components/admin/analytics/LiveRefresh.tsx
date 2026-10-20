'use client'
// Live dashboard (CMS + ADMIN-DATA). Keeps the server-computed KPIs fresh without a reload:
//   • Supabase Realtime: inserts on analytics_events (analytics.view), leads (leads.view) and any change on
//     orders (orders.view) → debounced 10 s → router.refresh() (the server re-aggregates; RLS decides which
//     rows reach this browser, so members without those perms simply poll).
//   • Fallback: polling every 30 s when Realtime is unavailable / not subscribed; a 2 min heartbeat even
//     when live (catches tables that aren't in the realtime publication yet).
//   • Hidden tab: nothing refreshes; coming back refreshes once if anything changed or it is stale.
// Indicator: "● LIVE" (realtime connected) · "● AUTO 30 s" (polling) · "DEMO" (no Supabase).
import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabaseBrowser } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useCan } from '../AdminContext'

type Mode = 'connecting' | 'live' | 'poll' | 'demo'

const DEBOUNCE_MS = 10_000
const POLL_MS = 30_000
const HEARTBEAT_MS = 120_000
/** events that never change a KPI (sent while a visit is ending) */
const IGNORED_EVENTS = new Set(['scroll_depth', 'page_leave'])

export function LiveRefresh({ generatedAt, demo, className }: { generatedAt: string; demo: boolean; className?: string }) {
  const router = useRouter()
  const [refreshing, startTransition] = useTransition()
  const canAnalytics = useCan('analytics.view')
  const canLeads = useCan('leads.view')
  const canOrders = useCan('orders.view')
  const [mode, setMode] = useState<Mode>(demo ? 'demo' : 'connecting')
  const [queued, setQueued] = useState(0)
  const timer = useRef<number | null>(null)
  const dirty = useRef(false)
  const lastRefresh = useRef(0)
  const channelName = `admin-live-${useId().replace(/[^a-z0-9]/gi, '')}`

  const refresh = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    if (document.visibilityState === 'hidden') {
      dirty.current = true
      return
    }
    dirty.current = false
    lastRefresh.current = Date.now()
    setQueued(0)
    startTransition(() => router.refresh())
  }, [router])

  const bump = useCallback(() => {
    setQueued((q) => q + 1)
    if (timer.current) return
    timer.current = window.setTimeout(() => {
      timer.current = null
      refresh()
    }, DEBOUNCE_MS)
  }, [refresh])

  // stamp the first render so "stale" is measured from page load
  useEffect(() => {
    lastRefresh.current = Date.now()
  }, [])

  // Realtime subscription
  useEffect(() => {
    if (demo) return
    const sb = supabaseBrowser()
    const tables = [canAnalytics && 'analytics_events', canLeads && 'leads', canOrders && 'orders'].filter(Boolean) as string[]
    if (!sb || !tables.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- nothing to subscribe to: poll instead
      setMode('poll')
      return
    }
    let alive = true
    let channel: RealtimeChannel | null = null
    ;(async () => {
      try {
        const { data } = await sb.auth.getSession()
        if (!alive) return
        if (data.session) await sb.realtime.setAuth(data.session.access_token)
        if (!alive) return
        channel = sb.channel(channelName)
        for (const table of tables) {
          channel.on(
            'postgres_changes',
            { event: table === 'orders' ? '*' : 'INSERT', schema: 'public', table },
            (payload: { new?: Record<string, unknown> }) => {
              if (table === 'analytics_events') {
                const row = payload.new ?? {}
                if (IGNORED_EVENTS.has(String(row.name ?? ''))) return
                if (/^\/(admin|lab|api)(\/|$)/.test(String(row.path ?? ''))) return
              }
              bump()
            },
          )
        }
        channel.subscribe((status) => {
          if (!alive) return
          if (status === 'SUBSCRIBED') setMode('live')
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setMode('poll')
        })
      } catch {
        if (alive) setMode('poll')
      }
    })()
    // never stay on "connecting…" forever
    const giveUp = window.setTimeout(() => alive && setMode((m) => (m === 'connecting' ? 'poll' : m)), 12_000)
    return () => {
      alive = false
      window.clearTimeout(giveUp)
      if (channel) void sb.removeChannel(channel)
    }
  }, [demo, canAnalytics, canLeads, canOrders, bump, channelName])

  // Polling (fallback) / heartbeat (live)
  useEffect(() => {
    if (demo || mode === 'connecting') return
    const every = mode === 'poll' ? POLL_MS : HEARTBEAT_MS
    const id = window.setInterval(() => {
      if (Date.now() - lastRefresh.current >= every - 1000) refresh()
    }, every)
    return () => window.clearInterval(id)
  }, [demo, mode, refresh])

  // Back to the tab → refresh once when something changed or the numbers are stale
  useEffect(() => {
    if (demo) return
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      if (dirty.current || Date.now() - lastRefresh.current > POLL_MS) refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [demo, refresh])

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  const time = new Date(generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  if (mode === 'demo') {
    return (
      <p className={cn('inline-flex min-h-11 items-center gap-2 border-2 border-hype px-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-hype', className)}>
        Demo data · not live
      </p>
    )
  }

  const live = mode === 'live'
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <p
        role="status"
        aria-live="polite"
        className={cn(
          'inline-flex min-h-11 items-center gap-2 border-2 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em]',
          live ? 'border-hype text-paper' : 'border-paper/25 text-paper/70',
        )}
        title={
          live
            ? 'Realtime connected — new visits, leads and orders refresh these numbers within ~10 s.'
            : mode === 'poll'
              ? 'Realtime unavailable for your role or connection — numbers refresh every 30 s.'
              : 'Connecting to Realtime…'
        }
      >
        <span aria-hidden="true" className="relative grid size-2.5 place-items-center">
          {live && <span className="absolute inset-0 rounded-full bg-hype opacity-70 motion-safe:animate-ping" />}
          <span className={cn('relative size-2.5 rounded-full', live ? 'bg-hype' : mode === 'poll' ? 'bg-volt' : 'bg-paper/40')} />
        </span>
        {live ? 'Live' : mode === 'poll' ? 'Auto · 30 s' : 'Connecting…'}
        <span className="font-normal normal-case tracking-normal text-paper/55">
          · updated <time dateTime={generatedAt} suppressHydrationWarning>{time}</time>
        </span>
        {queued > 0 && !refreshing && (
          <span className="border border-volt px-1.5 text-volt">
            {queued} new · updating
          </span>
        )}
      </p>
      <button
        type="button"
        onClick={refresh}
        disabled={refreshing}
        className="press grid min-h-11 min-w-11 place-items-center border-2 border-paper/25 text-paper/80 focus-ring transition-colors duration-150 disabled:opacity-60 can-hover:hover:border-volt can-hover:hover:text-volt"
      >
        <RefreshCw aria-hidden="true" className={cn('size-4', refreshing && 'motion-safe:animate-spin')} />
        <span className="sr-only">{refreshing ? 'Refreshing…' : 'Refresh numbers now'}</span>
      </button>
    </div>
  )
}
