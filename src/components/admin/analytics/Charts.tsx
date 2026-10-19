'use client'
// Recharts views (P4a), loaded lazily by the dashboard. Manga styling: ink strokes, volt screentone fill, hard tooltip.
import { Area, AreaChart, CartesianGrid, Cell, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useReducedMotion } from '@/lib/motion'
import type { Ranked, SeriesPoint } from './types'

const C = { ink: '#0b0b0f', paper: '#f4efe6', volt: '#ffe14d', lav: '#c9b8ff', pink: '#ffb8de', door: '#6d3bff', tone: '#2b2b33' }
const nf = new Intl.NumberFormat('en-IN')

interface TipProps { active?: boolean; label?: string | number; payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string | number }> }
function Tip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="border-2 border-ink bg-paper px-3 py-2 text-ink shadow-[4px_4px_0_var(--color-volt)]">
      {label != null && <p className="label mb-1 text-[10px] text-ink/60">{label}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 font-mono text-[12.5px] font-bold tabular-nums">
          <span className="size-2.5 border border-ink" style={{ background: p.color }} aria-hidden="true" />
          {p.name}: {nf.format(Number(p.value ?? 0))}
        </p>
      ))}
    </div>
  )
}

export function VisitsChart({ data }: { data: SeriesPoint[] }) {
  const reduced = useReducedMotion()
  const dense = data.length > 31
  return (
    <div className="h-[260px] w-full sm:h-[300px]" role="img" aria-label={`Visits per day, ${data.length} days`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <pattern id="adm-tone" width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill={C.volt} fillOpacity="0.16" />
              <circle cx="3" cy="3" r="1.25" fill={C.volt} fillOpacity="0.75" />
            </pattern>
          </defs>
          <CartesianGrid stroke={C.paper} strokeOpacity={0.07} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: C.paper, fillOpacity: 0.5, fontSize: 11, fontFamily: 'var(--font-mono)' }}
            tickLine={false}
            axisLine={{ stroke: C.paper, strokeOpacity: 0.2 }}
            interval={dense ? Math.ceil(data.length / 8) : 'preserveStartEnd'}
            minTickGap={12}
          />
          <YAxis
            tick={{ fill: C.paper, fillOpacity: 0.5, fontSize: 11, fontFamily: 'var(--font-mono)' }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
          />
          <Tooltip content={<Tip />} cursor={{ stroke: C.volt, strokeWidth: 2, strokeDasharray: '4 4' }} />
          <Area
            type="monotone"
            dataKey="visits"
            name="Visits"
            stroke={C.volt}
            strokeWidth={3}
            fill="url(#adm-tone)"
            isAnimationActive={!reduced}
            animationDuration={1100}
            activeDot={{ r: 5, stroke: C.ink, strokeWidth: 2, fill: C.volt }}
          />
          <Line
            type="monotone"
            dataKey="uniques"
            name="Unique visitors"
            stroke={C.lav}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            isAnimationActive={!reduced}
            animationDuration={1300}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

const DEVICE_COLORS = [C.volt, C.lav, C.pink, C.door]

export function DeviceDonut({ data }: { data: Ranked[] }) {
  const reduced = useReducedMotion()
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  return (
    <div className="flex items-center gap-4">
      <div className="relative size-[132px] shrink-0" role="img" aria-label={data.map((d) => `${d.label} ${Math.round((d.value / total) * 100)}%`).join(', ')}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={38}
              outerRadius={62}
              stroke={C.ink}
              strokeWidth={3}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={!reduced}
              animationDuration={900}
            >
              {data.map((d, i) => (
                <Cell key={d.key} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <span className="pointer-events-none absolute inset-0 grid place-items-center font-display text-[22px] uppercase leading-none" aria-hidden="true">
          {Math.round(((data[0]?.value ?? 0) / total) * 100)}%
        </span>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {data.map((d, i) => (
          <li key={d.key} className="flex items-center gap-2 text-[13.5px]">
            <span className="size-3 shrink-0 border-2 border-ink" style={{ background: DEVICE_COLORS[i % DEVICE_COLORS.length] }} aria-hidden="true" />
            <span className="flex-1 capitalize">{d.label}</span>
            <span className="font-mono font-bold tabular-nums">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
