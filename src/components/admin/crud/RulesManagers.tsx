'use client'
// Pricing rules CRUD: Deals (bundle_rules), Custom rules (custom_rules + settings 'apparel_custom') and
// Pricing (settings 'hoodie_tiers' + 'tee_fits'). Add = "New …", Edit = row → drawer, Delete = shredder
// (superadmin only; everyone else sees the lock). Writes revalidate 'rules' / 'settings' → live straight away.
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { toast } from 'sonner'
import type { HoodieTier, ProductType, TeeFit } from '@/lib/types'
import { formatINR } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import { AdminPage, AdminPanel } from '../AdminPage'
import { adminBtn, adminPill } from '../ui'
import { useCrud } from './data'
import { PRODUCT_TYPES, bundleRuleCfg, customRuleCfg, type AdminBundleRule, type AdminCustomRule } from './entities'
import { EntityManager } from './EntityManager'
import { Chips, FormSection, NumberField, SandboxSwitch, SelectField, StateSwitch, TextArea, TextField, Toggle, issuesToErrors } from './kit'
import { useSettingList, useSettingObject } from './settingsData'
import { apparelCustomSchema, hoodieTierSchema, teeFitSchema } from './settingsSchemas'
import type { ApparelCustomRules } from '@/lib/types'
import { newId, slugify } from './util'

const TYPE_OPTS = PRODUCT_TYPES.map((t) => ({ id: t, label: t }))
const slugRe = /^[a-z0-9]+(-[a-z0-9]+)*$/

// ================================================================ deals (bundle_rules)
/** unit price lookup: "type" or "type|attrKey|attrValue" → most common variant price in the shop */
export type UnitPrices = Record<string, number>
export type AttrOptions = Record<string, Array<[string, string]>>

const NOUN: Partial<Record<ProductType, string>> = { polaroid: 'polaroids', poster: 'posters', bookmark: 'bookmarks', badge: 'badges', sticker: 'stickers', keychain: 'keychains' }
const noun = (r: AdminBundleRule) => `${r.appliesTo.variantAttr?.[1] ? `${r.appliesTo.variantAttr[1]} ` : ''}${NOUN[r.appliesTo.type] ?? `${r.appliesTo.type}s`}`

function unitFor(r: AdminBundleRule, prices: UnitPrices): number | null {
  const a = r.appliesTo.variantAttr
  if (a?.[0] && a[1]) return prices[`${r.appliesTo.type}|${a[0]}|${a[1]}`] ?? prices[r.appliesTo.type] ?? null
  return prices[r.appliesTo.type] ?? null
}

/** "3 for ₹100 — saves ₹50 vs 3×₹50" */
export function dealPreview(r: AdminBundleRule, prices: UnitPrices): { short: string; line: string; saving: number | null } {
  const unit = unitFor(r, prices)
  if (r.kind === 'nForPrice') {
    const short = `${r.n} for ${r.price != null ? formatINR(r.price) : '₹?'}`
    if (unit == null || r.price == null) return { short, line: `${short} — no priced ${noun(r)} in the shop to compare with`, saving: null }
    const saving = r.n * unit - r.price
    return {
      short,
      saving,
      line: saving > 0 ? `${short} — saves ${formatINR(saving)} vs ${r.n}×${formatINR(unit)}` : `${short} — no saving vs ${r.n}×${formatINR(unit)} (check the price)`,
    }
  }
  const free = r.free ?? 1
  const short = `Buy ${r.n}, get ${free} free`
  if (unit == null) return { short, line: `${short} — no priced ${noun(r)} in the shop to compare with`, saving: null }
  return { short, saving: free * unit, line: `${short} — ${r.n + free} ${noun(r)} for ${formatINR(r.n * unit)}, saves ${formatINR(free * unit)} vs ${r.n + free}×${formatINR(unit)}` }
}

function suggestLabel(r: AdminBundleRule): string {
  return r.kind === 'nForPrice'
    ? `${r.n} ${noun(r)} for ${r.price != null ? formatINR(r.price) : '₹…'}`
    : `${(NOUN[r.appliesTo.type] ?? `${r.appliesTo.type}s`).replace(/^./, (c) => c.toUpperCase())}: buy ${r.n}, get ${r.free ?? 1} free`
}

const dealSchema = z
  .object({
    id: z.string().regex(slugRe, 'lowercase-with-dashes').max(60),
    label: z.string().trim().min(2, 'Shown on cards, cart and the fests page').max(80),
    n: z.number({ error: 'How many' }).int().min(1, 'At least 1').max(999),
    kind: z.enum(['nForPrice', 'buyXgetY']),
    price: z.number().int().min(0).optional(),
    free: z.number().int().min(1).optional(),
    appliesTo: z.object({ type: z.string().min(1), variantAttr: z.tuple([z.string(), z.string()]).optional() }),
  })
  .refine((r) => r.kind !== 'nForPrice' || r.price != null, { message: 'Bundle price', path: ['price'] })
  .refine((r) => r.kind !== 'buyXgetY' || r.free != null, { message: 'How many free', path: ['free'] })
  .refine((r) => !r.appliesTo.variantAttr || (!!r.appliesTo.variantAttr[0].trim() === !!r.appliesTo.variantAttr[1].trim()), { message: 'Fill both key and value (or neither)', path: ['attr'] })

/** drop a half-empty variant filter, trim it */
function normalizeDeal(r: AdminBundleRule): AdminBundleRule {
  const a = r.appliesTo.variantAttr
  const k = a?.[0]?.trim() ?? '', v = a?.[1]?.trim() ?? ''
  return { ...r, label: r.label.trim(), appliesTo: { type: r.appliesTo.type, ...(k && v ? { variantAttr: [k, v] as [string, string] } : {}) } }
}

export function DealsManager({ initial, unitPrices, attrOptions }: { initial: AdminBundleRule[]; unitPrices: UnitPrices; attrOptions: AttrOptions }) {
  const crud = useCrud(bundleRuleCfg, initial, { perm: 'catalog.edit' })
  const active = crud.rows.filter((r) => r.active).length
  return (
    <AdminPage
      no="08"
      kicker={`Catalogue · ${active} live deal${active === 1 ? '' : 's'}`}
      title={<>Bundle <em>deals</em></>}
      jp="お得 · まとめ買い"
      description="Pack prices the cart applies automatically — “3 polaroids for ₹100”, “posters: buy 5, get 1 free”. Saves show on product cards, the cart and the fests page straight away."
      actions={<SandboxSwitch mode={crud.mode} readOnly={crud.readOnly} />}
    >
      <EntityManager<AdminBundleRule>
        crud={{ ...crud, save: (item, opts) => crud.save(normalizeDeal(item), opts) }}
        caption="Deals"
        noun="deal"
        jp="お得編集"
        searchText={(r) => `${r.label} ${r.id} ${r.appliesTo.type} ${r.appliesTo.variantAttr?.join(' ') ?? ''}`}
        blank={() => ({ id: '', label: '', appliesTo: { type: 'polaroid' }, kind: 'nForPrice', n: 3, price: 100, active: true })}
        schema={dealSchema}
        emptyBody="No deals: every piece sells at its own price. Add a pack price to nudge bigger carts."
        columns={[
          { id: 'label', header: 'Deal', sortValue: (r) => r.label, cell: (r) => <span className="block leading-tight"><span className="font-semibold">{r.label}</span><span className="block font-mono text-[11px] text-paper/50">{r.id}</span></span> },
          { id: 'applies', header: 'Applies to', cell: (r) => <span className="font-mono text-[12px]">{r.appliesTo.type}{r.appliesTo.variantAttr ? ` · ${r.appliesTo.variantAttr[0]}=${r.appliesTo.variantAttr[1]}` : ''}</span> },
          { id: 'rule', header: 'Maths', hideOnMobile: true, cell: (r) => { const p = dealPreview(r, unitPrices); return <span className="block text-[12.5px] leading-snug"><span className="font-mono font-bold">{p.short}</span>{p.saving != null && p.saving > 0 && <span className="block text-volt">saves {formatINR(p.saving)}</span>}</span> } },
          { id: 'st', header: 'State', cell: (r) => <span className={adminPill(r.active ? 'volt' : 'muted')}>{r.active ? 'Live' : 'Off'}</span> },
        ]}
        form={(r, set, e, isNew) => {
          const attr = r.appliesTo.variantAttr ?? ['', '']
          const setAttr = (i: 0 | 1, v: string) => {
            const next: [string, string] = [attr[0], attr[1]]
            next[i] = v
            set({ appliesTo: { ...r.appliesTo, variantAttr: next } })
          }
          const opts = attrOptions[r.appliesTo.type] ?? []
          const preview = dealPreview(normalizeDeal(r), unitPrices)
          const withId = (patch: Partial<AdminBundleRule>) => {
            const next = { ...r, ...patch }
            return isNew ? { ...patch, id: slugify(`${next.appliesTo.type}-${next.kind === 'nForPrice' ? `${next.n}for${next.price ?? ''}` : `buy${next.n}get${next.free ?? 1}`}${next.appliesTo.variantAttr?.[1] ? `-${next.appliesTo.variantAttr[1]}` : ''}`) } : patch
          }
          return (
            <>
              <div className="mb-6 border-4 border-ink bg-volt p-4 text-ink shadow-[6px_6px_0_var(--color-door)]" aria-live="polite">
                <p className="label text-[10px] text-ink/60">Live preview · what the cart does</p>
                <p className="mt-1 font-display text-[26px] uppercase leading-[0.95]">{r.label || suggestLabel(normalizeDeal(r))}</p>
                <p className="mt-2 font-mono text-[13px] font-bold">{preview.line}</p>
              </div>
              <FormSection title="Rule" jp="ルール">
                <SelectField label="Applies to (product type)" value={r.appliesTo.type} onChange={(type) => set(withId({ appliesTo: { type, ...(r.appliesTo.variantAttr ? { variantAttr: r.appliesTo.variantAttr } : {}) } }))} options={TYPE_OPTS} />
                <div className="min-w-0">
                  <p className="label mb-1.5 block text-paper/70">Kind</p>
                  <Chips label="Deal kind" value={r.kind} onChange={(kind) => set(withId({ kind, ...(kind === 'nForPrice' ? { price: r.price ?? 100 } : { free: r.free ?? 1 }) }))} options={[{ id: 'nForPrice', label: 'N for ₹' }, { id: 'buyXgetY', label: 'Buy X get Y' }]} />
                </div>
                <NumberField label={r.kind === 'nForPrice' ? 'Pieces in the pack (N)' : 'Buy (X)'} min={1} value={r.n} error={e.n} onChange={(n) => set(withId({ n: n ?? 1 }))} />
                {r.kind === 'nForPrice' ? (
                  <NumberField label="Pack price ₹" value={r.price ?? null} error={e.price} onChange={(price) => set(withId({ price: price ?? undefined }))} />
                ) : (
                  <NumberField label="Free (Y)" min={1} value={r.free ?? null} error={e.free} onChange={(free) => set(withId({ free: free ?? undefined }))} />
                )}
                <TextField label="Variant key (optional)" mono value={attr[0]} error={e.attr} placeholder="kind" onChange={(v) => setAttr(0, v)} hint="Only lines whose variant has this attribute count." />
                <TextField label="Variant value" mono value={attr[1]} placeholder="magnetic" onChange={(v) => setAttr(1, v)} />
                {opts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2">
                    <span className="label text-[10px] text-paper/50">In the shop:</span>
                    {opts.map(([k, v]) => (
                      <button key={`${k}=${v}`} type="button" onClick={() => set(withId({ appliesTo: { ...r.appliesTo, variantAttr: [k, v] } }))} className={cn('min-h-9 border-2 px-2 font-mono text-[11px] focus-ring', attr[0] === k && attr[1] === v ? 'border-ink bg-lav text-ink' : 'border-paper/20 text-paper/70 can-hover:hover:border-paper/60')}>{k}={v}</button>
                    ))}
                    {r.appliesTo.variantAttr && <button type="button" onClick={() => set({ appliesTo: { type: r.appliesTo.type } })} className="min-h-9 px-2 font-mono text-[11px] text-paper/50 focus-ring can-hover:hover:text-hype">clear</button>}
                  </div>
                )}
              </FormSection>
              <FormSection title="Shown as" jp="表示">
                <div className="sm:col-span-2">
                  <TextField label="Label" value={r.label} error={e.label} maxLength={80} onChange={(label) => set({ label })} placeholder={suggestLabel(normalizeDeal(r))} />
                  <button type="button" onClick={() => set({ label: suggestLabel(normalizeDeal(r)) })} className={adminBtn({ variant: 'ghost', size: 'sm', className: 'mt-2' })}>Use “{suggestLabel(normalizeDeal(r))}”</button>
                </div>
                <TextField label="Deal id" mono value={r.id} error={e.id} hint={isNew ? 'Products link to this id (Products → Bundle deal).' : 'Locked — products link to it.'} onChange={(id) => isNew && set({ id: slugify(id) })} />
                <Toggle label="Live" hint="Off = kept here but the cart stops applying it" checked={r.active} onChange={(active) => set({ active })} tone="door" />
              </FormSection>
            </>
          )
        }}
      />
    </AdminPage>
  )
}

// ================================================================ custom rules (custom_rules + apparel_custom)
const customSchema = z.object({
  type: z.string().min(1, 'Pick a type'),
  minQty: z.number({ error: 'Minimum quantity' }).int().min(1, 'At least 1').max(100000),
  unitPrice: z.number().int().min(0).nullable(),
  note: z.string().max(600),
})

export function CustomRulesManager({ initial, apparel }: { initial: AdminCustomRule[]; apparel: ApparelCustomRules }) {
  const crud = useCrud(customRuleCfg, initial, { perm: 'catalog.edit' })
  const used = new Set(crud.rows.map((r) => r.type))
  return (
    <AdminPage
      no="09"
      kicker={`Catalogue · ${crud.rows.length} custom rules`}
      title={<>Custom <em>rules</em></>}
      jp="特注 · ルール"
      description="Minimums and per-piece prices the Forge (/custom) quotes with, plus the apparel extras. Saves are live on /custom, /fests and the home Forge teaser straight away."
      actions={<SandboxSwitch mode={crud.mode} readOnly={crud.readOnly} />}
    >
      <AdminPanel index={0} title={<>Minimums &amp; <em className="accent">prices</em></>} jp="最低数量">
        <EntityManager<AdminCustomRule>
          crud={crud}
          caption="Custom rules"
          noun="rule"
          jp="特注編集"
          searchText={(r) => `${r.type} ${r.note}`}
          blank={() => ({ type: PRODUCT_TYPES.find((t) => !used.has(t)) ?? 'accessory', minQty: 1, unitPrice: null, note: '' })}
          schema={customSchema}
          emptyBody="No rules: the Forge quotes every custom piece “on WhatsApp”."
          columns={[
            { id: 'type', header: 'Type', sortValue: (r) => r.type, cell: (r) => <span className="font-mono text-[13px] font-bold">{r.type}</span> },
            { id: 'min', header: 'Min qty', align: 'right', sortValue: (r) => r.minQty, cell: (r) => <span className="font-mono tabular-nums">{r.minQty}</span> },
            { id: 'price', header: 'Per piece', align: 'right', sortValue: (r) => r.unitPrice ?? -1, cell: (r) => <span className="font-mono tabular-nums">{r.unitPrice != null ? formatINR(r.unitPrice) : 'by cloth'}</span> },
            { id: 'note', header: 'Note', hideOnMobile: true, cell: (r) => <span className="line-clamp-2 text-[12.5px] text-paper/65">{r.note || '—'}</span> },
          ]}
          form={(r, set, e, isNew) => (
            <FormSection title="Rule" jp="ルール">
              {isNew ? (
                <SelectField label="Product type" value={r.type} error={e.type} onChange={(type) => set({ type })} options={PRODUCT_TYPES.filter((t) => !used.has(t) || t === r.type).map((t) => ({ id: t, label: t }))} />
              ) : (
                <TextField label="Product type" mono value={r.type} hint="Locked — one rule per type." onChange={() => {}} />
              )}
              <NumberField label="Minimum quantity" min={1} value={r.minQty} error={e.minQty} onChange={(minQty) => set({ minQty: minQty ?? 1 })} />
              <NumberField label="Price per piece ₹" value={r.unitPrice} error={e.unitPrice} placeholder="empty = depends on cloth" onChange={(unitPrice) => set({ unitPrice })} />
              <div className="self-end border-2 border-paper/15 p-3 font-mono text-[12.5px] text-paper/75" aria-live="polite">
                {r.unitPrice != null ? <>Smallest order: {r.minQty} × {formatINR(r.unitPrice)} = <span className="font-bold text-volt">{formatINR(r.minQty * r.unitPrice)}</span></> : 'Quoted on WhatsApp (garment + print).'}
              </div>
              <TextArea className="sm:col-span-2" label="Note (shown with the quote)" rows={3} maxLength={600} value={r.note} error={e.note} onChange={(note) => set({ note })} />
            </FormSection>
          )}
        />
      </AdminPanel>
      <ApparelForm initial={apparel} />
    </AdminPage>
  )
}

function ApparelForm({ initial }: { initial: ApparelCustomRules }) {
  const obj = useSettingObject<ApparelCustomRules>('apparel_custom', initial, 'catalog.edit')
  const [d, setD] = useState<ApparelCustomRules>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  // pick up the stored value once it loads (until the owner starts typing)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync the form with the loaded setting
    if (!dirty) setD(obj.value)
  }, [obj.value, dirty])
  const set = (p: Partial<ApparelCustomRules>) => { setD((x) => ({ ...x, ...p })); setDirty(true) }
  const zone = (side: 'front' | 'back', k: 'w' | 'h', v: number | null) => set({ zones: { ...d.zones, [side]: { ...d.zones[side], [k]: v ?? 0 } } })
  const save = async () => {
    const r = apparelCustomSchema.safeParse(d)
    if (!r.success) return setErrors(issuesToErrors(r.error.issues))
    setErrors({})
    setSaving(true)
    const ok = await obj.save(d)
    setSaving(false)
    if (ok) {
      setDirty(false)
      toast.success('Apparel extras saved', { description: obj.mode === 'sandbox' ? 'Sandbox — local only.' : 'Live on /custom now.' })
    }
  }
  return (
    <AdminPanel index={1} title={<>Apparel <em className="accent accent-lav">extras</em></>} jp="アパレル" action={
      <span className="flex items-center gap-2">
        {dirty && <span className="label text-[10px] text-volt">● Unsaved</span>}
        <button type="button" onClick={save} disabled={saving || obj.readOnly || obj.status !== 'ready'} className={adminBtn({ size: 'sm', className: 'min-h-10' })}>{saving ? 'Saving…' : 'Save extras'}</button>
      </span>
    }>
      <StateSwitch status={obj.status} error={obj.error} onRetry={obj.reload} rows={3}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Company design fee ₹" value={d.companyDesignFee} error={errors.companyDesignFee} onChange={(v) => set({ companyDesignFee: v ?? 0 })} hint="When we design it for the customer." />
            <NumberField label="Half-n-half fee ₹" value={d.halfHalfFee} error={errors.halfHalfFee} onChange={(v) => set({ halfHalfFee: v ?? 0 })} hint="Two designs split down the middle." />
            <NumberField label="Front zone width (in)" value={d.zones.front.w} error={errors['zones.front.w']} onChange={(v) => zone('front', 'w', v)} />
            <NumberField label="Front zone height (in)" value={d.zones.front.h} error={errors['zones.front.h']} onChange={(v) => zone('front', 'h', v)} />
            <NumberField label="Back zone width (in)" value={d.zones.back.w} error={errors['zones.back.w']} onChange={(v) => zone('back', 'w', v)} />
            <NumberField label="Back zone height (in)" value={d.zones.back.h} error={errors['zones.back.h']} onChange={(v) => zone('back', 'h', v)} />
            <TextArea className="sm:col-span-2" label="Note" rows={3} maxLength={600} value={d.note} error={errors.note} onChange={(note) => set({ note })} />
          </div>
          <div className="border-4 border-ink bg-paper p-4 text-ink shadow-[6px_6px_0_var(--color-door)]">
            <p className="label text-[10px] text-ink/55">Print zones</p>
            <div className="mt-3 flex items-end justify-center gap-6">
              {(['front', 'back'] as const).map((s) => {
                const z = d.zones[s]
                const max = Math.max(d.zones.front.w, d.zones.front.h, d.zones.back.w, d.zones.back.h, 1)
                return (
                  <div key={s} className="text-center">
                    <div className="mx-auto border-[3px] border-dashed border-door bg-door/10" style={{ width: `${Math.max(12, (z.w / max) * 96)}px`, height: `${Math.max(12, (z.h / max) * 120)}px` }} />
                    <p className="mt-1.5 font-mono text-[11px] font-bold uppercase">{s} {z.w}×{z.h} in</p>
                  </div>
                )
              })}
            </div>
            <p className="mt-4 font-mono text-[12px]">Design fee {formatINR(d.companyDesignFee)} · half-n-half {formatINR(d.halfHalfFee)}</p>
          </div>
        </div>
      </StateSwitch>
    </AdminPanel>
  )
}

// ================================================================ pricing (hoodie tiers + tee fits)
export function PricingManager({ tiers, fits }: { tiers: HoodieTier[]; fits: TeeFit[] }) {
  const t = useSettingList<HoodieTier>('hoodie_tiers', tiers, { perm: 'catalog.edit', label: (x) => `${x.code} ${x.name}` })
  const f = useSettingList<TeeFit>('tee_fits', fits, { perm: 'catalog.edit', label: (x) => x.label })
  return (
    <AdminPage
      no="10"
      kicker="Catalogue · garment prices"
      title={<>Garment <em>pricing</em></>}
      jp="価格 · GSM · フィット"
      description="Hoodie GSM tiers (the home “power levels”, /custom and /fests) and tee fits. Order here is the order on the site. An empty list falls back to the built-in defaults."
      actions={<SandboxSwitch mode={t.mode} readOnly={t.readOnly} />}
    >
      <AdminPanel index={0} title={<>Hoodie <em className="accent">GSM tiers</em></>} jp="パワーレベル">
        <EntityManager<HoodieTier>
          crud={t}
          caption="Hoodie tiers"
          noun="tier"
          jp="GSM編集"
          reorderable
          searchText={(x) => `${x.code} ${x.name} ${x.gsmLabel}`}
          blank={() => {
            const last = t.rows[t.rows.length - 1]
            const lv = (last?.level ?? 0) + 1
            const min = last?.gsmMax ?? 280
            return { id: newId('gsm-'), level: lv, code: `LV.${lv}`, name: '', gsmMin: min, gsmMax: min + 50, gsmLabel: `${min}–${min + 50} GSM`, price: (last?.price ?? 1200) + 300, feel: '' }
          }}
          schema={hoodieTierSchema}
          columns={[
            { id: 'code', header: 'Level', cell: (x) => <span className="font-mono text-[13px] font-bold text-volt">{x.code}</span> },
            { id: 'name', header: 'Tier', cell: (x) => <span className="block leading-tight"><span className="font-semibold">{x.name}</span><span className="block font-mono text-[11px] text-paper/50">{x.gsmLabel}</span></span> },
            { id: 'price', header: 'Price', align: 'right', cell: (x) => <span className="font-mono font-bold tabular-nums">{formatINR(x.price)}</span> },
          ]}
          form={(x, set, e) => {
            const gsm = (p: Partial<HoodieTier>) => {
              const n = { ...x, ...p }
              // keep the label in step while it still reads like the auto label
              set(x.gsmLabel === `${x.gsmMin}–${x.gsmMax} GSM` ? { ...p, gsmLabel: `${n.gsmMin}–${n.gsmMax} GSM` } : p)
            }
            return (
              <FormSection title="Tier" jp="レベル">
                <TextField label="Name" value={x.name} error={e.name} onChange={(name) => set({ name })} placeholder="Heavyweight" />
                <TextField label="Code" mono value={x.code} error={e.code} onChange={(code) => set({ code })} placeholder="LV.3" />
                <NumberField label="Level" min={1} value={x.level} error={e.level} onChange={(v) => set({ level: v ?? 1, code: x.code === `LV.${x.level}` ? `LV.${v ?? 1}` : x.code })} />
                <NumberField label="Price ₹" value={x.price} error={e.price} onChange={(v) => set({ price: v ?? 0 })} />
                <NumberField label="GSM from" value={x.gsmMin} error={e.gsmMin} onChange={(v) => gsm({ gsmMin: v ?? 0 })} />
                <NumberField label="GSM to" value={x.gsmMax} error={e.gsmMax} onChange={(v) => gsm({ gsmMax: v ?? 0 })} />
                <TextField className="sm:col-span-2" label="GSM label (shown)" value={x.gsmLabel} error={e.gsmLabel} onChange={(gsmLabel) => set({ gsmLabel })} />
                <TextArea className="sm:col-span-2" label="How it feels" rows={3} maxLength={300} value={x.feel} error={e.feel} onChange={(feel) => set({ feel })} />
              </FormSection>
            )
          }}
        />
      </AdminPanel>
      <AdminPanel index={1} title={<>Tee <em className="accent accent-lav">fits</em></>} jp="フィット">
        <EntityManager<TeeFit>
          crud={f}
          caption="Tee fits"
          noun="fit"
          jp="フィット編集"
          reorderable
          searchText={(x) => `${x.label} ${x.id}`}
          blank={() => ({ id: '' as TeeFit['id'], label: '', price: 600, blurb: '' })}
          schema={teeFitSchema}
          columns={[
            { id: 'label', header: 'Fit', cell: (x) => <span className="block leading-tight"><span className="font-semibold">{x.label}</span><span className="block font-mono text-[11px] text-paper/50">{x.id}</span></span> },
            { id: 'blurb', header: 'Blurb', hideOnMobile: true, cell: (x) => <span className="line-clamp-2 text-[12.5px] text-paper/65">{x.blurb || '—'}</span> },
            { id: 'price', header: 'Price', align: 'right', cell: (x) => <span className="font-mono font-bold tabular-nums">{formatINR(x.price)}</span> },
          ]}
          form={(x, set, e, isNew) => (
            <FormSection title="Fit" jp="フィット">
              <TextField label="Label" value={x.label} error={e.label} onChange={(label) => set(isNew ? { label, id: slugify(label) as TeeFit['id'] } : { label })} placeholder="Oversized" />
              <NumberField label="Price ₹" value={x.price} error={e.price} onChange={(v) => set({ price: v ?? 0 })} />
              <TextField label="Fit id" mono value={x.id} error={e.id} hint={isNew ? '“oversized”, “regular” and “baby” are the ids the shop knows.' : 'Locked — the Forge and shop look fits up by id.'} onChange={(id) => isNew && set({ id: slugify(id) as TeeFit['id'] })} />
              <TextArea className="sm:col-span-2" label="Blurb" rows={2} maxLength={200} value={x.blurb} error={e.blurb} onChange={(blurb) => set({ blurb })} />
            </FormSection>
          )}
        />
      </AdminPanel>
    </AdminPage>
  )
}
