'use client'
// /admin/analytics body (P4a): deeper tables, per-src breakdown, regions, lead kinds, integration slots.
import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { AdminPanel } from '../AdminPage'
import { DataTable, type DataTableColumn } from '../DataTable'
import { ErrorState } from '../ErrorState'
import { formatINR } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import { BarList } from './BarList'
import { KpiStrip, NoTraffic } from './DashboardView'
import { Funnel } from './Funnel'
import type { AnalyticsSnapshot, Ranked, SrcRow } from './types'

const nf = new Intl.NumberFormat('en-IN')

function rankedCols(label: string, unit: string, total: number, mono = false, extraHeader?: string): DataTableColumn<Ranked>[] {
  return [
    { id: 'label', header: label, cell: (r) => <span className={cn(mono && 'font-mono text-[13px]', 'break-all')}>{r.label}</span>, sortValue: (r) => r.label },
    { id: 'value', header: unit, align: 'right', cell: (r) => <span className="font-mono font-bold tabular-nums">{nf.format(r.value)}</span>, sortValue: (r) => r.value },
    ...(extraHeader
      ? [{ id: 'extra', header: extraHeader, align: 'right', cell: (r) => <span className="font-mono tabular-nums">{nf.format(r.extra ?? 0)}</span>, sortValue: (r) => r.extra ?? 0 } satisfies DataTableColumn<Ranked>]
      : []),
    { id: 'share', header: 'Share', align: 'right', cell: (r) => <span className="font-mono tabular-nums text-paper/65">{total ? ((r.value / total) * 100).toFixed(1) : '0'}%</span>, sortValue: (r) => r.value },
  ]
}

const srcCols: DataTableColumn<SrcRow>[] = [
  { id: 'src', header: 'src', cell: (r) => <span className="font-mono font-bold text-volt">{r.src}</span>, sortValue: (r) => r.src },
  { id: 'visits', header: 'Visits (sessions)', align: 'right', cell: (r) => <span className="font-mono tabular-nums">{nf.format(r.visits)}</span>, sortValue: (r) => r.visits },
  { id: 'uniques', header: 'Uniques', align: 'right', cell: (r) => <span className="font-mono tabular-nums">{nf.format(r.uniques)}</span>, sortValue: (r) => r.uniques },
  { id: 'leads', header: 'Leads', align: 'right', cell: (r) => <span className="font-mono tabular-nums">{nf.format(r.leads)}</span>, sortValue: (r) => r.leads },
  { id: 'orders', header: 'Orders', align: 'right', cell: (r) => <span className="font-mono tabular-nums">{nf.format(r.orders)}</span>, sortValue: (r) => r.orders },
  { id: 'revenue', header: 'Revenue (est.)', align: 'right', cell: (r) => <span className="font-mono font-bold tabular-nums">{formatINR(r.revenue)}</span>, sortValue: (r) => r.revenue },
]

const sum = (r: Ranked[]) => r.reduce((s, x) => s + x.value, 0)

export function AnalyticsView({ s }: { s: AnalyticsSnapshot }) {
  const [geo, setGeo] = useState<'countries' | 'regions' | 'cities'>('cities')
  if (s.error) return <ErrorState title="Analytics didn’t load" message={`Supabase said: ${s.error}`} onRetry={() => location.reload()} />
  const empty = !s.demo && s.kpis.visits === 0 && s.kpis.leads === 0
  const geoRows = s[geo]

  return (
    <>
      <KpiStrip s={s} />
      {empty && <NoTraffic />}

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminPanel id="pages" index={1} title="Pages" jp="ページ">
          <DataTable caption="Top pages" rows={s.topPages} rowKey={(r) => r.key} columns={rankedCols('Path', 'Views', sum(s.topPages), true, 'Visitors')} initialSort={{ id: 'value', dir: 'desc' }} pageSize={10} dense />
        </AdminPanel>
        <AdminPanel id="sources" index={2} title="Sources" jp="流入元">
          <DataTable caption="Traffic sources" rows={s.sources} rowKey={(r) => r.key} columns={rankedCols('Source', 'Sessions', sum(s.sources), true)} initialSort={{ id: 'value', dir: 'desc' }} pageSize={10} dense />
        </AdminPanel>
      </div>

      <AdminPanel id="src" index={3} title="Per-src breakdown (fest QR)" jp="QR別" shadow="door">
        <DataTable
          caption="Attribution by src"
          rows={s.srcs}
          rowKey={(r) => r.src}
          columns={srcCols}
          initialSort={{ id: 'visits', dir: 'desc' }}
          search={{ placeholder: 'Find a src…', text: (r) => r.src }}
          dense
        />
      </AdminPanel>

      <div className="grid gap-6 xl:grid-cols-3">
        <AdminPanel index={4} title="Region" jp="地域" className="xl:col-span-2"
          action={
            <div role="tablist" aria-label="Region level" className="inline-flex border-2 border-paper/20">
              {(['countries', 'regions', 'cities'] as const).map((g) => (
                <button key={g} type="button" role="tab" aria-selected={geo === g} onClick={() => setGeo(g)}
                  className={cn('min-h-9 px-2.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] focus-ring', geo === g ? 'bg-volt text-ink' : 'text-paper/70 can-hover:hover:text-paper')}>
                  {g === 'regions' ? 'states' : g}
                </button>
              ))}
            </div>
          }>
          <DataTable caption={`Sessions by ${geo}`} rows={geoRows} rowKey={(r) => r.key} columns={rankedCols(geo === 'regions' ? 'State' : geo === 'cities' ? 'City' : 'Country', 'Sessions', sum(geoRows))} initialSort={{ id: 'value', dir: 'desc' }} pageSize={10} dense />
        </AdminPanel>
        <AdminPanel index={5} title="Leads by kind" jp="種類">
          <BarList items={s.leadsByKind} tone="pink" mono />
        </AdminPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminPanel index={6} title="Funnel" jp="コンバージョン">
          <Funnel steps={s.funnel} />
        </AdminPanel>
        <AdminPanel id="integrations" index={7} title="Integrations" jp="連携">
          <ul className="divide-y-2 divide-paper/10">
            <Slot ok={s.integrations.supabase} name="Supabase" note="Catalogue, leads, owner login and these numbers." />
            <Slot ok={s.integrations.tracking} name="First-party tracking" note="Netlify function → analytics_events (needs the service key). No IPs stored." />
            <Slot ok={s.integrations.ga4} name="Google Analytics 4" note="Optional. Set NEXT_PUBLIC_GA4_ID to switch it on." />
            <Slot ok={s.integrations.clarity} name="Microsoft Clarity" note="Optional heatmaps. Set NEXT_PUBLIC_CLARITY_ID." />
          </ul>
          {s.capped && <p className="mt-3 text-[12.5px] text-volt">Showing the first {nf.format(s.scanned)} events of this range — pick a shorter range for exact totals.</p>}
        </AdminPanel>
      </div>
    </>
  )
}

function Slot({ ok, name, note }: { ok: boolean; name: string; note: string }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <span className={cn('mt-0.5 grid size-6 shrink-0 place-items-center border-2 border-ink', ok ? 'bg-volt text-ink' : 'bg-tone-2 text-paper/60')}>
        {ok ? <Check aria-hidden="true" className="size-3.5" /> : <X aria-hidden="true" className="size-3.5" />}
      </span>
      <div className="min-w-0">
        <p className="font-semibold">{name} <span className="sr-only">{ok ? 'connected' : 'not connected'}</span><span aria-hidden="true" className={cn('ml-2 font-mono text-[10.5px] uppercase', ok ? 'text-volt' : 'text-paper/45')}>{ok ? 'on' : 'off'}</span></p>
        <p className="text-[13px] text-paper/60">{note}</p>
      </div>
    </li>
  )
}
