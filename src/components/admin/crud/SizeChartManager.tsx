'use client'
// Admin → Pricing → Size charts (settings 'size_charts', catalog.edit). One chart per fit (oversized / regular /
// baby tee / hoodie): rows of size → chest / length / shoulder in inches. Saved through saveSettingValue() (perm
// re-check, zod, stale-tab guard via expectedUpdatedAt) → product pages read it when a shopper opens "Size chart".
// Nothing is seeded. "Use typical … measurements" pre-fills the form with TYPICAL values, clearly labelled and
// never saved until the owner checks them and presses Save. Row delete = local, with undo (nothing is stored yet).
import { useId, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, RotateCcw, Ruler, Save, Trash2, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  MAX_SIZE_ROWS, SIZE_FITS, SIZE_ORDER, TYPICAL_SIZE_CHARTS, filledFits, toCm,
  type SizeChartRow, type SizeCharts, type SizeFit,
} from '@/components/shop/sizeChartData'
import { AdminPanel } from '../AdminPage'
import { useCan } from '../AdminContext'
import { adminBtn, adminInput, adminLabel, adminPill } from '../ui'
import { explainDemo, explainReadOnly, useCrudMode } from './data'
import { saveSettingValue } from './settingsActions'
import { sizeChartsSchema } from './settingsSchemas'

type Field = 'size' | 'chest' | 'length' | 'shoulder'
const clone = (c: SizeCharts): SizeCharts => JSON.parse(JSON.stringify(c)) as SizeCharts

function nextSize(rows: SizeChartRow[]): string {
  const used = new Set(rows.map((r) => r.size.toUpperCase()))
  const last = rows[rows.length - 1]?.size.toUpperCase()
  const from = last ? SIZE_ORDER.indexOf(last) + 1 : SIZE_ORDER.indexOf('S')
  return SIZE_ORDER.slice(Math.max(0, from)).find((s) => !used.has(s)) ?? SIZE_ORDER.find((s) => !used.has(s)) ?? ''
}

/** what gets saved: only fits with rows */
function toPayload(d: SizeCharts): SizeCharts {
  const charts: SizeCharts['charts'] = {}
  for (const f of SIZE_FITS) {
    const rows = d.charts[f.id]
    if (rows?.length) charts[f.id] = rows.map((r) => ({ size: r.size.trim(), chest: r.chest, length: r.length, shoulder: r.shoulder ?? null }))
  }
  return { charts, note: d.note.trim() }
}

export function SizeChartManager({ initial, initialUpdatedAt, index = 2 }: { initial: SizeCharts; initialUpdatedAt: string | null; index?: number }) {
  const mode = useCrudMode()
  const allowed = useCan('catalog.edit')
  const readOnly = mode === 'live' && !allowed
  const [saved, setSaved] = useState<SizeCharts>(initial)
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt)
  const [d, setD] = useState<SizeCharts>(() => clone(initial))
  const [fit, setFit] = useState<SizeFit>(() => filledFits(initial)[0] ?? 'oversized')
  const [typical, setTypical] = useState<Set<SizeFit>>(() => new Set())
  const [armTypical, setArmTypical] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState(false)
  const noteId = useId()

  const rows = d.charts[fit] ?? []
  const dirty = useMemo(() => JSON.stringify(toPayload(d)) !== JSON.stringify(toPayload(saved)), [d, saved])
  const liveFits = filledFits(saved)

  const setRows = (f: SizeFit, next: SizeChartRow[]) => {
    setD((x) => ({ ...x, charts: { ...x.charts, [f]: next } }))
    setErrors({})
  }
  const setCell = (i: number, k: Field, v: string) => {
    const next = rows.slice()
    const row = { ...next[i] }
    if (k === 'size') row.size = v.toUpperCase().slice(0, 8)
    else row[k] = v === '' ? null : Number(v)
    next[i] = row
    setRows(fit, next)
  }
  const addRow = () => {
    if (rows.length >= MAX_SIZE_ROWS) return toast(`At most ${MAX_SIZE_ROWS} sizes per chart`)
    setRows(fit, [...rows, { size: nextSize(rows), chest: null, length: null, shoulder: null }])
  }
  const removeRow = (i: number) => {
    const f = fit
    const gone = rows[i]
    const before = rows
    setRows(f, rows.filter((_, j) => j !== i))
    toast(`Removed ${gone.size || 'row'} from the ${SIZE_FITS.find((x) => x.id === f)?.label.toLowerCase()} chart`, {
      description: 'Not saved yet.',
      action: { label: 'Undo', onClick: () => setRows(f, before) },
    })
  }
  const fillTypical = () => {
    if (rows.length && !armTypical) {
      setArmTypical(true)
      return
    }
    setArmTypical(false)
    setRows(fit, TYPICAL_SIZE_CHARTS[fit].map((r) => ({ ...r })))
    setTypical((t) => new Set(t).add(fit))
    toast('Typical measurements filled in', { description: 'Measure your own blanks and correct every number before you press Save.' })
  }
  const resetAll = () => {
    setD(clone(saved))
    setTypical(new Set())
    setErrors({})
    setArmTypical(false)
  }

  const save = async () => {
    if (mode === 'demo') return explainDemo()
    if (readOnly) return explainReadOnly()
    const payload = toPayload(d)
    const parsed = sizeChartsSchema.safeParse(payload)
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      let firstFit: SizeFit | null = null
      for (const iss of parsed.error.issues) {
        const [, f, i, k] = iss.path as [string, SizeFit | undefined, number | undefined, Field | undefined]
        if (f && !firstFit) firstFit = f
        const key = f !== undefined && i !== undefined && k ? `${f}.${i}.${k}` : f ? `${f}` : 'note'
        if (!errs[key]) errs[key] = iss.message
      }
      setErrors(errs)
      if (firstFit && firstFit !== fit) setFit(firstFit)
      toast.error('Check the highlighted cells', { description: parsed.error.issues[0]?.message })
      return
    }
    if (mode === 'sandbox') {
      setSaved(clone(parsed.data as SizeCharts))
      setTypical(new Set())
      toast.success('Size charts saved', { description: 'Sandbox — local only, not stored.' })
      return
    }
    setSaving(true)
    const r = await saveSettingValue('size_charts', parsed.data, { expectedUpdatedAt: updatedAt }).catch((e: unknown) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : 'Network error — try again.',
      conflict: false,
    }))
    setSaving(false)
    if (!r.ok) {
      if (r.conflict) setConflict(true)
      toast.error('Size charts not saved', { description: r.error })
      return
    }
    const stored = r.value as SizeCharts
    setSaved(clone(stored))
    setD(clone(stored))
    setUpdatedAt(r.updatedAt)
    setTypical(new Set())
    setConflict(false)
    const n = filledFits(stored).length
    toast.success(n ? 'Size charts are live' : 'Size charts cleared', {
      description: n
        ? 'Product pages show them in the “Size chart” pop-up now.'
        : 'Product pages ask shoppers to share their usual size on WhatsApp instead.',
    })
  }

  const fitMeta = SIZE_FITS.find((f) => f.id === fit)!
  const isTypical = typical.has(fit)

  return (
    <AdminPanel
      index={index}
      id="size-charts"
      title={<>Size <em className="accent accent-pink">charts</em></>}
      jp="サイズ表"
      action={
        <span className="flex items-center gap-2">
          {dirty && <span className="label text-[10px] text-volt">● Unsaved</span>}
          <span className={adminPill(liveFits.length ? 'volt' : 'muted')}>{liveFits.length ? `${liveFits.length} live` : 'None live'}</span>
        </span>
      }
    >
      <p className="max-w-[70ch] text-[14px] leading-relaxed text-paper/65">
        Garment measurements in inches, laid flat: <b className="text-paper">chest</b> all the way round (armpit to armpit × 2),{' '}
        <b className="text-paper">length</b> from the top of the shoulder to the hem, <b className="text-paper">shoulder</b> seam to seam.
        Shoppers see the chart for the fit they picked, in inches or cm. A fit with no rows shows “Tell us your usual size on WhatsApp and
        we’ll match the fit” instead.
      </p>

      {conflict && (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 border-2 border-ink bg-hype p-3 text-paper">
          <p className="mr-auto text-[14px] font-semibold">Someone saved the size charts after you opened this page.</p>
          <button type="button" className={adminBtn({ variant: 'ghost', size: 'sm' })} onClick={() => location.reload()}>
            Reload their version
          </button>
        </div>
      )}

      {/* fit tabs */}
      <div role="tablist" aria-label="Fit" className="mt-5 flex flex-wrap gap-2">
        {SIZE_FITS.map((f) => {
          const n = d.charts[f.id]?.length ?? 0
          const on = f.id === fit
          const bad = Object.keys(errors).some((k) => k === f.id || k.startsWith(`${f.id}.`))
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => { setFit(f.id); setArmTypical(false) }}
              className={cn(
                'press inline-flex min-h-11 items-center gap-2 border-2 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em] focus-ring transition-colors duration-150',
                on ? 'border-ink bg-volt text-ink shadow-[3px_3px_0_var(--color-door)]' : 'border-paper/20 text-paper/75 can-hover:hover:border-paper/50',
                bad && !on && 'border-hype text-hype',
              )}
            >
              {f.short}
              <span className={cn('px-1.5 py-0.5 text-[10px] tabular-nums', on ? 'bg-ink text-volt' : n ? 'bg-paper/10' : 'text-paper/40')}>{n || '—'}</span>
              {typical.has(f.id) && <span className="text-[9px] text-hype">TYPICAL</span>}
            </button>
          )
        })}
      </div>

      <div className="mt-4 border-2 border-paper/15 p-3 sm:p-4" role="tabpanel" aria-label={fitMeta.label}>
        {isTypical && (
          <p role="note" className="mb-3 border-2 border-hype bg-hype/10 px-3 py-2 text-[13px] font-semibold leading-snug text-paper">
            These are TYPICAL {fitMeta.label.toLowerCase()} measurements, not yours. Measure your own blanks and correct every number
            before you press Save — shoppers will order by them.
          </p>
        )}
        {errors[fit] && <p role="alert" className="mb-3 text-[13px] font-medium text-hype">{errors[fit]}</p>}

        {rows.length === 0 ? (
          <div className="grid place-items-center gap-3 border-2 border-dashed border-paper/20 px-4 py-8 text-center">
            <Ruler aria-hidden="true" className="size-6 text-paper/40" />
            <p className="max-w-[46ch] text-[14px] text-paper/65">
              No {fitMeta.label.toLowerCase()} chart yet. Shoppers are asked to tell you their usual size on WhatsApp.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto" data-lenis-prevent-horizontal>
            <table className="w-full min-w-[420px] border-collapse text-left">
              <caption className="sr-only">{fitMeta.label} size chart (inches)</caption>
              <thead>
                <tr className="font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-paper/55">
                  <th scope="col" className="w-[84px] pb-2 pr-2">Size</th>
                  <th scope="col" className="pb-2 pr-2">Chest in</th>
                  <th scope="col" className="pb-2 pr-2">Length in</th>
                  <th scope="col" className="pb-2 pr-2">Shoulder in</th>
                  <th scope="col" className="w-11 pb-2"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="align-top">
                    {(['size', 'chest', 'length', 'shoulder'] as const).map((k) => {
                      const err = errors[`${fit}.${i}.${k}`]
                      const v = r[k]
                      return (
                        <td key={k} className="pb-2 pr-2">
                          <input
                            aria-label={`${r.size || `Row ${i + 1}`} ${k}${k === 'size' ? '' : ' (inches)'}`}
                            aria-invalid={!!err}
                            title={err}
                            type={k === 'size' ? 'text' : 'number'}
                            inputMode={k === 'size' ? 'text' : 'decimal'}
                            step={k === 'size' ? undefined : 0.25}
                            min={k === 'size' ? undefined : 0}
                            placeholder={k === 'size' ? 'M' : k === 'shoulder' ? 'optional' : '—'}
                            value={v === null || v === undefined ? '' : String(v)}
                            onChange={(e) => setCell(i, k, e.target.value)}
                            className={cn(adminInput, 'min-h-11 px-2 font-mono text-[14px] tabular-nums', err && 'border-hype')}
                          />
                          {k !== 'size' && typeof v === 'number' && v > 0 && (
                            <span className="mt-0.5 block font-mono text-[10.5px] text-paper/35 tabular-nums">{toCm(v)} cm</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="pb-2">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        aria-label={`Remove ${r.size || `row ${i + 1}`}`}
                        className="grid size-11 place-items-center text-paper/55 focus-ring transition-colors duration-150 can-hover:hover:bg-hype/15 can-hover:hover:text-hype"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={addRow} disabled={rows.length >= MAX_SIZE_ROWS} className={adminBtn({ variant: 'ghost', size: 'sm' })}>
            <Plus aria-hidden className="size-4" /> Add size
          </button>
          <button
            type="button"
            onClick={fillTypical}
            className={adminBtn({ variant: armTypical ? 'door' : 'quiet', size: 'sm' })}
            title="Fills the form only — nothing is saved until you press Save"
          >
            <Wand2 aria-hidden className="size-4" />
            {armTypical ? `Replace ${rows.length} row${rows.length === 1 ? '' : 's'} with typical values?` : `Use typical ${fitMeta.short.toLowerCase()} measurements as a starting point`}
          </button>
          {rows.length > 0 && (
            <button type="button" onClick={() => setRows(fit, [])} className={adminBtn({ variant: 'quiet', size: 'sm' })}>
              Clear this chart
            </button>
          )}
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor={noteId} className={adminLabel}>Note under every chart (optional)</label>
        <input
          id={noteId}
          value={d.note}
          maxLength={300}
          onChange={(e) => { setD((x) => ({ ...x, note: e.target.value })); setErrors({}) }}
          placeholder="e.g. Measured laid flat, ±0.5 in. Oversized tees are cut roomy on purpose."
          aria-invalid={!!errors.note}
          className={adminInput}
        />
        {errors.note && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-hype">{errors.note}</p>}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t-2 border-paper/10 pt-4">
        <button type="button" onClick={() => void save()} disabled={saving || !dirty || readOnly} className={adminBtn({ variant: 'primary' })} title={readOnly ? 'View only' : !dirty ? 'No changes to save' : 'Save — product pages show it at once'}>
          {saving ? <span className="inline-block size-3.5 animate-spin border-2 border-ink border-t-transparent" aria-hidden /> : <Save aria-hidden className="size-4" />}
          {saving ? 'Saving…' : 'Save size charts'}
        </button>
        {dirty && (
          <button type="button" onClick={resetAll} className={adminBtn({ variant: 'quiet' })}>
            <RotateCcw aria-hidden className="size-4" /> Undo changes
          </button>
        )}
        <span className="text-[12px] text-paper/45">
          {updatedAt ? `Last saved ${new Date(updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })}` : 'Never saved — no chart is live yet.'}
        </span>
      </div>
    </AdminPanel>
  )
}
