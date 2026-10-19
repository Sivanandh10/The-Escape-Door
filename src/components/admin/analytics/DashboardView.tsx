'use client'
// Dashboard body (P4a): KPI strip (#17), visits chart, funnel, top lists, sources, QR srcs, devices, regions.
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowRight, Eye, IndianRupee, Inbox, MessageCircle, ShoppingCart, Users } from 'lucide-react'
import { AdminPanel } from '../AdminPage'
import { AdminSkeleton, EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { StatCard } from '../StatCard'
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
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
      <StatCard index={0} tone="volt" label="Visits" jp="訪問" value={k.visits} delta={delta(k, prev, 'visits')} icon={<Eye className="size-4" />} hint="page views" />
      <StatCard index={1} label="Unique visitors" jp="訪問者" value={k.uniques} delta={delta(k, prev, 'uniques')} icon={<Users className="size-4" />} hint={`${nf.format(k.sessions)} sessions`} />
      <StatCard index={2} label="Add-to-cart rate" jp="カート率" value={k.addToCartRate} format="pct" delta={delta(k, prev, 'addToCartRate')} icon={<ShoppingCart className="size-4" />} hint={`${nf.format(k.addToCart)} adds`} />
      <StatCard index={3} tone="lav" label="WhatsApp clicks" jp="送信" value={k.whatsappClicks} delta={delta(k, prev, 'whatsappClicks')} icon={<MessageCircle className="size-4" />} />
      <StatCard index={4} label="Leads" jp="問い合わせ" value={k.leads} delta={delta(k, prev, 'leads')} icon={<Inbox className="size-4" />} hint={`${nf.format(k.orders)} orders`} />
      <StatCard index={5} tone="door" label="Revenue" jp="売上" value={k.revenueEstimate} format="inr" delta={delta(k, prev, 'revenueEstimate')} icon={<IndianRupee className="size-4" />} hint="estimate · WhatsApp order totals" />
    </div>
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

          <div className="grid gap-6 lg:grid-cols-3">
            <AdminPanel index={3} title="Top pages" jp="人気ページ" action={<MoreLink href={`/admin/analytics?range=${s.days}#pages`} />}>
              <BarList items={s.topPages} mono unit="views" />
            </AdminPanel>
            <AdminPanel index={4} title="Top collections" jp="人気アーク">
              <BarList items={s.topCollections} tone="lav" unit="views" />
            </AdminPanel>
            <AdminPanel index={5} title="Top products" jp="人気商品">
              <BarList items={s.topProducts} tone="pink" extraLabel="adds" />
            </AdminPanel>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <AdminPanel index={6} title="Traffic by source" jp="流入元" action={<MoreLink href={`/admin/analytics?range=${s.days}#sources`} />}>
              <BarList items={s.sources} unit="sessions" mono />
            </AdminPanel>
            <AdminPanel index={7} title="Fest QR codes" jp="QR流入" action={<MoreLink href="/admin/qr" label="QR studio" />}>
              {s.srcs.length ? (
                <BarList items={s.srcs.map((r) => ({ key: r.src, label: r.src, value: r.visits, extra: r.orders }))} tone="door" mono extraLabel="orders" />
              ) : (
                <EmptyState compact title="No QR scans yet" body="Print a stall QR and visits with ?src= land here." action={<Link href="/admin/qr" className={adminBtn({ size: 'sm' })}>Make a QR</Link>} />
              )}
            </AdminPanel>
            <AdminPanel index={8} title="Devices & regions" jp="端末・地域">
              <DeviceDonut data={s.devices} />
              <div className="mt-5 border-t-2 border-paper/10 pt-4">
                <p className="label mb-3 text-[10px] text-paper/50">Top cities</p>
                <BarList items={s.cities} tone="lav" max={5} unit="sessions" />
              </div>
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
      <span className="flex items-center gap-1.5"><span className="h-1 w-4 bg-volt" /> Visits</span>
      <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-lav" /> Uniques</span>
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
