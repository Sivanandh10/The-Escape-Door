'use client'
// "Add manually" + "Edit details" drawers for Leads and Orders (walk-ins at a stall, phone / DM orders,
// fixing a typo in a contact). Saves go through useCrud (RLS: leads.edit / orders.edit).
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import type { CartItem } from '@/lib/types'
import { formatINR } from '@/lib/pricing'
import { adminBtn } from '../ui'
import type { Crud } from './data'
import { LEAD_KINDS, LEAD_STATUSES, ORDER_STATUSES, SPAM_STATUS, type AdminLead, type AdminOrder } from './entities'
import { Drawer, FormSection, NumberField, SaveBar, SelectField, TextArea, TextField, issuesToErrors } from './kit'
import { newId } from './util'

const uuid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`)
const srcRe = /^([a-z0-9]+(-[a-z0-9]+)*)?$/

const contactish = <T extends { name: string; contact: string }>(v: T) => !!(v.name.trim() || v.contact.trim())

// ---------------------------------------------------------------- leads
const leadSchema = z
  .object({
    name: z.string().max(80),
    city: z.string().max(80),
    contact: z.string().max(120),
    message: z.string().max(2000),
    src: z.string().regex(srcRe, 'lowercase-with-dashes').max(40),
  })
  .refine(contactish, { message: 'Add a name or a contact', path: ['name'] })

export function blankLead(): AdminLead {
  const now = new Date().toISOString()
  return {
    id: uuid(), kind: 'whatsapp_order', name: '', city: '', contact: '', message: '', payload: { manual: true }, source: null,
    src: '', status: 'new', createdAt: now, updatedAt: now, notes: '',
  }
}

export function LeadEditDrawer({ lead, isNew, crud, onClose }: { lead: AdminLead | null; isNew: boolean; crud: Crud<AdminLead>; onClose: () => void }) {
  const [d, setD] = useState<AdminLead | null>(lead)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the form when another lead opens
    setD(lead); setErrors({}); setDirty(false)
  }, [lead])
  const set = (p: Partial<AdminLead>) => { setD((x) => (x ? { ...x, ...p } : x)); setDirty(true) }
  const save = async () => {
    if (!d) return
    const r = leadSchema.safeParse(d)
    if (!r.success) return setErrors(issuesToErrors(r.error.issues))
    setSaving(true)
    const ok = await crud.save({ ...d, name: d.name.trim(), city: d.city.trim(), contact: d.contact.trim(), updatedAt: new Date().toISOString() })
    setSaving(false)
    if (ok) onClose()
  }
  return (
    <Drawer
      open={!!d}
      onClose={onClose}
      title={isNew ? 'Add lead' : 'Edit lead'}
      jp={isNew ? '手動で追加' : '詳細を編集'}
      footer={d && <SaveBar saving={saving} dirty={dirty} mode={crud.mode} readOnly={crud.readOnly} onSave={save} onCancel={onClose} />}
    >
      {d && (
        <>
          <FormSection title="Who" jp="お客様">
            <TextField label="Name" value={d.name} error={errors.name} maxLength={80} onChange={(name) => set({ name })} />
            <TextField label="City" value={d.city} error={errors.city} maxLength={80} onChange={(city) => set({ city })} />
            <TextField className="sm:col-span-2" label="Contact (phone or email)" mono value={d.contact} error={errors.contact} maxLength={120} onChange={(contact) => set({ contact })} placeholder="+91 98765 43210" />
          </FormSection>
          <FormSection title="What" jp="内容">
            <SelectField label="Kind" value={d.kind} onChange={(kind) => set({ kind })} options={LEAD_KINDS.map((k) => ({ id: k.id, label: k.label }))} />
            <SelectField label="Status" value={d.status} onChange={(status) => set({ status })} options={[...LEAD_STATUSES, SPAM_STATUS].map((s) => ({ id: s.id, label: s.label }))} />
            <TextField label="Source (src)" mono value={d.src} error={errors.src} onChange={(src) => set({ src: src.toLowerCase() })} placeholder="thomso, instagram, walk-in…" />
            <TextArea className="sm:col-span-2" label="Message / request" rows={4} maxLength={2000} value={d.message} error={errors.message} onChange={(message) => set({ message })} />
          </FormSection>
        </>
      )}
    </Drawer>
  )
}

// ---------------------------------------------------------------- orders
type Line = { name: string; variantLabel: string; qty: number; unitPrice: number | null }
const lineSum = (ls: Line[]) => ls.reduce((a, l) => a + (l.unitPrice ?? 0) * l.qty, 0)

const orderSchema = z
  .object({
    name: z.string().max(80),
    city: z.string().max(80),
    contact: z.string().max(120),
    note: z.string().max(2000),
    src: z.string().regex(srcRe, 'lowercase-with-dashes').max(40),
    total: z.number().int().min(0).nullable(),
    lines: z.array(z.object({ name: z.string().trim().min(1, 'Name each item').max(120), qty: z.number().int().min(1, 'Qty ≥ 1').max(999), unitPrice: z.number().int().min(0).nullable() })).max(60),
  })
  .refine(contactish, { message: 'Add a name or a contact', path: ['name'] })

export function blankOrder(): AdminOrder {
  const now = new Date().toISOString()
  return {
    id: uuid(), leadId: null, items: [], totals: null, subtotal: null, savings: null, total: null,
    name: '', city: '', contact: '', note: '', src: '', status: 'new', createdAt: now, updatedAt: now,
  }
}

function toLines(items: CartItem[]): Line[] {
  return items.map((i) => ({ name: i.name, variantLabel: [i.variantLabel, i.size].filter(Boolean).join(' · '), qty: i.qty, unitPrice: i.unitPrice }))
}

export function OrderEditDrawer({ order, isNew, crud, onClose }: { order: AdminOrder | null; isNew: boolean; crud: Crud<AdminOrder>; onClose: () => void }) {
  const [d, setD] = useState<AdminOrder | null>(order)
  const [lines, setLines] = useState<Line[]>(order ? toLines(order.items) : [])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the form when another order opens
    setD(order); setLines(order ? toLines(order.items) : []); setErrors({}); setDirty(false)
  }, [order])
  const set = (p: Partial<AdminOrder>) => { setD((x) => (x ? { ...x, ...p } : x)); setDirty(true) }
  const setLine = (i: number, p: Partial<Line>) => { setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l))); setDirty(true) }
  const sum = lineSum(lines)

  const save = async () => {
    if (!d || !order) return
    const r = orderSchema.safeParse({ ...d, lines })
    if (!r.success) return setErrors(issuesToErrors(r.error.issues))
    const linesChanged = JSON.stringify(lines) !== JSON.stringify(toLines(order.items))
    const items: CartItem[] = linesChanged
      ? lines.map((l, i) => {
          const prev = order.items[i]
          const id = prev?.productId || newId('manual-')
          return {
            ...(prev ?? { productId: id, slug: '', type: 'accessory', collection: '', variantId: 'manual', image: '' }),
            key: prev?.key ?? `${id}:manual`, name: l.name.trim(), variantLabel: l.variantLabel.trim(), qty: l.qty, unitPrice: l.unitPrice,
          } as CartItem
        })
      : order.items
    setSaving(true)
    const ok = await crud.save({
      ...d,
      name: d.name.trim(), city: d.city.trim(), contact: d.contact.trim(), items,
      // edited lines no longer match the cart's bundle maths → keep plain sums
      ...(linesChanged ? { totals: null, subtotal: sum, savings: null } : {}),
      total: d.total ?? (linesChanged || isNew ? sum : d.total),
      updatedAt: new Date().toISOString(),
    })
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Drawer
      open={!!d}
      onClose={onClose}
      title={isNew ? 'Add order' : 'Edit order'}
      jp={isNew ? '手動で追加' : '詳細を編集'}
      wide
      footer={d && <SaveBar saving={saving} dirty={dirty} mode={crud.mode} readOnly={crud.readOnly} onSave={save} onCancel={onClose} />}
    >
      {d && (
        <>
          <FormSection title="Customer" jp="お客様">
            <TextField label="Name" value={d.name} error={errors.name} maxLength={80} onChange={(name) => set({ name })} />
            <TextField label="City" value={d.city} maxLength={80} onChange={(city) => set({ city })} />
            <TextField label="Contact (phone or email)" mono value={d.contact} maxLength={120} onChange={(contact) => set({ contact })} placeholder="+91 98765 43210" />
            <TextField label="Source (src)" mono value={d.src} error={errors.src} onChange={(src) => set({ src: src.toLowerCase() })} placeholder="walk-in, thomso…" />
            <SelectField label="Status" value={d.status} onChange={(status) => set({ status })} options={ORDER_STATUSES.map((s) => ({ id: s.id, label: s.label }))} />
            <TextArea className="sm:col-span-2" label="Note" rows={2} maxLength={2000} value={d.note} onChange={(note) => set({ note })} />
          </FormSection>
          <FormSection title="Items" jp="商品">
            <div className="space-y-2 sm:col-span-2">
              {errors.lines && <p role="alert" className="label text-[10px] text-hype">{errors.lines}</p>}
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_72px_110px_44px] items-end gap-2">
                  <TextField label={`Item ${i + 1}`} value={l.name} error={errors[`lines.${i}.name`]} onChange={(name) => setLine(i, { name })} placeholder="Gojo oversized tee · L" />
                  <NumberField label="Qty" min={1} value={l.qty} error={errors[`lines.${i}.qty`]} onChange={(qty) => setLine(i, { qty: qty ?? 1 })} />
                  <NumberField label="Each ₹" value={l.unitPrice} placeholder="on req." onChange={(unitPrice) => setLine(i, { unitPrice })} />
                  <button type="button" aria-label={`Remove item ${i + 1}`} onClick={() => { setLines((ls) => ls.filter((_, j) => j !== i)); setDirty(true) }} className="grid size-11 place-items-center border-2 border-paper/20 text-paper/60 focus-ring can-hover:hover:border-hype can-hover:hover:text-hype"><Trash2 aria-hidden className="size-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => { setLines((ls) => [...ls, { name: '', variantLabel: '', qty: 1, unitPrice: null }]); setDirty(true) }} className={adminBtn({ variant: 'ghost', size: 'sm' })}><Plus aria-hidden className="size-4" /> Add item</button>
            </div>
            <NumberField label="Order total ₹" value={d.total} placeholder={`line sum ${formatINR(sum)}`} onChange={(total) => set({ total })} hint="Leave empty to use the line sum. Type a number for deals or discounts agreed on chat." />
            <div className="self-start border-2 border-paper/15 p-3 font-mono text-[12.5px] text-paper/75" aria-live="polite">
              Line sum <span className="font-bold text-volt">{formatINR(sum)}</span>
              <button type="button" onClick={() => set({ total: sum })} className="ml-3 underline decoration-2 underline-offset-4 focus-ring can-hover:hover:text-paper">use it</button>
            </div>
          </FormSection>
        </>
      )}
    </Drawer>
  )
}
