'use client'
// P4b — Collections, Events & Partners, Instagram strip, Settings.
import { useState } from 'react'
import { z } from 'zod'
import { toast } from 'sonner'
import { ImagePlus } from 'lucide-react'
import type { Motif, SiteSettings } from '@/lib/types'
import { ArcMotif } from '@/components/fx/ArcMotif'
import { cn } from '@/lib/utils'
import { AdminPage, AdminPanel } from '../AdminPage'
import { adminBtn, adminPill } from '../ui'
import { explainDemo, explainReadOnly, getAdminClient, uploadProductImage, useCrud } from './data'
import {
  collectionCfg, eventCfg, instaCfg, partnershipCfg,
  type AdminCollection, type AdminEvent, type AdminInsta, type AdminPartnership,
} from './entities'
import { EntityManager } from './EntityManager'
import { ColorField, FormSection, NumberField, SandboxSwitch, SelectField, TagsField, TextArea, TextField, Toggle } from './kit'
import { newId, slugify } from './util'
import { saveSettingValue } from './settingsActions'
import { siteSettingsSchema } from './settingsSchemas'

const MOTIFS: Motif[] = ['smoke', 'walls', 'flames', 'waves', 'spiral', 'ribbons', 'speedlines']
const hex = z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a #RRGGBB colour')
const pub = (on: boolean) => <span className={adminPill(on ? 'lav' : 'muted')}>{on ? 'Live' : 'Hidden'}</span>

// ---------------------------------------------------------------- collections
const collectionSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase-with-dashes'),
  name: z.string().trim().min(2, 'Name it').max(60),
  jp: z.string().max(40),
  accentA: hex,
  accentB: hex,
  tagline: z.string().max(140),
  blurb: z.string().max(800),
})

function DoorPreview({ c }: { c: AdminCollection }) {
  return (
    <div className="relative mx-auto aspect-[3/4.4] w-full max-w-[220px] overflow-hidden border-4 border-ink shadow-[6px_6px_0_var(--color-paper)]" style={{ background: c.accentA, borderRadius: '110px 110px 0 0' }}>
      <ArcMotif motif={c.motif} colorA={c.accentA} colorB={c.accentB} animated className="absolute inset-0 size-full" title="" />
      <div className="absolute inset-x-3 bottom-3 border-2 border-ink bg-paper p-2 text-ink">
        <p className="font-display text-[24px] uppercase leading-[0.9]">{c.name || 'Arc name'}</p>
        <p className="font-jp text-[11px] font-bold opacity-60">{c.jp || '—'}</p>
      </div>
      <span className="absolute right-4 top-1/2 size-3 rounded-full border-2 border-ink" style={{ background: c.accentB }} />
    </div>
  )
}

export function CollectionsManager({ initial }: { initial: AdminCollection[] }) {
  const crud = useCrud(collectionCfg, initial, { perm: 'catalog.edit' })
  return (
    <AdminPage no="07" kicker={`Catalogue · ${crud.rows.length} arcs`} title={<>Arc <em>doors</em></>} jp="アーク · コレクション" description="Each collection is a door on the home page. Colours recolour the whole page when a visitor opens it." actions={<SandboxSwitch mode={crud.mode} readOnly={crud.readOnly} />}>
      <EntityManager<AdminCollection>
        crud={crud}
        caption="Collections"
        noun="collection"
        jp="アーク編集"
        reorderable
        wide
        searchText={(c) => `${c.name} ${c.slug} ${c.jp}`}
        blank={() => ({ slug: '', name: '', jp: '', group: 'anime', accentA: '#6D3BFF', accentB: '#FFE14D', motif: 'speedlines', tagline: '', blurb: '', order: crud.rows.length + 1, featured: false, published: true })}
        schema={collectionSchema}
        columns={[
          { id: 'sw', header: '', cell: (c) => <span className="flex"><span className="size-7 border-2 border-ink" style={{ background: c.accentA }} /><span className="-ml-2 size-7 border-2 border-ink" style={{ background: c.accentB }} /></span>, className: 'w-[64px]' },
          { id: 'name', header: 'Name', sortValue: (c) => c.name, cell: (c) => <span className="block leading-tight"><span className="font-semibold">{c.name}</span><span className="block font-jp text-[11px] text-paper/50">{c.jp}</span></span> },
          { id: 'motif', header: 'Motif', hideOnMobile: true, cell: (c) => <span className="font-mono text-[12px] text-paper/60">{c.motif}</span> },
          { id: 'flags', header: 'State', cell: (c) => <span className="flex gap-1">{pub(c.published)}{c.featured && <span className={adminPill('volt')}>Featured</span>}</span> },
        ]}
        form={(c, set, e, isNew) => (
          <div className="grid gap-8 md:grid-cols-[1fr_220px]">
            <div>
              <FormSection title="Identity" jp="名前">
                <TextField label="Name" value={c.name} error={e.name} onChange={(name) => set(isNew ? { name, slug: slugify(name) } : { name })} />
                <TextField label="JP subtitle" value={c.jp} error={e.jp} onChange={(jp) => set({ jp })} placeholder="呪術廻戦" />
                <TextField label="Slug" mono value={c.slug} error={e.slug} hint={isNew ? 'URL: /arc/<slug>' : 'Locked after creation (links depend on it).'} onChange={(slug) => isNew && set({ slug: slugify(slug) })} />
                <SelectField label="Group" value={c.group} onChange={(group) => set({ group })} options={[{ id: 'anime', label: 'Anime' }, { id: 'beyond', label: 'Beyond Anime' }]} />
              </FormSection>
              <FormSection title="Look" jp="色">
                <ColorField label="Accent A" value={c.accentA} error={e.accentA} onChange={(accentA) => set({ accentA })} />
                <ColorField label="Accent B" value={c.accentB} error={e.accentB} onChange={(accentB) => set({ accentB })} />
                <SelectField label="Motif" value={c.motif} onChange={(motif) => set({ motif })} options={MOTIFS.map((m) => ({ id: m, label: m }))} />
                <NumberField label="Order" value={c.order} onChange={(v) => set({ order: v ?? 0 })} />
              </FormSection>
              <FormSection title="Copy" jp="文章">
                <TextField className="sm:col-span-2" label="Tagline" value={c.tagline} error={e.tagline} maxLength={140} onChange={(tagline) => set({ tagline })} />
                <TextArea className="sm:col-span-2" label="Blurb" value={c.blurb} error={e.blurb} maxLength={800} onChange={(blurb) => set({ blurb })} />
                <TagsField className="sm:col-span-2" label="Sub-fandoms" hint="Beyond Anime chips (?f= filter)" value={c.subFandoms ?? []} onChange={(subFandoms) => set({ subFandoms })} />
                <Toggle label="Featured" checked={c.featured} onChange={(featured) => set({ featured })} />
                <Toggle label="Published" hint="Hidden arcs vanish from the site" checked={c.published} onChange={(published) => set({ published })} tone="door" />
              </FormSection>
            </div>
            <div className="md:sticky md:top-0 md:self-start">
              <p className="label mb-3 text-paper/55">Live door preview</p>
              <DoorPreview c={c} />
            </div>
          </div>
        )}
      />
    </AdminPage>
  )
}

// ---------------------------------------------------------------- events & partners
const eventSchema = z.object({
  name: z.string().trim().min(2, 'Name it').max(80),
  city: z.string().max(60),
  dateLabel: z.string().trim().min(2, 'Shown on the site — e.g. "21–28 Feb · dates to be confirmed"').max(80),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  confirmed: z.boolean(),
}).refine((e) => !e.confirmed || !!e.startDate, { message: 'Confirmed events need a start date', path: ['startDate'] })

const partnerSchema = z.object({ fest: z.string().trim().min(2, 'Fest name').max(80), role: z.string().max(80), years: z.string().max(40) })

export function EventsManager({ events, partners }: { events: AdminEvent[]; partners: AdminPartnership[] }) {
  const ev = useCrud(eventCfg, events, { perm: 'catalog.edit' })
  const pt = useCrud(partnershipCfg, partners, { perm: 'catalog.edit' })
  return (
    <AdminPage no="11" kicker="Catalogue · stalls & fests" title={<>Events &amp; <em>partners</em></>} jp="イベント · パートナー" description="Upcoming stalls feed “Catch us live”; partnerships feed the Fandom Partner timeline." actions={<SandboxSwitch mode={ev.mode} readOnly={ev.readOnly} />}>
      <AdminPanel index={0} title={<>Stalls &amp; <em className="accent">pop-ups</em></>} jp="イベント">
        <EntityManager<AdminEvent>
          crud={ev}
          caption="Events"
          noun="event"
          reorderable
          searchText={(e) => `${e.name} ${e.city} ${e.venue}`}
          blank={() => ({ id: newId('ev-'), name: '', venue: '', city: '', startDate: null, endDate: null, dateLabel: '', confirmed: false, kind: 'stall', status: 'upcoming', published: true, sortOrder: ev.rows.length + 1 })}
          schema={eventSchema}
          columns={[
            { id: 'name', header: 'Event', sortValue: (e) => e.name, cell: (e) => <span className="block leading-tight"><span className="font-semibold">{e.name}</span><span className="block text-[12.5px] text-paper/55">{[e.venue, e.city].filter(Boolean).join(' · ')}</span></span> },
            { id: 'date', header: 'Date label', cell: (e) => <span className="font-mono text-[12px]">{e.dateLabel}</span> },
            { id: 'st', header: 'State', cell: (e) => <span className="flex flex-wrap gap-1"><span className={adminPill(e.status === 'upcoming' ? 'volt' : 'muted')}>{e.status}</span>{e.confirmed ? <span className={adminPill('door')}>Confirmed</span> : <span className={adminPill('muted')}>TBC</span>}</span> },
          ]}
          form={(e, set, err) => (
            <>
              <FormSection title="Event" jp="イベント">
                <TextField label="Name" value={e.name} error={err.name} onChange={(name) => set({ name })} />
                <SelectField label="Kind" value={e.kind} onChange={(kind) => set({ kind })} options={[{ id: 'stall', label: 'Stall' }, { id: 'popup', label: 'Pop-up' }, { id: 'fest', label: 'Fest' }, { id: 'online', label: 'Online' }]} />
                <TextField label="Venue" value={e.venue} onChange={(venue) => set({ venue })} />
                <TextField label="City" value={e.city} error={err.city} onChange={(city) => set({ city })} />
              </FormSection>
              <FormSection title="Dates" jp="日程">
                <TextField className="sm:col-span-2" label="Date label (shown exactly)" value={e.dateLabel} error={err.dateLabel} onChange={(dateLabel) => set({ dateLabel })} placeholder="21–28 Feb · dates to be confirmed" />
                <TextField label="Start date" type="date" value={e.startDate ?? ''} error={err.startDate} onChange={(v) => set({ startDate: v || null })} />
                <TextField label="End date" type="date" value={e.endDate ?? ''} onChange={(v) => set({ endDate: v || null })} />
                <Toggle label="Dates confirmed" hint="Only confirmed + dated events get Event schema (Google rich results)" checked={e.confirmed} onChange={(confirmed) => set({ confirmed })} tone="door" />
                <SelectField label="Status" value={e.status} onChange={(status) => set({ status })} options={[{ id: 'upcoming', label: 'Upcoming' }, { id: 'past', label: 'Past' }]} />
                <Toggle label="Published" checked={e.published} onChange={(published) => set({ published })} />
              </FormSection>
            </>
          )}
        />
      </AdminPanel>
      <AdminPanel index={1} title={<>Fandom <em className="accent accent-lav">partnerships</em></>} jp="パートナー">
        <EntityManager<AdminPartnership>
          crud={pt}
          caption="Partnerships"
          noun="partnership"
          reorderable
          searchText={(p) => `${p.fest} ${p.institution} ${p.role}`}
          blank={() => ({ id: newId('pt-'), fest: '', institution: '', years: '', role: 'Fandom Partner', order: pt.rows.length + 1, published: true })}
          schema={partnerSchema}
          columns={[
            { id: 'fest', header: 'Fest', sortValue: (p) => p.fest, cell: (p) => <span className="block leading-tight"><span className="font-semibold">{p.fest}</span><span className="block text-[12.5px] text-paper/55">{p.institution}</span></span> },
            { id: 'role', header: 'Role', cell: (p) => <span className="text-[13px]">{p.role}{p.years ? ` · ${p.years}` : ''}</span> },
            { id: 'pub', header: 'State', hideOnMobile: true, cell: (p) => pub(p.published) },
          ]}
          form={(p, set, err) => (
            <FormSection title="Partnership" jp="提携">
              <TextField label="Fest" value={p.fest} error={err.fest} onChange={(fest) => set({ fest })} />
              <TextField label="Institution" value={p.institution} onChange={(institution) => set({ institution })} />
              <TextField label="Role" value={p.role} error={err.role} onChange={(role) => set({ role })} />
              <TextField label="Years" value={p.years} error={err.years} onChange={(years) => set({ years })} placeholder="2025 · 3×" />
              <TextArea className="sm:col-span-2" label="Detail" rows={2} value={p.detail ?? ''} onChange={(detail) => set({ detail })} />
              <Toggle label="Published" checked={p.published} onChange={(published) => set({ published })} />
            </FormSection>
          )}
        />
      </AdminPanel>
    </AdminPage>
  )
}

// ---------------------------------------------------------------- instagram
const instaSchema = z.object({
  url: z.string().regex(/^https:\/\/(www\.)?instagram\.com\//, 'Paste an instagram.com post link'),
  image: z.string().min(1, 'Upload or paste an image URL'),
  caption: z.string().max(220),
})

function ImageInput({ value, onChange, error, folder }: { value: string; onChange: (v: string) => void; error?: string; folder: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="sm:col-span-2">
      <div className="flex items-start gap-3">
        <div className={cn('grid aspect-square w-28 shrink-0 place-items-center overflow-hidden border-2', error ? 'border-hype' : 'border-paper/25', busy && 'skeleton-tone')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value ? <img src={value} alt="" className="size-full object-cover" /> : <ImagePlus aria-hidden className="size-6 text-paper/40" />}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <TextField label="Image URL" mono value={value} error={error} onChange={onChange} />
          <label className={adminBtn({ variant: 'ghost', size: 'sm', className: 'min-h-10 cursor-pointer' })}>
            <ImagePlus aria-hidden className="size-4" /> {busy ? 'Uploading…' : 'Upload image'}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="sr-only" disabled={busy} onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              if (!getAdminClient()) return explainDemo()
              setBusy(true)
              try { onChange(await uploadProductImage(f, folder)); toast.success('Image uploaded') } catch (err) { toast.error('Upload failed', { description: (err as Error).message }) }
              setBusy(false)
            }} />
          </label>
        </div>
      </div>
    </div>
  )
}

export { ImageInput }

export function InstagramManager({ initial }: { initial: AdminInsta[] }) {
  const crud = useCrud(instaCfg, initial, { perm: 'catalog.edit' })
  return (
    <AdminPage no="12" kicker={`Site · ${crud.rows.length} posts`} title={<>Insta <em>strip</em></>} jp="インスタ" description="Posts shown in the home Instagram strip. Empty = the designed “follow us” state. Nothing embeds Instagram's scripts." actions={<SandboxSwitch mode={crud.mode} readOnly={crud.readOnly} />}>
      <EntityManager
        crud={crud}
        caption="Posts"
        noun="post"
        reorderable
        searchText={(p) => p.caption}
        blank={() => ({ id: newId('ig-'), image: '', url: '', caption: '', order: crud.rows.length + 1, published: true })}
        schema={instaSchema}
        emptyBody="The home strip shows six manga frames and a follow button until you add posts."
        columns={[
          // eslint-disable-next-line @next/next/no-img-element
          { id: 'img', header: '', className: 'w-[72px]', cell: (p) => <span className="block size-12 overflow-hidden border-2 border-ink bg-tone-2">{p.image && <img src={p.image} alt="" className="size-full object-cover" />}</span> },
          { id: 'cap', header: 'Caption', cell: (p) => <span className="line-clamp-2 text-[13.5px]">{p.caption || '—'}</span> },
          { id: 'pub', header: 'State', cell: (p) => pub(p.published) },
        ]}
        form={(p, set, err) => (
          <FormSection title="Post" jp="投稿">
            <TextField className="sm:col-span-2" label="Post URL" mono value={p.url} error={err.url} onChange={(url) => set({ url })} placeholder="https://www.instagram.com/p/…" />
            <ImageInput value={p.image} error={err.image} onChange={(image) => set({ image })} folder="insta" />
            <TextArea className="sm:col-span-2" label="Caption" rows={2} maxLength={220} value={p.caption} error={err.caption} onChange={(caption) => set({ caption })} />
            <Toggle label="Published" checked={p.published} onChange={(published) => set({ published })} />
          </FormSection>
        )}
      />
    </AdminPage>
  )
}

// ---------------------------------------------------------------- settings
// Same schema the server action re-validates with (settingsSchemas.ts → saveSettingValue('site')).
const settingsSchema = siteSettingsSchema

export function SettingsManager({ initial, updatedAt: loadedAt = null }: { initial: SiteSettings; updatedAt?: string | null }) {
  const crud = useCrud(collectionCfg, [], { perm: 'settings.edit' })
  const mode = crud.mode
  const readOnly = crud.readOnly
  const [s, setS] = useState<SiteSettings>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  // row version the form is based on: a teammate's newer save is never overwritten silently
  const [version, setVersion] = useState<string | null>(loadedAt)
  const set = (p: Partial<SiteSettings>) => { setS((x) => ({ ...x, ...p })); setDirty(true) }

  const save = async () => {
    const r = settingsSchema.safeParse(s)
    if (!r.success) {
      const out: Record<string, string> = {}
      r.error.issues.forEach((i) => { out[String(i.path[0])] ??= i.message })
      return setErrors(out)
    }
    setErrors({})
    if (mode === 'demo') return explainDemo()
    if (readOnly) return explainReadOnly()
    if (mode === 'sandbox') { setDirty(false); return toast.success('Settings saved', { description: 'Sandbox — local only.' }) }
    setSaving(true)
    // Server action: re-checks settings.edit, re-validates, writes, then expires the 'settings' tag AND every
    // prerendered route (the hero + banner live in static HTML). The old browser upsert + fire-and-forget
    // revalidate could report "live" while the cache was never expired.
    const res = await saveSettingValue('site', r.data, { expectedUpdatedAt: version }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'Network error' }))
    setSaving(false)
    if (!res.ok) return toast.error('Could not save settings', { description: res.error })
    setS({ ...s, ...(res.value as SiteSettings) })
    setVersion(res.updatedAt)
    setDirty(false)
    toast.success('Settings saved — live on the site now', { description: 'Reload the home page to see it.' })
  }

  return (
    <AdminPage
      no="13"
      kicker="Site · words on the door"
      title={<>Site <em>settings</em></>}
      jp="設定"
      description="Hero copy, the announcement banner, ticker words and the WhatsApp number orders go to."
      actions={<>
        <SandboxSwitch mode={mode} readOnly={readOnly} />
        <button type="button" onClick={save} disabled={saving || readOnly} className={adminBtn()}>{saving ? 'Saving…' : 'Save settings'}</button>
        {dirty && <span className="label text-[10px] text-volt">● Unsaved</span>}
      </>}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <AdminPanel index={0} title="Hero & banner" jp="ヒーロー">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Hero kicker" value={s.heroKicker} error={errors.heroKicker} onChange={(heroKicker) => set({ heroKicker })} />
            <TextField label="Banner text" value={s.bannerText} error={errors.bannerText} onChange={(bannerText) => set({ bannerText })} />
            <TextField className="sm:col-span-2" label="Hero title (H1)" value={s.heroTitle} error={errors.heroTitle} maxLength={90} onChange={(heroTitle) => set({ heroTitle })} hint="Keep “anime merch” in it — it's the main keyword." />
            <TextArea className="sm:col-span-2" label="Hero subline" rows={3} maxLength={260} value={s.heroSub} error={errors.heroSub} onChange={(heroSub) => set({ heroSub })} />
            <TagsField className="sm:col-span-2" label="Ticker words" value={s.tickerWords} error={errors.tickerWords} onChange={(tickerWords) => set({ tickerWords })} hint="Enter or comma to add. JP words welcome." />
            <TextField label="WhatsApp order number" mono value={s.whatsapp} error={errors.whatsapp} onChange={(whatsapp) => set({ whatsapp })} placeholder="+91 98765 43210" hint="Used for every Buy on WhatsApp button. Include the country code, e.g. +91 98765 43210." />
            <TextField label="Instagram URL" mono value={s.instagram} error={errors.instagram} onChange={(instagram) => set({ instagram })} />
          </div>
        </AdminPanel>
        <AdminPanel index={1} title="Preview" jp="プレビュー" tone="paper" shadow="door" bodyClassName="p-0 overflow-hidden">
          <div className="bg-volt px-4 py-2 text-center font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink">{s.bannerText || '—'}</div>
          <div className="bg-ink p-5 text-paper">
            <p className="label text-volt">{s.heroKicker}</p>
            <p className="h-display mt-2 text-[44px]">{s.heroTitle}</p>
            <p className="mt-3 text-[13.5px] leading-relaxed text-paper/70">{s.heroSub}</p>
          </div>
          <div className="-mx-2 -rotate-2 overflow-hidden border-y-4 border-ink bg-volt py-2">
            <p className="whitespace-nowrap font-display text-[22px] uppercase text-ink">{[...s.tickerWords, ...s.tickerWords].join(' ✦ ')}</p>
          </div>
          <div className="h-4" />
        </AdminPanel>
      </div>
    </AdminPage>
  )
}
