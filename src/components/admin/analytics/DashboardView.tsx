'use client'
// Dashboard body (P4a): KPI strip (#17), visits chart, funnel, top lists, sources, QR srcs, devices, regions.
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Eye, FileText, IndianRupee, Inbox, Info, MessageCircle, ShoppingCart, Users } from 'lucide-react'
import { AdminPanel } from '../AdminPage'
import { AdminSkeleton, EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { StatCard } from '../StatCard'
import { cn } from '@/lib/utils'
import { adminBtn } from '../ui'
import { BarList } from './BarList'
import { Funnel } from './Funnel'
import type { AnalyticsSnapshot, Kpis } from './types'

const VisitsChart = dynamic(() => import('./Charts').then((m) => m.VisitsChart), { ssr: false, loading: () => <AdminSkeleton variant="chart" /> })
const DeviceDonut = dynamic(() => import('./Charts').then((m) => m.DeviceDonut), { ssr: false, loading: () => <div className="skeleton-tone h-[132px]" /> })

const nf = new Intl.NumberFormat('en-IN')
const delta = (cur: Kpis, prev: Kpis | null, k: keyof Kpis) => {
  if (!prev) return null
  const p = prev[k], c = cur[k]
  if (!p) return null
  return (c - p) / p
}

export function KpiStrip({ s }: { s: AnalyticsSnapshot }) {
  const { kpis: k, prev } = s
  const perVisit = k.visits ? (k.pageViews / k.visits).toFixed(1) : '0.0'
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard index={0} tone="volt" label="Visits" jp="訪問" value={k.visits} delta={delta(k, prev, 'visits')} icon={<Eye className="size-4" />} hint="sessions" />
      <StatCard index={1} label="Unique visitors" jp="訪問者" value={k.uniques} delta={delta(k, prev, 'uniques')} icon={<Users className="size-4" />} hint="browsers / devices" />
      <StatCard index={2} label="Page views" jp="閲覧数" value={k.pageViews} delta={delta(k, prev, 'pageViews')} icon={<FileText className="size-4" />} hint={`${perVisit} per visit`} />
      <StatCard index={3} label="Add-to-cart rate" jp="カート率" value={k.addToCartRate} format="pct" delta={delta(k, prev, 'addToCartRate')} icon={<ShoppingCart className="size-4" />} hint={`${nf.format(k.cartSessions)} visits · ${nf.format(k.addToCart)} adds`} />
      <StatCard index={4} tone="lav" label="WhatsApp clicks" jp="送信" value={k.whatsappClicks} delta={delta(k, prev, 'whatsappClicks')} icon={<MessageCircle className="size-4" />} hint={`visits · ${nf.format(k.whatsappRaw)} clicks total`} />
      <StatCard index={5} label="Leads" jp="問い合わせ" value={k.leads} delta={delta(k, prev, 'leads')} icon={<Inbox className="size-4" />} hint={s.revenueSource === 'orders' ? `${nf.format(k.orders)} orders placed` : `${nf.format(k.orders)} WhatsApp orders`} />
      <StatCard
        index={6}
        tone="door"
        label={s.revenueSource === 'orders' ? 'Revenue' : 'Revenue (est.)'}
        jp="売上"
        value={k.revenueEstimate}
        format="inr"
        delta={delta(k, prev, 'revenueEstimate')}
        icon={<IndianRupee className="size-4" />}
        hint={s.revenueSource === 'orders' ? `${nf.format(k.orders)} orders · cancelled excluded` : 'estimate · WhatsApp order totals (no orders yet)'}
      />
      <HowWeCount />
    </div>
  )
}

/** One line per metric so the owner knows what a number means (fills the 8th KPI cell). */
function HowWeCount() {
  return (
    <div className="col-span-2 border-2 border-dashed border-paper/20 p-3.5 md:col-span-1">
      <p className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-paper/60">
        <Info aria-hidden="true" className="size-3.5" /> How we count
      </p>
      <dl className="space-y-1.5 text-[12px] leading-snug text-paper/70">
        <div><dt className="inline font-semibold text-paper">Visit</dt> <dd className="inline">one session; refreshes and page changes stay one visit, a new one starts after 30 min idle or a new day.</dd></div>
        <div><dt className="inline font-semibold text-paper">Unique visitor</dt> <dd className="inline">one browser/device, counted once however often it comes back.</dd></div>
        <div><dt className="inline font-semibold text-paper">Page view</dt> <dd className="inline">each different page opened in a visit, once; reloads don&apos;t add.</dd></div>
        <div className="text-paper/50">Your own browser stops being counted once it opens /admin.</div>
      </dl>
    </div>
  )
}

/** Partial failures (leads / orders didn't load) — said out loud instead of showing a quiet zero. */
export function SnapshotWarnings({ s }: { s: AnalyticsSnapshot }) {
  if (!s.warnings?.length) return null
  return (
    <ul role="status" className="space-y-2">
      {s.warnings.map((w) => (
        <li key={w} className="flex items-start gap-2 border-2 border-ink bg-volt px-3 py-2 text-[13.5px] font-semibold text-ink shadow-[4px_4px_0_var(--color-hype)]">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {w}
        </li>
      ))}
    </ul>
  )
}

export function NoTraffic() {
  return (
    <EmptyState
      title="No visitors tracked yet"
      body={
        <>
          Supabase is connected, but no analytics events landed in this range. Events arrive from the live site through{' '}
          <code className="font-mono text-[12.5px] text-volt">/.netlify/functions/track</code> (it doesn&apos;t run under <code className="font-mono">next dev</code>). Visitors with
          Do-Not-Track or Global Privacy Control are never counted.
        </>
      }
      action={<Link href="/" className={adminBtn({ variant: 'ghost' })}>Open the site</Link>}
    />
  )
}

export function DashboardView({ s }: { s: AnalyticsSnapshot }) {
  if (s.error) return <ErrorState title="Analytics didn’t load" message={`Supabase said: ${s.error}`} onRetry={() => location.reload()} />
  const empty = !s.demo && s.kpis.visits === 0 && s.kpis.leads === 0

  return (
    <>
      <SnapshotWarnings s={s} />
      <KpiStrip s={s} />
      {empty ? (
        <NoTraffic />
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <AdminPanel index={1} title={<>Visits over time</>} jp="訪問の推移" shadow="door" action={<Legend />}>
              <VisitsChart data={s.series} />
            </AdminPanel>
            <AdminPanel index={2} title="Funnel" jp="コンバージョン">
              <Funnel steps={s.funnel} />
            </AdminPanel>
          </div>

          {/* limited = no analytics.view: pages, sources and cities were stripped on the server */}
          <div className={cn('grid gap-6', s.limited ? 'lg:grid-cols-2' : 'lg:grid-cols-3')}>
            {!s.limited && (
              <AdminPanel index={3} title="Top pages" jp="人気ページ" action={<MoreLink href={`/admin/analytics?range=${s.days}#pages`} />}>
                <BarList items={s.topPages} mono unit="views" extraLabel="visitors" />
              </AdminPanel>
            )}
            <AdminPanel index={4} title="Top collections" jp="人気アーク">
              <BarList items={s.topCollections} tone="lav" unit="views" />
            </AdminPanel>
            <AdminPanel index={5} title="Top products" jp="人気商品">
              <BarList items={s.topProducts} tone="pink" extraLabel="adds" />
            </AdminPanel>
          </div>

          <div className={cn('grid gap-6', s.limited ? 'lg:grid-cols-2' : 'lg:grid-cols-3')}>
            {!s.limited && (
              <AdminPanel index={6} title="Traffic by source" jp="流入元" action={<MoreLink href={`/admin/analytics?range=${s.days}#sources`} />}>
                <BarList items={s.sources} unit="sessions" mono />
              </AdminPanel>
            )}
            {(!s.limited || s.srcs.length > 0) && (
              <AdminPanel index={7} title="Fest QR codes" jp="QR流入" action={<MoreLink href="/admin/qr" label="QR studio" />}>
                {s.srcs.length ? (
                  <BarList items={s.srcs.map((r) => ({ key: r.src, label: r.src, value: r.visits, extra: r.orders }))} tone="door" mono extraLabel="orders" />
                ) : (
                  <EmptyState compact title="No QR scans yet" body="Print a stall QR and visits with ?src= land here." action={<Link href="/admin/qr" className={adminBtn({ size: 'sm' })}>Make a QR</Link>} />
                )}
              </AdminPanel>
            )}
            <AdminPanel index={8} title={s.limited ? 'Devices' : 'Devices & regions'} jp={s.limited ? '端末' : '端末・地域'}>
              <DeviceDonut data={s.devices} />
              {!s.limited && (
                <div className="mt-5 border-t-2 border-paper/10 pt-4">
                  <p className="label mb-3 text-[10px] text-paper/50">Top cities</p>
                  <BarList items={s.cities} tone="lav" max={5} unit="sessions" />
                </div>
              )}
            </AdminPanel>
          </div>
        </>
      )}
    </>
  )
}

function Legend() {
  return (
    <div className="hidden items-center gap-3 font-mono text-[11px] text-paper/65 sm:flex" aria-hidden="true">
      <span className="flex items-center gap-1.5"><span className="h-1 w-4 bg-volt" /> Visits (sessions)</span>
      <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-lav" /> Unique visitors</span>
    </div>
  )
}

function MoreLink({ href, label = 'More' }: { href: string; label?: string }) {
  return (
    <Link href={href} className="group inline-flex min-h-9 items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-volt focus-ring">
      {label}
      <ArrowRight aria-hidden="true" className="size-3.5 transition-transform duration-150 can-hover:group-hover:translate-x-0.5" />
    </Link>
  )
}
