'use client'
// Admin → Vouchers (07). Owner: CHECKOUT.
// CRUD over public.vouchers under RLS (vouchers.edit): "Generate code" (TED-JJK-7K2Q), copy, active toggle,
// assign to one customer's email, limits, dates, product type. Usage = real rows from voucher_redemptions
// (count + total discount). Delete = superadmin only (deleteRows). Plus "Checkout settings": gift-wrap fee.
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { toast } from 'sonner'
import { Copy, Mail, Sparkles, Wand2 } from 'lucide-react'
import { formatINR } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import { generateVoucherCode } from '@/lib/checkout/voucher'
import { VOUCHER_CODE_RE } from '@/lib/checkout/schema'
import { voucherFromRow, voucherHeadline, voucherToRow, type Voucher } from '@/lib/checkout/types'
import type { CheckoutSettings } from '@/lib/checkout/server'
import { AdminPage, AdminPanel } from '../AdminPage'
import { StatCard } from '../StatCard'
import { adminBtn, adminInput, adminPill } from '../ui'
import { READONLY_NOTE, useCan } from '../AdminContext'
import { getAdminClient, useCrud, type CrudConfig } from '../crud/data'
import { EntityManager } from '../crud/EntityManager'
import { PRODUCT_TYPES } from '../crud/entities'
import { Chips, Field, FormSection, NumberField, SandboxSwitch, SelectField, TextField, Toggle } from '../crud/kit'
import { saveCheckoutSettings } from './actions'

const voucherCfg: CrudConfig<Voucher> = {
  table: 'vouchers',
  pk: 'id',
  order: { column: 'created_at', ascending: false },
  label: (v) => v.code || 'voucher',
  fromRow: voucherFromRow,
  toRow: voucherToRow,
}

const newUuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16))

const blankVoucher = (): Voucher => ({
  id: newUuid(),
  code: generateVoucherCode(),
  description: '',
  type: 'percent',
  value: 10,
  minOrder: 0,
  maxDiscount: null,
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  perUserLimit: 1,
  assignedEmail: null,
  appliesToType: null,
  active: true,
  createdAt: new Date().toISOString(),
})

const schema = z
  .object({
    code: z.string().trim().toUpperCase().regex(VOUCHER_CODE_RE, '3–32 letters, numbers or dashes (e.g. TED-JJK-7K2Q)'),
    description: z.string().max(200, 'Keep it under 200 characters'),
    type: z.enum(['percent', 'flat']),
    value: z.number({ error: 'How much off?' }).int('Whole numbers only').min(1, 'At least 1'),
    minOrder: z.number().int().min(0),
    maxDiscount: z.number().int().min(1).nullable(),
    usageLimit: z.number().int().min(1, 'At least 1 (or leave empty for unlimited)').nullable(),
    perUserLimit: z.number().int().min(1, 'At least 1 (or leave empty for unlimited)').nullable(),
    assignedEmail: z.union([z.email('Not an email address'), z.literal(''), z.null()]),
    startsAt: z.string().nullable(),
    endsAt: z.string().nullable(),
  })
  .refine((v) => v.type !== 'percent' || v.value <= 100, { message: 'A percentage can’t go over 100', path: ['value'] })
  .refine((v) => !v.startsAt || !v.endsAt || new Date(v.endsAt) > new Date(v.startsAt), { message: 'Ends after it starts', path: ['endsAt'] })

/** <input type="datetime-local"> ↔ ISO */
const toLocal = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null)

type Usage = { count: number; amount: number; last: string | null }
type State = 'live' | 'paused' | 'scheduled' | 'expired' | 'used-up'

function stateOf(v: Voucher, u: Usage | undefined, now: number): State {
  if (!v.active) return 'paused'
  if (v.endsAt && now >= Date.parse(v.endsAt)) return 'expired'
  if (v.startsAt && now < Date.parse(v.startsAt)) return 'scheduled'
  if (v.usageLimit != null && (u?.count ?? 0) >= v.usageLimit) return 'used-up'
  return 'live'
}
const STATE_PILL: Record<State, { label: string; tone: Parameters<typeof adminPill>[0] }> = {
  live: { label: 'Live', tone: 'volt' },
  paused: { label: 'Paused', tone: 'muted' },
  scheduled: { label: 'Scheduled', tone: 'lav' },
  expired: { label: 'Expired', tone: 'muted' },
  'used-up': { label: 'Used up', tone: 'pink' },
}

async function copy(text: string, what = 'Code') {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copied`, { description: text })
  } catch {
    toast.error('Couldn’t copy', { description: 'Select it and copy by hand.' })
  }
}

export function VouchersManager({ settings, canEditSettings }: { settings: CheckoutSettings; canEditSettings: boolean }) {
  const crud = useCrud(voucherCfg, [], { perm: 'vouchers.edit' })
  const [usage, setUsage] = useState<Map<string, Usage>>(new Map())
  const [emails, setEmails] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | State>('all')
  const [now] = useState(() => Date.now())
  const canCustomers = useCan('customers.view')

  // real redemptions (RLS: vouchers.edit or orders.view) — refreshed whenever the list reloads
  useEffect(() => {
    const sb = getAdminClient()
    if (!sb || crud.status !== 'ready') return
    let alive = true
    ;(async () => {
      const { data } = await sb.from('voucher_redemptions').select('voucher_id, amount, created_at').order('created_at', { ascending: false }).limit(5000)
      if (!alive || !Array.isArray(data)) return
      const m = new Map<string, Usage>()
      for (const r of data as Array<{ voucher_id: string; amount: number; created_at: string }>) {
        const u = m.get(r.voucher_id) ?? { count: 0, amount: 0, last: null }
        u.count++
        u.amount += r.amount ?? 0
        u.last = u.last ?? r.created_at
        m.set(r.voucher_id, u)
      }
      setUsage(m)
    })()
    return () => {
      alive = false
    }
  }, [crud.status, crud.rows.length])

  // customer emails for "assign to" suggestions (needs customers.view; silently empty otherwise)
  useEffect(() => {
    const sb = getAdminClient()
    if (!sb || !canCustomers) return
    let alive = true
    ;(async () => {
      const { data } = await sb.from('profiles').select('email').not('email', 'is', null).order('created_at', { ascending: false }).limit(500)
      if (alive && Array.isArray(data)) setEmails((data as Array<{ email: string | null }>).map((r) => r.email ?? '').filter((e) => e && !e.endsWith('.local')))
    })()
    return () => {
      alive = false
    }
  }, [canCustomers])

  const stats = useMemo(() => {
    let redemptions = 0
    let given = 0
    let top: { code: string; count: number } | null = null
    for (const v of crud.rows) {
      const u = usage.get(v.id)
      if (!u) continue
      redemptions += u.count
      given += u.amount
      if (!top || u.count > top.count) top = { code: v.code, count: u.count }
    }
    return { live: crud.rows.filter((v) => stateOf(v, usage.get(v.id), now) === 'live').length, redemptions, given, top }
  }, [crud.rows, usage, now])

  const rows = useMemo(() => (filter === 'all' ? crud.rows : crud.rows.filter((v) => stateOf(v, usage.get(v.id), now) === filter)), [crud.rows, usage, filter, now])

  const toggleActive = (v: Voucher) =>
    crud.update(v.id, (x) => ({ ...x, active: !x.active }), { success: `${v.code} ${v.active ? 'paused' : 'is live'}` })

  return (
    <AdminPage
      no="07"
      kicker={`Customers · ${stats.live} live voucher${stats.live === 1 ? '' : 's'}`}
      title={<>Voucher <em>codes</em></>}
      jp="クーポン · 割引"
      description="Make a code, hand it to a customer (or post it on Instagram), and it takes money off at checkout. The server checks every rule — dates, limits, minimum order, who it’s for — when the order is placed."
      actions={<SandboxSwitch mode={crud.mode} readOnly={crud.readOnly} />}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard index={0} label="Live vouchers" jp="有効" value={stats.live} tone="volt" />
        <StatCard index={1} label="Times used" jp="利用回数" value={stats.redemptions} tone="lav" hint="placed orders with a voucher" />
        <StatCard index={2} label="Discount given" jp="割引額" value={stats.given} format="inr" tone="door" />
        <StatCard index={3} label="Most used" jp="人気" value={stats.top?.count ?? null} tone="ink" hint={stats.top ? stats.top.code : 'no redemptions yet'} />
      </div>

      <EntityManager<Voucher>
        crud={{ ...crud, save: (item, opts) => crud.save({ ...item, code: item.code.trim().toUpperCase(), assignedEmail: item.assignedEmail?.trim().toLowerCase() || null }, opts) }}
        rows={rows}
        caption="Vouchers"
        noun="voucher"
        jp="クーポン編集"
        wide
        searchText={(v) => `${v.code} ${v.description} ${v.assignedEmail ?? ''} ${v.appliesToType ?? ''}`}
        blank={blankVoucher}
        schema={schema}
        emptyBody="No vouchers yet. Make one for a fest crowd, an Instagram giveaway or a loyal customer — the code works at checkout straight away."
        toolbar={
          <Chips
            label="State"
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'all' as const, label: 'All', count: crud.rows.length },
              ...(['live', 'scheduled', 'paused', 'used-up', 'expired'] as const).map((s) => ({
                id: s,
                label: STATE_PILL[s].label,
                count: crud.rows.filter((v) => stateOf(v, usage.get(v.id), now) === s).length,
              })),
            ]}
          />
        }
        columns={[
          {
            id: 'code',
            header: 'Code',
            sortValue: (v) => v.code,
            cell: (v) => (
              <span className="flex items-center gap-2">
                <span className="min-w-0 leading-tight">
                  <span className="block font-mono text-[14px] font-bold tracking-[0.06em] text-volt">{v.code}</span>
                  {v.description && <span className="block max-w-[28ch] truncate text-[12px] text-paper/55">{v.description}</span>}
                </span>
                <button
                  type="button"
                  aria-label={`Copy ${v.code}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    void copy(v.code)
                  }}
                  className="grid size-10 shrink-0 place-items-center text-paper/55 focus-ring can-hover:hover:text-volt"
                >
                  <Copy aria-hidden className="size-4" />
                </button>
              </span>
            ),
          },
          {
            id: 'off',
            header: 'Discount',
            sortValue: (v) => (v.type === 'flat' ? v.value : v.value * 10),
            cell: (v) => (
              <span className="block text-[13px] leading-tight">
                <span className="font-mono font-bold">{voucherHeadline(v, formatINR)}</span>
                <span className="block text-[11.5px] text-paper/50">
                  {[v.minOrder ? `min ${formatINR(v.minOrder)}` : '', v.appliesToType ? `${v.appliesToType}s only` : ''].filter(Boolean).join(' · ') || 'whole cart'}
                </span>
              </span>
            ),
          },
          {
            id: 'who',
            header: 'For',
            hideOnMobile: true,
            sortValue: (v) => v.assignedEmail ?? '',
            cell: (v) => <span className="block max-w-[22ch] truncate text-[12.5px]">{v.assignedEmail ?? <span className="text-paper/45">anyone</span>}</span>,
          },
          {
            id: 'use',
            header: 'Used',
            align: 'right',
            sortValue: (v) => usage.get(v.id)?.count ?? 0,
            cell: (v) => {
              const u = usage.get(v.id)
              return (
                <span className="block text-right font-mono text-[13px] leading-tight tabular-nums">
                  {u?.count ?? 0}
                  {v.usageLimit ? `/${v.usageLimit}` : ''}
                  <span className="block text-[11px] text-paper/50">{u?.amount ? `−${formatINR(u.amount)}` : '—'}</span>
                </span>
              )
            },
          },
          {
            id: 'state',
            header: 'State',
            sortValue: (v) => stateOf(v, usage.get(v.id), now),
            cell: (v) => {
              const s = STATE_PILL[stateOf(v, usage.get(v.id), now)]
              return (
                <button
                  type="button"
                  role="switch"
                  aria-checked={v.active}
                  aria-label={`${v.code}: ${v.active ? 'pause' : 'make live'}`}
                  disabled={crud.readOnly || crud.mode === 'demo'}
                  title={crud.readOnly ? READONLY_NOTE : v.active ? 'Pause this code' : 'Make it live'}
                  onClick={(e) => {
                    e.stopPropagation()
                    void toggleActive(v)
                  }}
                  className="inline-flex min-h-10 items-center gap-2 focus-ring disabled:cursor-not-allowed"
                >
                  <span className={cn('relative h-5 w-9 shrink-0 border-2 border-ink transition-colors duration-150', v.active ? 'bg-volt' : 'bg-tone-2')}>
                    <span className={cn('absolute top-0.5 size-3 border-2 border-ink bg-paper transition-[left] duration-200', v.active ? 'left-[18px]' : 'left-0.5')} />
                  </span>
                  <span className={adminPill(s.tone)}>{s.label}</span>
                </button>
              )
            },
          },
        ]}
        form={(v, set, e, isNew) => {
          const u = usage.get(v.id)
          return (
            <>
              <FormSection title="The code" jp="コード">
                <div className="sm:col-span-2">
                  <Field label="Code" hint="Customers type this at checkout. Letters, numbers and dashes." error={e.code}>
                    <div className="flex flex-wrap gap-2">
                      <input
                        value={v.code}
                        onChange={(ev) => set({ code: ev.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })}
                        maxLength={32}
                        aria-invalid={!!e.code}
                        aria-label="Voucher code"
                        className={cn(adminInput, 'min-w-0 flex-1 font-mono text-[16px] font-bold tracking-[0.1em]')}
                      />
                      <GenerateButton onGenerate={(code) => set({ code })} />
                      <button type="button" onClick={() => void copy(v.code)} className={adminBtn({ variant: 'ghost', size: 'sm', className: 'min-h-11' })}>
                        <Copy aria-hidden className="size-4" /> Copy
                      </button>
                    </div>
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <TextField label="Description (shown to the customer)" value={v.description} onChange={(description) => set({ description })} maxLength={200} placeholder="Fest special — 15% off everything" error={e.description} />
                </div>
              </FormSection>

              <FormSection title="How much off" jp="割引">
                <SelectField label="Type" value={v.type} onChange={(type) => set({ type, ...(type === 'flat' ? { maxDiscount: null } : {}) })} options={[{ id: 'percent', label: '% off' }, { id: 'flat', label: '₹ off (flat)' }]} />
                <NumberField label={v.type === 'percent' ? 'Percent off' : 'Rupees off'} value={v.value} onChange={(n) => set({ value: n ?? 0 })} min={1} error={e.value} />
                {v.type === 'percent' && (
                  <NumberField label="Max discount (₹)" hint="Optional cap, e.g. 20% off up to ₹200." value={v.maxDiscount} onChange={(maxDiscount) => set({ maxDiscount })} min={1} error={e.maxDiscount} />
                )}
                <NumberField label="Minimum order (₹)" hint="Cart value after bundle deals. 0 = no minimum." value={v.minOrder} onChange={(n) => set({ minOrder: n ?? 0 })} error={e.minOrder} />
                <SelectField
                  label="Applies to"
                  value={(v.appliesToType ?? '') as string}
                  onChange={(t) => set({ appliesToType: t || null })}
                  options={[{ id: '', label: 'Everything in the cart' }, ...PRODUCT_TYPES.map((t) => ({ id: t as string, label: `${t}s only` }))]}
                />
              </FormSection>

              <FormSection title="Who & how often" jp="対象">
                <div className="sm:col-span-2">
                  <Field label="Only for this customer (email)" hint={emails.length ? 'Leave empty so anyone can use it. Suggestions are your signed-up customers.' : 'Leave empty so anyone can use it. The customer must log in with this email.'} error={e.assignedEmail}>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="email"
                        list="voucher-customer-emails"
                        value={v.assignedEmail ?? ''}
                        onChange={(ev) => set({ assignedEmail: ev.target.value || null })}
                        placeholder="customer@example.com"
                        aria-invalid={!!e.assignedEmail}
                        aria-label="Assigned customer email"
                        className={cn(adminInput, 'min-w-0 flex-1')}
                      />
                      {v.assignedEmail && /@/.test(v.assignedEmail) && (
                        <a
                          href={`mailto:${encodeURIComponent(v.assignedEmail)}?subject=${encodeURIComponent('A voucher from The Escape Door')}&body=${encodeURIComponent(`Here's your code: ${v.code}\n${voucherHeadline(v, formatINR)}${v.minOrder ? ` on orders over ${formatINR(v.minOrder)}` : ''}.\nLog in with this email and enter it at checkout.`)}`}
                          className={adminBtn({ variant: 'ghost', size: 'sm', className: 'min-h-11' })}
                        >
                          <Mail aria-hidden className="size-4" /> Email it
                        </a>
                      )}
                    </div>
                    <datalist id="voucher-customer-emails">
                      {emails.map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </Field>
                </div>
                <NumberField label="Total uses" hint="Across all customers. Empty = unlimited." value={v.usageLimit} onChange={(usageLimit) => set({ usageLimit })} min={1} error={e.usageLimit} />
                <NumberField label="Uses per customer" hint="Empty = unlimited." value={v.perUserLimit} onChange={(perUserLimit) => set({ perUserLimit })} min={1} error={e.perUserLimit} />
              </FormSection>

              <FormSection title="When" jp="期間">
                <Field label="Starts (optional)">
                  <input type="datetime-local" value={toLocal(v.startsAt)} onChange={(ev) => set({ startsAt: fromLocal(ev.target.value) })} aria-label="Starts" className={adminInput} />
                </Field>
                <Field label="Ends (optional)" error={e.endsAt}>
                  <input type="datetime-local" value={toLocal(v.endsAt)} onChange={(ev) => set({ endsAt: fromLocal(ev.target.value) })} aria-invalid={!!e.endsAt} aria-label="Ends" className={adminInput} />
                </Field>
                <div className="sm:col-span-2">
                  <Toggle checked={v.active} onChange={(active) => set({ active })} label={v.active ? 'Live — works at checkout' : 'Paused — refused at checkout'} hint="Pause instead of deleting: the history stays." />
                </div>
              </FormSection>

              {!isNew && (
                <p className="mt-6 border-2 border-paper/15 p-3 font-mono text-[12.5px] text-paper/70">
                  Used {u?.count ?? 0} time{u?.count === 1 ? '' : 's'}
                  {u?.amount ? ` · ${formatINR(u.amount)} discount given` : ''}
                  {u?.last ? ` · last ${new Date(u.last).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}
                </p>
              )}
            </>
          )
        }}
      />

      <CheckoutSettingsPanel initial={settings} canEdit={canEditSettings} demo={crud.mode !== 'live'} />
    </AdminPage>
  )
}

function GenerateButton({ onGenerate }: { onGenerate: (code: string) => void }) {
  const [tag, setTag] = useState('')
  return (
    <span className="flex gap-2">
      <input
        value={tag}
        onChange={(e) => setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
        placeholder="TAG"
        aria-label="Optional tag inside the code, e.g. JJK"
        className={cn(adminInput, 'w-24 font-mono uppercase')}
      />
      <button type="button" onClick={() => onGenerate(generateVoucherCode(tag))} className={adminBtn({ variant: 'door', size: 'sm', className: 'min-h-11' })}>
        <Wand2 aria-hidden className="size-4" /> Generate
      </button>
    </span>
  )
}

function CheckoutSettingsPanel({ initial, canEdit, demo }: { initial: CheckoutSettings; canEdit: boolean; demo: boolean }) {
  const [fee, setFee] = useState<number | null>(initial.giftWrapFee)
  const [saved, setSaved] = useState(initial.giftWrapFee)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = (fee ?? 0) !== saved

  const save = async () => {
    setSaving(true)
    setError(null)
    const r = await saveCheckoutSettings({ giftWrapFee: fee ?? 0 })
    setSaving(false)
    if (!r.ok) {
      setError(r.error)
      toast.error('Not saved', { description: r.error })
      return
    }
    setSaved(r.value.giftWrapFee)
    setFee(r.value.giftWrapFee)
    toast.success('Checkout settings saved', { description: r.value.giftWrapFee ? `Gift wrap now costs ${formatINR(r.value.giftWrapFee)}.` : 'Gift wrap is free.' })
  }

  return (
    <AdminPanel index={2} title={<>Checkout <em className="accent">settings</em></>} jp="お会計設定" shadow="door">
      <div className="grid items-end gap-4 sm:grid-cols-[minmax(0,260px)_auto_1fr]">
        <NumberField label="Gift-wrap fee (₹)" hint="0 = free — customers then see no fee at all." value={fee} onChange={setFee} error={error ?? undefined} />
        <button
          type="button"
          onClick={save}
          disabled={!canEdit || demo || saving || !dirty}
          title={!canEdit ? 'Needs the Settings permission' : demo ? 'Demo mode — connect Supabase to save' : undefined}
          className={adminBtn({ className: 'min-h-12' })}
        >
          {saving ? <span className="inline-block size-3.5 animate-spin border-2 border-ink border-t-transparent" aria-hidden /> : <Sparkles aria-hidden className="size-4" />}
          {saving ? 'Saving…' : 'Save'}
        </button>
        <p className="text-[13px] leading-snug text-paper/60">
          {saved ? <>Customers who tick <strong className="text-paper">Pack as a gift</strong> pay {formatINR(saved)} extra.</> : <>Gift wrap is <strong className="text-paper">free</strong> right now.</>}
          {!canEdit && ' Only members with the Settings permission can change this.'}
        </p>
      </div>
    </AdminPanel>
  )
}
