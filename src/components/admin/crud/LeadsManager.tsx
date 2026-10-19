'use client'
// P4b — Leads: pipeline board (drag between New → Contacted → Won / Lost) + list view, filters,
// detail drawer (contact, order lines, custom files via signed URLs, notes), CSV export, #69 shred + undo,
// "Add lead" (manual: walk-ins, DMs, calls) and "Edit details" (ManualEntry.tsx).
import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Download, ExternalLink, FileText, Kanban, List, Mail, MessageCircle, PackagePlus, Pencil, Plus, Sparkles } from 'lucide-react'
import type { CartItem, CartTotals } from '@/lib/types'
import { formatINR } from '@/lib/pricing'
import { cn } from '@/lib/utils'
import { adminBtn, adminInput, adminPill } from '../ui'
import { AdminPage } from '../AdminPage'
import { ConfirmShred } from '../ConfirmShred'
import { EmptyState } from '../EmptyState'
import { downloadText, getAdminClient, signCustomUpload, toCsv, useCrud, explainDemo, explainReadOnly, type Crud } from './data'
import { READONLY_NOTE, useCan } from '../AdminContext'
import {
  LEAD_KINDS, LEAD_STATUSES, SPAM_STATUS, fileRefs, leadCfg, orderCfg, orderFromLead,
  type AdminLead, type LeadStatus,
} from './entities'
import { fmtDate, newId, waFor } from './util'
import { Chips, Drawer, SandboxSwitch, SearchBox, StateSwitch, Toolbar } from './kit'
import { LeadEditDrawer, blankLead } from './ManualEntry'

type View = 'board' | 'list'
const STATUS_ALL = [...LEAD_STATUSES, SPAM_STATUS]
const statusMeta = (s: LeadStatus) => STATUS_ALL.find((x) => x.id === s) ?? LEAD_STATUSES[0]
const kindMeta = (k: string) => LEAD_KINDS.find((x) => x.id === k)

function leadTotal(l: AdminLead): number | null {
  const t = (l.payload?.totals as CartTotals | undefined)?.total
  return typeof t === 'number' ? t : null
}

export function LeadsManager({ initial }: { initial: AdminLead[] }) {
  const crud = useCrud(leadCfg, initial, { perm: 'leads.edit' })
  const [view, setView] = useState<View>('board')
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<'all' | AdminLead['kind']>('all')
  const [src, setSrc] = useState('all')
  const [showSpam, setShowSpam] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ lead: AdminLead; isNew: boolean } | null>(null)

  // small screens start in list view
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time viewport read after mount
    if (window.matchMedia('(max-width: 1023px)').matches) setView('list')
  }, [])

  const srcs = useMemo(() => [...new Set(crud.rows.map((l) => l.src || '(direct)'))].sort(), [crud.rows])
  const filtered = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    return crud.rows.filter((l) => {
      if (!showSpam && l.status === 'spam') return false
      if (kind !== 'all' && l.kind !== kind) return false
      if (src !== 'all' && (l.src || '(direct)') !== src) return false
      if (terms.length) {
        const hay = `${l.name} ${l.city} ${l.contact} ${l.message} ${l.src} ${l.notes}`.toLowerCase()
        if (!terms.every((t) => hay.includes(t))) return false
      }
      return true
    })
  }, [crud.rows, q, kind, src, showSpam])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const l of crud.rows) c[l.kind] = (c[l.kind] ?? 0) + 1
    return c
  }, [crud.rows])

  const open = crud.rows.find((l) => l.id === openId) ?? null

  const setStatus = (id: string, status: LeadStatus) => {
    const l = crud.rows.find((x) => x.id === id)
    if (!l || l.status === status) return
    void crud.update(id, (x) => ({ ...x, status }), { success: `${l.name || 'Lead'} → ${statusMeta(status).label}` })
  }

  const exportCsv = () => {
    const rows = filtered.map((l) => ({
      id: l.id, created_at: l.createdAt, kind: l.kind, status: l.status, name: l.name, city: l.city, contact: l.contact,
      src: l.src, total_inr: leadTotal(l) ?? '', message: l.message, notes: l.notes,
    }))
    if (!rows.length) return toast('Nothing to export with these filters')
    downloadText(`escape-door-leads-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows))
    toast.success(`Exported ${rows.length} lead${rows.length === 1 ? '' : 's'}`)
  }

  return (
      <AdminPage
        no="04"
        kicker={`Inbox · ${crud.rows.filter((l) => l.status === 'new').length} new`}
        title={<>Lead <em>inbox</em></>}
        jp="問い合わせ · パイプライン"
        description="Every WhatsApp order, custom request, “remind me” and newsletter sign-up lands here. Drag cards along the pipeline, or open one to reply."
        actions={
          <>
            <SandboxSwitch mode={crud.mode} readOnly={crud.readOnly} />
            <div role="radiogroup" aria-label="View" className="flex border-2 border-paper/20">
              {(['board', 'list'] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)} className={cn('grid min-h-11 min-w-11 place-items-center px-3 focus-ring', view === v ? 'bg-paper text-ink' : 'text-paper/70 can-hover:hover:text-paper')}>
                  {v === 'board' ? <Kanban aria-hidden className="size-4" /> : <List aria-hidden className="size-4" />}
                  <span className="sr-only">{v} view</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setEditing({ lead: blankLead(), isNew: true })} disabled={crud.readOnly} title={crud.readOnly ? READONLY_NOTE : 'Walk-in, DM or phone call — add it by hand'} className={adminBtn()}>
              <Plus aria-hidden className="size-4" /> Add lead
            </button>
            <button type="button" onClick={exportCsv} className={adminBtn({ variant: 'ghost' })}>
              <Download aria-hidden className="size-4" /> CSV
            </button>
          </>
        }
        toolbar={
          <Toolbar>
            <SearchBox value={q} onChange={setQ} placeholder="Search name, city, contact, notes…" label="Search leads" />
            <label className="min-w-[150px]">
              <span className="sr-only">Source</span>
              <select value={src} onChange={(e) => setSrc(e.target.value)} className={cn(adminInput, 'cursor-pointer font-mono text-[13px]')}>
                <option value="all" className="bg-ink">All sources</option>
                {srcs.map((s) => <option key={s} value={s} className="bg-ink">{s}</option>)}
              </select>
            </label>
            <Chips
              label="Lead kind"
              value={kind}
              onChange={setKind}
              className="min-w-0 flex-1 basis-full lg:basis-auto"
              options={[{ id: 'all' as const, label: 'All', count: crud.rows.length }, ...LEAD_KINDS.map((k) => ({ id: k.id, label: k.short, count: counts[k.id] ?? 0 }))]}
            />
            <label className="label inline-flex min-h-10 cursor-pointer items-center gap-2 text-paper/60">
              <input type="checkbox" checked={showSpam} onChange={(e) => setShowSpam(e.target.checked)} className="size-4 accent-[var(--color-hype)]" />
              Show spam
            </label>
          </Toolbar>
        }
      >
      <StateSwitch status={crud.status} error={crud.error} onRetry={crud.reload}>
        {crud.rows.length === 0 ? (
          <EmptyState
            title="Inbox zero"
            body="No leads yet. They appear here the moment someone taps “Buy on WhatsApp”, sends a custom request or asks to be reminded about a stall."
            action={crud.readOnly ? undefined : <button type="button" onClick={() => setEditing({ lead: blankLead(), isNew: true })} className={adminBtn()}><Plus aria-hidden className="size-4" /> Add lead</button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState mood="peek" sfx="…?" title="No door leads there" body="No leads match these filters." action={<button type="button" className={adminBtn({ variant: 'ghost' })} onClick={() => { setQ(''); setKind('all'); setSrc('all') }}>Reset filters</button>} />
        ) : view === 'board' ? (
          <Board leads={filtered} onOpen={setOpenId} onMove={setStatus} showSpam={showSpam} readOnly={crud.readOnly} />
        ) : (
          <ListView leads={filtered} onOpen={setOpenId} onStatus={setStatus} crud={crud} />
        )}
      </StateSwitch>

      <LeadDrawer
        lead={open}
        mode={crud.mode}
        onClose={() => setOpenId(null)}
        onStatus={(s) => open && setStatus(open.id, s)}
        onNotes={(notes) => open && crud.update(open.id, (x) => ({ ...x, notes }), { success: 'Note saved' })}
        crud={crud}
        onPromoted={() => open && setStatus(open.id, 'converted')}
        onEdit={() => { if (open) { setOpenId(null); setEditing({ lead: open, isNew: false }) } }}
      />
      <LeadEditDrawer lead={editing?.lead ?? null} isNew={!!editing?.isNew} crud={crud} onClose={() => setEditing(null)} />
    </AdminPage>
  )
}

// ---------------------------------------------------------------- board
function Board({
  leads, onOpen, onMove, showSpam, readOnly,
}: {
  leads: AdminLead[]
  onOpen: (id: string) => void
  onMove: (id: string, s: LeadStatus) => void
  showSpam: boolean
  readOnly?: boolean
}) {
  const [over, setOver] = useState<LeadStatus | null>(null)
  const cols = showSpam ? STATUS_ALL : LEAD_STATUSES
  return (
    <div className={cn('grid gap-3 md:grid-cols-2', showSpam ? 'xl:grid-cols-5' : 'xl:grid-cols-4')}>
      {cols.map((col, ci) => {
        const items = leads.filter((l) => l.status === col.id)
        return (
          <section
            key={col.id}
            aria-label={`${col.label} (${items.length})`}
            onDragOver={(e) => { if (readOnly) return; e.preventDefault(); setOver(col.id) }}
            onDragLeave={() => setOver((o) => (o === col.id ? null : o))}
            onDrop={(e: DragEvent) => {
              e.preventDefault()
              setOver(null)
              const id = e.dataTransfer.getData('text/lead')
              if (id) onMove(id, col.id)
            }}
            className={cn(
              'admin-rise flex min-h-[220px] flex-col border-4 bg-[#121218] transition-[border-color,background-color] duration-150',
              over === col.id ? 'border-volt bg-[#1a1a10]' : 'border-paper/10',
            )}
            style={{ ['--d' as string]: `${120 + ci * 60}ms` }}
          >
            <header className={cn('flex items-center justify-between gap-2 border-b-4 border-ink px-3 py-2', col.tone)}>
              <span className="flex items-baseline gap-2">
                <span className="font-display text-[22px] uppercase leading-none">{col.label}</span>
                <span className="font-jp text-[11px] font-bold opacity-70">{col.jp}</span>
              </span>
              <span className="font-mono text-[13px] font-bold tabular-nums">{items.length}</span>
            </header>
            <ul className="flex flex-1 flex-col gap-2 p-2">
              {items.map((l) => (
                <li key={l.id}>
                  <LeadCard lead={l} onOpen={() => onOpen(l.id)} draggable={!readOnly} />
                </li>
              ))}
              {items.length === 0 && (
                <li className="grid flex-1 place-items-center border-2 border-dashed border-paper/10 p-4 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-paper/35">
                  {readOnly ? 'Nothing here' : 'Drop a card here'}
                </li>
              )}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function LeadCard({ lead: l, onOpen, draggable }: { lead: AdminLead; onOpen: () => void; draggable?: boolean }) {
  const k = kindMeta(l.kind)
  const total = leadTotal(l)
  return (
    <button
      type="button"
      draggable={draggable}
      data-drag={draggable ? 'true' : undefined}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/lead', l.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onOpen}
      className="group relative block w-full cursor-pointer border-2 data-[drag=true]:cursor-grab border-ink bg-paper p-3 text-left text-ink shadow-[3px_3px_0_var(--color-ink)] transition-[translate,box-shadow] duration-150 focus-ring active:cursor-grabbing can-hover:hover:-translate-x-0.5 can-hover:hover:-translate-y-0.5 can-hover:hover:shadow-[5px_5px_0_var(--color-door)]"
    >
      <span className="flex items-center justify-between gap-2">
        <span className={adminPill(l.kind === 'whatsapp_order' ? 'volt' : l.kind === 'custom_request' ? 'lav' : l.kind === 'remind_me' ? 'pink' : 'paper')}>{k?.short ?? l.kind}</span>
        <span className="font-mono text-[10.5px] text-ink/50">{fmtDate(l.createdAt)}</span>
      </span>
      <span className="mt-2 block truncate text-[15px] font-bold">{l.name || 'No name'}</span>
      <span className="block truncate text-[13px] text-ink/60">{[l.city, l.contact].filter(Boolean).join(' · ') || '—'}</span>
      <span className="mt-2 flex items-center justify-between gap-2">
        {l.src ? <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-door">src: {l.src}</span> : <span />}
        {total != null && <span className="font-mono text-[13px] font-bold">{formatINR(total)}</span>}
      </span>
      {l.notes && <span className="absolute -right-1 -top-1 size-3 border-2 border-ink bg-volt" title="Has notes" aria-label="Has notes" />}
    </button>
  )
}

// ---------------------------------------------------------------- list
function ListView({
  leads, onOpen, onStatus, crud,
}: {
  leads: AdminLead[]
  onOpen: (id: string) => void
  onStatus: (id: string, s: LeadStatus) => void
  crud: Crud<AdminLead>
}) {
  return (
    <ul className="space-y-2">
      {leads.map((l, i) => {
        const total = leadTotal(l)
        const s = statusMeta(l.status)
        return (
          <li key={l.id} className="admin-rise" style={{ ['--d' as string]: `${Math.min(i, 10) * 35}ms` }}>
              <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 border-2 border-paper/12 bg-[#121218] p-3 transition-colors duration-150 can-hover:hover:border-paper/35 md:grid-cols-[110px_minmax(0,1.4fr)_minmax(0,1fr)_120px_150px_auto]">
                <span className={cn(adminPill(l.kind === 'whatsapp_order' ? 'volt' : l.kind === 'custom_request' ? 'lav' : l.kind === 'remind_me' ? 'pink' : 'paper'), 'w-fit')}>{kindMeta(l.kind)?.short}</span>
                <button type="button" onClick={() => onOpen(l.id)} className="col-span-2 min-w-0 text-left focus-ring md:col-span-1">
                  <span className="block truncate text-[15px] font-bold text-paper underline-offset-4 can-hover:hover:underline">{l.name || 'No name'}</span>
                  <span className="block truncate text-[12.5px] text-paper/55">{[l.city, l.contact].filter(Boolean).join(' · ') || '—'}</span>
                </button>
                <span className="hidden min-w-0 truncate font-mono text-[11px] uppercase tracking-[0.08em] text-paper/45 md:block">{fmtDate(l.createdAt)}{l.src ? ` · ${l.src}` : ''}</span>
                <span className="font-mono text-[14px] font-bold tabular-nums text-paper md:text-right">{total != null ? formatINR(total) : ''}</span>
                <label className="col-span-1">
                  <span className="sr-only">Status for {l.name}</span>
                  <select value={l.status} disabled={crud.readOnly} title={crud.readOnly ? READONLY_NOTE : undefined} onChange={(e) => onStatus(l.id, e.target.value as LeadStatus)} className={cn('min-h-10 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 border-2 border-ink px-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] focus-ring', s.tone)}>
                    {STATUS_ALL.map((x) => <option key={x.id} value={x.id} className="bg-ink text-paper">{x.label}</option>)}
                  </select>
                </label>
                <ConfirmShred {...crud.shredProps(l.id)} className="justify-self-end" />
              </div>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------- drawer
function LeadDrawer({
  lead, mode, onClose, onStatus, onNotes, crud, onPromoted, onEdit,
}: {
  lead: AdminLead | null
  mode: Crud<AdminLead>['mode']
  onClose: () => void
  onStatus: (s: LeadStatus) => void
  onNotes: (n: string) => void
  crud: Crud<AdminLead>
  onPromoted: () => void
  onEdit: () => void
}) {
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<Array<{ ref: string; url: string | null }>>([])
  const [promoting, setPromoting] = useState(false)
  const canOrders = useCan('orders.edit')
  const ro = crud.readOnly
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync the notes draft when another lead opens
    setNotes(lead?.notes ?? '')
  }, [lead?.id, lead?.notes])

  useEffect(() => {
    let alive = true
    const refs = lead ? fileRefs(lead.payload) : []
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show placeholders while links are signed
    setFiles(refs.map((ref) => ({ ref, url: null })))
    if (refs.length) {
      Promise.all(refs.map(async (ref) => ({ ref, url: await signCustomUpload(ref).catch(() => null) }))).then((r) => alive && setFiles(r))
    }
    return () => {
      alive = false
    }
  }, [lead?.id, lead?.payload])

  const promote = async () => {
    if (!lead) return
    if (mode === 'demo') return explainDemo()
    if (ro || !canOrders) return explainReadOnly()
    if (mode === 'sandbox') {
      toast.success('Promoted to order', { description: 'Sandbox — local only.' })
      onPromoted()
      return
    }
    setPromoting(true)
    const sb = getAdminClient()!
    const order = orderFromLead(lead, crypto.randomUUID?.() ?? newId(''))
    const { error } = await sb.from(orderCfg.table).insert(orderCfg.toRow(order))
    setPromoting(false)
    if (error) return toast.error('Could not create the order', { description: error.message })
    toast.success('Order created', { description: 'Find it under Orders.', action: { label: 'Open', onClick: () => (window.location.href = '/admin/orders') } })
    onPromoted()
  }

  const l = lead
  const items = (Array.isArray(l?.payload?.items) ? l!.payload!.items : []) as CartItem[]
  const totals = (l?.payload?.totals as CartTotals | undefined) ?? null
  const wa = l ? waFor(l.contact) : null
  const extra = l?.payload ? Object.entries(l.payload).filter(([k]) => !['items', 'totals', '_admin', 'fileUrls', 'files'].includes(k)) : []

  return (
    <Drawer
      open={!!l}
      onClose={onClose}
      title={l?.name || 'Lead'}
      jp={l ? `${kindMeta(l.kind)?.label ?? l.kind} · ${fmtDate(l.createdAt)}` : undefined}
      footer={
        l && (
          <>
            {l.kind === 'whatsapp_order' && (
              <button type="button" onClick={promote} disabled={promoting || (mode === 'live' && (ro || !canOrders))} title={mode === 'live' && (ro || !canOrders) ? READONLY_NOTE : undefined} className={adminBtn({ variant: 'primary' })}>
                <PackagePlus aria-hidden className="size-4" /> {promoting ? 'Creating…' : 'Promote to order'}
              </button>
            )}
            <button type="button" onClick={onEdit} disabled={ro} title={ro ? READONLY_NOTE : undefined} className={adminBtn({ variant: 'ghost' })}>
              <Pencil aria-hidden className="size-4" /> Edit details
            </button>
            <span className="ml-auto" />
            <ConfirmShred {...crud.shredProps(l.id, onClose)} variant="button" label="Delete" />
          </>
        )
      }
    >
      {l && (
        <div className="space-y-7">
          {/* pipeline stepper */}
          <section aria-label="Status">
            <p className="label mb-2 text-paper/55">Pipeline</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {LEAD_STATUSES.map((s, i) => (
                <span key={s.id} className="flex items-center gap-1.5">
                  {i > 0 && i < 3 && <ArrowRight aria-hidden className="size-3.5 text-paper/30" />}
                  {i === 3 && <span className="px-1 font-mono text-[10px] text-paper/40">or</span>}
                  <button
                    type="button"
                    aria-pressed={l.status === s.id}
                    disabled={ro}
                    onClick={() => onStatus(s.id)}
                    className={cn('min-h-11 border-2 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-[translate,box-shadow] duration-150 focus-ring active:translate-y-px', l.status === s.id ? cn(s.tone, 'border-ink shadow-[3px_3px_0_var(--color-paper)]') : 'border-paper/20 text-paper/65 can-hover:hover:border-paper/60')}
                  >
                    {s.label}
                  </button>
                </span>
              ))}
              <button type="button" aria-pressed={l.status === 'spam'} disabled={ro} onClick={() => onStatus('spam')} className={cn('ml-auto min-h-11 disabled:opacity-50 border-2 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em] focus-ring', l.status === 'spam' ? 'border-ink bg-hype text-paper' : 'border-transparent text-paper/45 can-hover:hover:text-hype')}>
                Spam
              </button>
            </div>
          </section>

          {/* contact */}
          <section className="border-2 border-ink bg-paper p-4 text-ink shadow-[5px_5px_0_var(--color-door)]">
            <dl className="grid grid-cols-[90px_1fr] gap-y-1.5 text-[14px]">
              <dt className="label pt-0.5 text-ink/50">Name</dt><dd className="font-semibold">{l.name || '—'}</dd>
              <dt className="label pt-0.5 text-ink/50">City</dt><dd>{l.city || '—'}</dd>
              <dt className="label pt-0.5 text-ink/50">Contact</dt><dd className="break-all font-mono text-[13px]">{l.contact || '—'}</dd>
              <dt className="label pt-0.5 text-ink/50">Source</dt>
              <dd className="font-mono text-[12.5px]">
                {l.src || '(direct)'}
                {l.source?.utm_campaign ? ` · ${l.source.utm_campaign}` : ''}
                {l.source?.landing ? <span className="block truncate text-ink/50">landed on {l.source.landing}</span> : null}
              </dd>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(adminBtn({ variant: 'door', size: 'sm' }), 'min-h-10')}><MessageCircle aria-hidden className="size-4" /> WhatsApp</a>}
              {l.contact.includes('@') && <a href={`mailto:${l.contact}`} className={cn(adminBtn({ variant: 'door', size: 'sm' }), 'min-h-10')}><Mail aria-hidden className="size-4" /> Email</a>}
            </div>
          </section>

          {l.message && (
            <section>
              <p className="label mb-2 text-paper/55">Message</p>
              <blockquote className="border-l-4 border-volt pl-4 text-[15px] leading-relaxed text-paper/85">{l.message}</blockquote>
            </section>
          )}

          {items.length > 0 && (
            <section>
              <p className="label mb-2 text-paper/55">Order lines</p>
              <OrderLines items={items} totals={totals} />
            </section>
          )}

          {l.kind === 'custom_request' && (
            <section>
              <p className="label mb-2 text-paper/55">Uploaded files</p>
              {files.length === 0 ? (
                <p className="text-[14px] text-paper/55">No files attached — ask for them on WhatsApp.</p>
              ) : (
                <ul className="space-y-1.5">
                  {files.map((f, i) => (
                    <li key={f.ref}>
                      {f.url ? (
                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 border-2 border-paper/20 px-3 text-[14px] text-paper focus-ring can-hover:hover:border-volt">
                          <FileText aria-hidden className="size-4 text-volt" /> File {i + 1}
                          <span className="truncate font-mono text-[11px] text-paper/45">{f.ref.split('/').pop()}</span>
                          <ExternalLink aria-hidden className="ml-auto size-4 shrink-0" />
                        </a>
                      ) : (
                        <span className="skeleton-tone block h-11 border-2 border-paper/10" aria-label="Signing link…" />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1.5 text-[12px] text-paper/45">Links are signed for 1 hour.</p>
            </section>
          )}

          {extra.length > 0 && (
            <section>
              <p className="label mb-2 text-paper/55">Details</p>
              <dl className="grid grid-cols-[minmax(90px,auto)_1fr] gap-x-4 gap-y-1 font-mono text-[12.5px]">
                {extra.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-paper/45">{k}</dt>
                    <dd className="break-words text-paper/85">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section>
            <label htmlFor="lead-notes" className="label mb-2 flex items-center gap-2 text-paper/55"><Sparkles aria-hidden className="size-3.5 text-volt" /> Owner notes</label>
            <textarea id="lead-notes" rows={4} value={notes} maxLength={2000} readOnly={ro} onChange={(e) => setNotes(e.target.value)} placeholder="Replied on WhatsApp, waiting for size…" className={cn(adminInput, 'resize-y leading-relaxed')} />
            <div className="mt-2 flex items-center gap-3">
              <button type="button" disabled={ro || notes === l.notes} onClick={() => onNotes(notes)} className={adminBtn({ variant: 'ghost', size: 'sm' })}>Save note</button>
              <span className="text-[12px] text-paper/40">{ro ? 'View only — your role can’t edit notes.' : 'Private — only the team sees this.'}</span>
            </div>
          </section>
        </div>
      )}
    </Drawer>
  )
}

export function OrderLines({ items, totals }: { items: CartItem[]; totals: CartTotals | null }) {
  return (
    <div className="border-2 border-paper/15">
      <ul className="divide-y-2 divide-paper/10">
        {items.map((it, i) => (
          <li key={it.key + i} className="flex items-center gap-3 p-3">
            <span className="grid size-10 shrink-0 place-items-center border-2 border-ink bg-volt font-mono text-[13px] font-bold text-ink">×{it.qty}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold">{it.name}</span>
              <span className="block truncate font-mono text-[11px] uppercase tracking-[0.08em] text-paper/50">{[it.variantLabel, it.size].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="font-mono text-[13px] tabular-nums">{it.unitPrice != null ? formatINR(it.unitPrice * it.qty) : 'On request'}</span>
          </li>
        ))}
      </ul>
      {totals && (
        <dl className="space-y-1 border-t-4 border-ink bg-paper p-3 font-mono text-[13px] text-ink">
          <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{formatINR(totals.subtotal)}</dd></div>
          {totals.savings > 0 && <div className="flex justify-between text-door"><dt>Bundle savings</dt><dd className="tabular-nums">−{formatINR(totals.savings)}</dd></div>}
          <div className="flex justify-between text-[15px] font-bold"><dt>Total{totals.hasPriceOnRequest ? ' (+ on request)' : ''}</dt><dd className="tabular-nums">{formatINR(totals.total)}</dd></div>
        </dl>
      )}
    </div>
  )
}
