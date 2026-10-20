'use client'
// /admin/careers — job posts CRUD + applications inbox. Owner: CAREERS.
// - Applications: role DROPDOWN ("All roles" + every post with counts), status chips, table of responses,
//   detail drawer (contact, links, answers, résumé download via a 1-hour signed URL, status pipeline, notes),
//   "Download CSV" for the selected role (answers flattened into columns + a 7-day résumé link),
//   live toast on new applications (Supabase Realtime, RLS-filtered), #69 shred + undo (superadmin only).
// - Jobs: EntityManager (markdown editor with preview, one-per-line lists, questions builder).
// Rows load in the browser under RLS (has_perm('careers.edit')); every write refreshes the public cache.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Briefcase, Download, ExternalLink, FileText, IdCard, Inbox, Link2, Mail, MessageCircle, Radio, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AdminPage, AdminPanel } from '../AdminPage'
import { AdminSkeleton, EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { ConfirmShred } from '../ConfirmShred'
import { DataTable } from '../DataTable'
import { READONLY_NOTE } from '../AdminContext'
import { adminBtn, adminInput, adminPill, type PillTone } from '../ui'
import { EntityManager } from '../crud/EntityManager'
import { Chips, Drawer, FormSection, SandboxSwitch, SelectField, TextField, Toggle } from '../crud/kit'
import { downloadText, getAdminClient, slugify, toCsv, useCrud, type Crud, type CrudConfig } from '../crud/data'
import { fmtDate, waFor } from '../crud/util'
import { revalidateCareers } from './actions'
import { LinesField, MarkdownField, QuestionsBuilder } from './JobFields'
import {
  APP_STATUSES, JOB_STATUSES, JOB_TYPES, appStatusMeta, applicationFromRow, applicationToRow, jobFromRow, jobSchema, jobToRow, jobTypeLabel,
  type AppStatus, type Job, type JobApplication,
} from '@/components/careers/model'

// ---------------------------------------------------------------- configs
const jobCfg: CrudConfig<Job> = {
  table: 'jobs',
  pk: 'id',
  order: { column: 'created_at', ascending: false },
  label: (j) => j.title || 'Job',
  fromRow: jobFromRow,
  toRow: jobToRow,
}

const appCfg: CrudConfig<JobApplication> = {
  table: 'job_applications',
  pk: 'id',
  order: { column: 'created_at', ascending: false },
  label: (a) => a.name || 'Application',
  fromRow: applicationFromRow,
  toRow: applicationToRow,
}

const STATUS_PILL: Record<Job['status'], PillTone> = { draft: 'muted', open: 'volt', closed: 'paper' }
const APP_TONE_BG: Record<string, string> = { volt: 'bg-volt text-ink', lav: 'bg-lav text-ink', pink: 'bg-pink text-ink', door: 'bg-door text-paper', muted: 'bg-tone-2 text-paper' }

/** Refresh /careers after every write that reached the database (best effort). */
function useRevalidating<T>(crud: Crud<T>): Crud<T> {
  return useMemo(() => {
    const live = crud.mode === 'live'
    const refresh = () => {
      if (live) void revalidateCareers().catch(() => undefined)
    }
    return {
      ...crud,
      save: async (item, o) => {
        const ok = await crud.save(item, o)
        if (ok) refresh()
        return ok
      },
      update: async (key, fn, o) => {
        const ok = await crud.update(key, fn, o)
        if (ok) refresh()
        return ok
      },
      shredProps: (key, after) => {
        const p = crud.shredProps(key, after)
        return { ...p, onCommit: async () => { await p.onCommit(); refresh() } }
      },
    }
  }, [crud])
}

const blankJob = (): Job => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : '',
  slug: '', title: '', team: '', location: '', type: 'full-time', isRemote: false, description: '',
  responsibilities: [], requirements: [], perks: [], questions: [], status: 'draft',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
})

type Tab = 'apps' | 'jobs'

export function CareersManager() {
  const jobsBase = useCrud(jobCfg, [], { perm: 'careers.edit' })
  const jobs = useRevalidating(jobsBase)
  const apps = useCrud(appCfg, [], { perm: 'careers.edit' })
  const [tab, setTab] = useState<Tab>('apps')
  const [openId, setOpenId] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const { reload: reloadApps } = apps

  // realtime: toast + refresh when a new application arrives (RLS: only careers.edit members receive it)
  useEffect(() => {
    if (apps.mode !== 'live') return
    const sb = getAdminClient()
    if (!sb) return
    const ch = sb
      .channel('admin-careers-applications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'job_applications' }, (payload) => {
        const a = applicationFromRow((payload.new ?? {}) as Record<string, unknown>)
        toast.success(`New application · ${a.jobTitle || 'a role'}`, {
          description: [a.name, a.city].filter(Boolean).join(' · '),
          action: { label: 'Open', onClick: () => { setTab('apps'); setOpenId(a.id) } },
        })
        reloadApps()
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))
    return () => {
      setLive(false)
      void sb.removeChannel(ch)
    }
  }, [apps.mode, reloadApps])

  const newCount = apps.rows.filter((a) => a.status === 'new').length
  const openJobs = jobs.rows.filter((j) => j.status === 'open').length

  return (
    <AdminPage
      no="16"
      kicker={`Site · ${openJobs} open role${openJobs === 1 ? '' : 's'} · ${newCount} new`}
      title={<>Careers &amp; <em>crew</em></>}
      jp="採用 · 応募"
      description="Post roles for /careers and read every application. Pick a role to see its responses, move people along the pipeline and download them as CSV."
      actions={
        <>
          {apps.mode === 'live' && (
            <span className={cn(adminPill(live ? 'volt' : 'muted'), 'min-h-8')} title={live ? 'New applications appear here instantly' : 'Connecting to live updates…'}>
              <Radio aria-hidden className={cn('size-3.5', live && 'motion-safe:animate-pulse')} /> {live ? 'Live' : 'Connecting'}
            </span>
          )}
          <SandboxSwitch mode={jobs.mode} readOnly={jobs.readOnly} />
          <a href="/careers" target="_blank" rel="noopener noreferrer" className={adminBtn({ variant: 'ghost' })}>
            <ExternalLink aria-hidden className="size-4" /> View /careers
          </a>
        </>
      }
      toolbar={
        <div role="tablist" aria-label="Careers sections" className="admin-rise flex gap-2" style={{ ['--d' as string]: '60ms' }}>
          {([
            { id: 'apps' as const, label: 'Applications', icon: Inbox, count: apps.rows.length, badge: newCount },
            { id: 'jobs' as const, label: 'Job posts', icon: Briefcase, count: jobs.rows.length, badge: 0 },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'relative inline-flex min-h-11 items-center gap-2 border-2 px-4 font-mono text-[11.5px] font-bold uppercase tracking-[0.12em] transition-[background-color,color,box-shadow] duration-150 focus-ring',
                tab === t.id ? 'border-ink bg-paper text-ink shadow-[4px_4px_0_var(--color-door)]' : 'border-paper/20 text-paper/70 can-hover:hover:border-paper/60 can-hover:hover:text-paper',
              )}
            >
              <t.icon aria-hidden className="size-4" />
              {t.label}
              <span className="tabular-nums opacity-60">{t.count}</span>
              {t.badge > 0 && <span className="absolute -right-2 -top-2 grid min-w-5 place-items-center border-2 border-ink bg-volt px-1 text-[10px] text-ink">{t.badge}</span>}
            </button>
          ))}
        </div>
      }
    >
      {tab === 'apps' ? (
        <ApplicationsView apps={apps} jobs={jobs.rows} jobsReady={jobs.status === 'ready'} openId={openId} setOpenId={setOpenId} onPostJob={() => setTab('jobs')} />
      ) : (
        <JobsView jobs={jobs} apps={apps.rows} />
      )}
    </AdminPage>
  )
}

// ---------------------------------------------------------------- applications
function ApplicationsView({
  apps, jobs, jobsReady, openId, setOpenId, onPostJob,
}: {
  apps: Crud<JobApplication>
  jobs: Job[]
  jobsReady: boolean
  openId: string | null
  setOpenId: (id: string | null) => void
  onPostJob: () => void
}) {
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState<'all' | AppStatus>('all')
  const [exporting, setExporting] = useState(false)

  const countByJob = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of apps.rows) m.set(a.jobId, (m.get(a.jobId) ?? 0) + 1)
    return m
  }, [apps.rows])
  // roles: every post (even with 0 responses) + any job id only seen on applications
  const roleOptions = useMemo(() => {
    const seen = new Map<string, { id: string; label: string; status?: Job['status'] }>()
    for (const j of jobs) seen.set(j.id, { id: j.id, label: j.title || '(untitled)', status: j.status })
    for (const a of apps.rows) if (!seen.has(a.jobId)) seen.set(a.jobId, { id: a.jobId, label: a.jobTitle || '(removed role)' })
    return [...seen.values()]
  }, [jobs, apps.rows])

  const inRole = useMemo(() => (role === 'all' ? apps.rows : apps.rows.filter((a) => a.jobId === role)), [apps.rows, role])
  const shown = useMemo(() => (status === 'all' ? inRole : inRole.filter((a) => a.status === status)), [inRole, status])
  const roleLabel = role === 'all' ? 'All roles' : roleOptions.find((r) => r.id === role)?.label ?? 'Role'
  const open = apps.rows.find((a) => a.id === openId) ?? null

  const setAppStatus = useCallback((id: string, s: AppStatus) => {
    const a = apps.rows.find((x) => x.id === id)
    if (!a || a.status === s) return
    void apps.update(id, (x) => ({ ...x, status: s }), { success: `${a.name || 'Applicant'} → ${appStatusMeta(s).label}` })
  }, [apps])

  const exportCsv = async () => {
    if (!shown.length) return toast('Nothing to export for this selection')
    setExporting(true)
    try {
      // 7-day signed résumé links (RLS: careers.edit can read the private bucket)
      const sb = getAdminClient()
      const paths = shown.map((a) => a.resumePath).filter((p): p is string => !!p)
      const links = new Map<string, string>()
      if (sb && paths.length) {
        const { data } = await sb.storage.from('careers').createSignedUrls(paths, 7 * 24 * 60 * 60)
        for (const d of data ?? []) if (d.path && d.signedUrl) links.set(d.path, d.signedUrl)
      }
      // flatten answers: one column per question label (union across the selection, stable order)
      const qCols: string[] = []
      for (const a of shown) for (const x of a.answers) if (!qCols.includes(x.label)) qCols.push(x.label)
      const rows = shown.map((a) => {
        const base: Record<string, unknown> = {
          applied_at: a.createdAt, role: a.jobTitle, status: a.status, name: a.name, email: a.email, phone: a.phone, city: a.city,
          portfolio: a.portfolioUrl, linkedin: a.linkedinUrl, resume_file: a.resumeName,
          resume_link_7_days: a.resumePath ? links.get(a.resumePath) ?? '(sign failed — open in admin)' : '',
        }
        for (const label of qCols) base[`Q: ${label}`] = a.answers.find((x) => x.label === label)?.value ?? ''
        base.notes = a.notes
        base.id = a.id
        return base
      })
      const slug = role === 'all' ? 'all-roles' : slugify(roleLabel) || 'role'
      downloadText(`escape-door-applications-${slug}${status === 'all' ? '' : `-${status}`}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows))
      toast.success(`Exported ${rows.length} application${rows.length === 1 ? '' : 's'}`, { description: paths.length ? 'Résumé links in the file work for 7 days.' : undefined })
    } catch (e) {
      toast.error('Export failed', { description: e instanceof Error ? e.message : 'Try again.' })
    } finally {
      setExporting(false)
    }
  }

  if (apps.status === 'loading' && apps.rows.length === 0) return <AdminSkeleton variant="table" rows={6} />
  if (apps.status === 'error') return <ErrorState title="The door is jammed" message={`${apps.error ?? 'Unknown error'} — if this is the first visit, ask the superadmin to run supabase/migrations/0007_careers.sql.`} onRetry={apps.reload} />

  return (
    <>
      <AdminPanel index={0} title={<>Applications <em className="accent">inbox</em></>} jp="応募一覧">
        <div className="mb-4 grid gap-3 md:grid-cols-[minmax(220px,340px)_1fr] md:items-end">
          <label className="block min-w-0">
            <span className="label mb-1.5 block text-paper/70">Role</span>
            <select value={role} onChange={(e) => { setRole(e.target.value); setOpenId(null) }} className={cn(adminInput, 'cursor-pointer font-semibold')}>
              <option value="all" className="bg-ink">All roles ({apps.rows.length})</option>
              {roleOptions.map((r) => (
                <option key={r.id} value={r.id} className="bg-ink">
                  {r.label} ({countByJob.get(r.id) ?? 0}){r.status && r.status !== 'open' ? ` · ${r.status}` : ''}
                </option>
              ))}
            </select>
          </label>
          <Chips
            label="Application status"
            value={status}
            onChange={setStatus}
            options={[{ id: 'all' as const, label: 'All', count: inRole.length }, ...APP_STATUSES.map((s) => ({ id: s.id, label: s.label, count: inRole.filter((a) => a.status === s.id).length }))]}
          />
        </div>

        {apps.rows.length === 0 ? (
          <EmptyState
            title="No applications yet"
            body={jobsReady && jobs.some((j) => j.status === 'open') ? 'Your open roles are live on /careers — applications appear here the moment someone applies.' : 'Post a role and set it to Open — it goes live on /careers and responses land here.'}
            action={<button type="button" onClick={onPostJob} className={adminBtn()}><Briefcase aria-hidden className="size-4" /> Go to job posts</button>}
          />
        ) : (
          <DataTable<JobApplication>
            caption={`Applications · ${roleLabel}`}
            rows={shown}
            rowKey={(a) => a.id}
            onRowClick={(a) => setOpenId(a.id)}
            selectedKey={openId}
            initialSort={{ id: 'at', dir: 'desc' }}
            search={{ placeholder: 'Search name, email, city…', text: (a) => `${a.name} ${a.email} ${a.phone} ${a.city} ${a.notes}` }}
            toolbar={
              <button type="button" onClick={exportCsv} disabled={exporting || !shown.length} className={adminBtn({ variant: 'door' })}>
                <Download aria-hidden className="size-4" /> {exporting ? 'Preparing…' : `Download CSV (${shown.length})`}
              </button>
            }
            empty={<EmptyState compact mood="peek" sfx="…?" title="No responses here" body={`No ${status === 'all' ? '' : `${appStatusMeta(status).label.toLowerCase()} `}applications for ${roleLabel}.`} />}
            columns={[
              { id: 'name', header: 'Applicant', sortValue: (a) => a.name, cell: (a) => (
                <span className="block min-w-0 leading-tight">
                  <span className="block truncate font-semibold">{a.name}</span>
                  <span className="block truncate text-[12.5px] text-paper/55">{a.email}</span>
                </span>
              ) },
              { id: 'phone', header: 'Phone', hideOnMobile: false, cell: (a) => <span className="font-mono text-[12.5px]">{a.phone || '—'}</span> },
              ...(role === 'all' ? [{ id: 'role', header: 'Role', sortValue: (a: JobApplication) => a.jobTitle, cell: (a: JobApplication) => <span className="text-[13px]">{a.jobTitle}</span> }] : []),
              { id: 'status', header: 'Status', sortValue: (a) => APP_STATUSES.findIndex((s) => s.id === a.status), cell: (a) => <span className={adminPill(appStatusMeta(a.status).tone as PillTone)}>{appStatusMeta(a.status).label}</span> },
              { id: 'at', header: 'Applied', sortValue: (a) => a.createdAt, cell: (a) => <span className="font-mono text-[12px] text-paper/70">{fmtDate(a.createdAt)}</span> },
            ]}
            rowActions={(a) => <ConfirmShred {...appShred(apps, a)} />}
          />
        )}
      </AdminPanel>

      <ApplicationDrawer app={open} crud={apps} onClose={() => setOpenId(null)} onStatus={setAppStatus} />
    </>
  )
}

/** Shred props for an application: after the row delete, also remove the résumé file (superadmin, best effort). */
function appShred(apps: Crud<JobApplication>, a: JobApplication, after?: () => void) {
  const p = apps.shredProps(a.id, after)
  return {
    ...p,
    onCommit: async () => {
      await p.onCommit()
      if (apps.mode === 'live' && a.resumePath) {
        try { await getAdminClient()?.storage.from('careers').remove([a.resumePath]) } catch { /* file stays; harmless */ }
      }
    },
  }
}

function ApplicationDrawer({ app, crud, onClose, onStatus }: { app: JobApplication | null; crud: Crud<JobApplication>; onClose: () => void; onStatus: (id: string, s: AppStatus) => void }) {
  const [notes, setNotes] = useState('')
  const [resume, setResume] = useState<{ state: 'idle' | 'loading' | 'ready' | 'error'; url?: string }>({ state: 'idle' })
  const ro = crud.readOnly

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync the notes draft when another application opens
    setNotes(app?.notes ?? '')
  }, [app?.id, app?.notes])

  // pre-sign the résumé link while the drawer opens (a click after an await would be popup-blocked)
  useEffect(() => {
    let alive = true
    const path = app?.resumePath
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the loading state while the link is signed
    setResume({ state: path ? 'loading' : 'idle' })
    if (path) {
      const sb = getAdminClient()
      if (!sb) { setResume({ state: 'error' }); return }
      sb.storage.from('careers').createSignedUrl(path, 60 * 60, { download: app?.resumeName || true })
        .then(({ data }) => alive && setResume(data?.signedUrl ? { state: 'ready', url: data.signedUrl } : { state: 'error' }))
        .catch(() => alive && setResume({ state: 'error' }))
    }
    return () => { alive = false }
  }, [app?.id, app?.resumePath, app?.resumeName])

  const a = app
  const wa = a ? waFor(a.phone) : null
  return (
    <Drawer
      open={!!a}
      onClose={onClose}
      title={a?.name || 'Application'}
      jp={a ? `${a.jobTitle} · ${fmtDate(a.createdAt)}` : undefined}
      footer={a && (
        <>
          <a href={`mailto:${a.email}?subject=${encodeURIComponent(`Your application — ${a.jobTitle} · The Escape Door`)}`} className={adminBtn({ variant: 'primary' })}>
            <Mail aria-hidden className="size-4" /> Reply by email
          </a>
          <span className="ml-auto" />
          <ConfirmShred {...appShred(crud, a, onClose)} variant="button" label="Delete" />
        </>
      )}
    >
      {a && (
        <div className="space-y-7">
          <section aria-label="Status">
            <p className="label mb-2 text-paper/55">Pipeline</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {APP_STATUSES.map((s, i) => (
                <span key={s.id} className="flex items-center gap-1.5">
                  {i > 0 && i < 4 && <ArrowRight aria-hidden className="size-3.5 text-paper/30" />}
                  {i === 4 && <span className="px-1 font-mono text-[10px] text-paper/40">or</span>}
                  <button
                    type="button"
                    aria-pressed={a.status === s.id}
                    disabled={ro}
                    title={ro ? READONLY_NOTE : undefined}
                    onClick={() => onStatus(a.id, s.id)}
                    className={cn(
                      'min-h-11 border-2 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-[translate,box-shadow] duration-150 focus-ring active:translate-y-px disabled:opacity-50',
                      a.status === s.id ? cn(APP_TONE_BG[s.tone], 'border-ink shadow-[3px_3px_0_var(--color-paper)]') : 'border-paper/20 text-paper/65 can-hover:hover:border-paper/60',
                    )}
                  >
                    {s.label}
                  </button>
                </span>
              ))}
            </div>
          </section>

          <section className="border-2 border-ink bg-paper p-4 text-ink shadow-[5px_5px_0_var(--color-door)]">
            <dl className="grid grid-cols-[90px_1fr] gap-y-1.5 text-[14px]">
              <dt className="label pt-0.5 text-ink/50">Role</dt><dd className="font-semibold">{a.jobTitle}</dd>
              <dt className="label pt-0.5 text-ink/50">Email</dt><dd className="break-all font-mono text-[13px]">{a.email}</dd>
              <dt className="label pt-0.5 text-ink/50">Phone</dt><dd className="font-mono text-[13px]">{a.phone || '—'}</dd>
              <dt className="label pt-0.5 text-ink/50">City</dt><dd>{a.city || '—'}</dd>
              <dt className="label pt-0.5 text-ink/50">Applied</dt><dd className="font-mono text-[13px]">{fmtDate(a.createdAt)}</dd>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(adminBtn({ variant: 'door', size: 'sm' }), 'min-h-10')}><MessageCircle aria-hidden className="size-4" /> WhatsApp</a>}
              {a.portfolioUrl && <a href={a.portfolioUrl} target="_blank" rel="noopener noreferrer nofollow" className={cn(adminBtn({ variant: 'door', size: 'sm' }), 'min-h-10')}><Link2 aria-hidden className="size-4" /> Portfolio</a>}
              {a.linkedinUrl && <a href={a.linkedinUrl} target="_blank" rel="noopener noreferrer nofollow" className={cn(adminBtn({ variant: 'door', size: 'sm' }), 'min-h-10')}><IdCard aria-hidden className="size-4" /> LinkedIn</a>}
            </div>
          </section>

          <section>
            <p className="label mb-2 text-paper/55">Résumé</p>
            {!a.resumePath ? (
              <p className="text-[14px] text-paper/55">No file — they applied with links only.</p>
            ) : resume.state === 'ready' ? (
              <a href={resume.url} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center gap-2 border-2 border-paper/20 px-3 text-[14px] text-paper focus-ring can-hover:hover:border-volt">
                <FileText aria-hidden className="size-5 text-volt" />
                <span className="min-w-0 flex-1 truncate">{a.resumeName || 'Résumé'}</span>
                <Download aria-hidden className="size-4 shrink-0" />
              </a>
            ) : resume.state === 'error' ? (
              <p role="alert" className="text-[14px] text-hype">Couldn’t sign the download link. Check your permission (Careers) and reopen.</p>
            ) : (
              <span className="skeleton-tone block h-12 border-2 border-paper/10" aria-label="Signing link…" />
            )}
            {a.resumePath && <p className="mt-1.5 text-[12px] text-paper/45">Link works for 1 hour.</p>}
          </section>

          <section>
            <p className="label mb-2 text-paper/55">Answers</p>
            {a.answers.length === 0 ? (
              <p className="text-[14px] text-paper/55">This role had no extra questions (or they were optional and skipped).</p>
            ) : (
              <dl className="space-y-4">
                {a.answers.map((x) => (
                  <div key={x.id || x.label}>
                    <dt className="text-[13px] font-bold text-paper/70">{x.label}</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words border-l-4 border-volt pl-3 text-[15px] leading-relaxed text-paper/90">
                      {/^https?:\/\//.test(x.value) ? <a href={x.value} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-volt underline-offset-4">{x.value}</a> : x.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section>
            <label htmlFor="app-notes" className="label mb-2 flex items-center gap-2 text-paper/55"><Sparkles aria-hidden className="size-3.5 text-volt" /> Team notes</label>
            <textarea id="app-notes" rows={4} value={notes} maxLength={4000} readOnly={ro} onChange={(e) => setNotes(e.target.value)} placeholder="Strong portfolio — call on Friday…" className={cn(adminInput, 'resize-y leading-relaxed')} />
            <div className="mt-2 flex items-center gap-3">
              <button type="button" disabled={ro || notes === a.notes} onClick={() => crud.update(a.id, (x) => ({ ...x, notes }), { success: 'Note saved' })} className={adminBtn({ variant: 'ghost', size: 'sm' })}>Save note</button>
              <span className="text-[12px] text-paper/40">{ro ? 'View only — your role can’t edit notes.' : 'Private — only the team sees this.'}</span>
            </div>
          </section>
        </div>
      )}
    </Drawer>
  )
}

// ---------------------------------------------------------------- job posts
function JobsView({ jobs, apps }: { jobs: Crud<Job>; apps: JobApplication[] }) {
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of apps) m.set(a.jobId, (m.get(a.jobId) ?? 0) + 1)
    return m
  }, [apps])

  return (
    <AdminPanel index={0} title={<>Job <em className="accent accent-lav">posts</em></>} jp="求人">
      <EntityManager<Job>
        crud={jobs}
        caption="Job posts"
        noun="job"
        jp="求人"
        wide
        searchText={(j) => `${j.title} ${j.team} ${j.location} ${j.status}`}
        blank={blankJob}
        schema={jobSchema}
        emptyBody="Post your first role. Drafts stay private; set it to Open to publish it on /careers."
        beforeSave={(d) => {
          const clash = jobs.rows.find((j) => j.slug === d.slug && j.id !== d.id)
          if (clash) {
            toast.error('That URL is taken', { description: `“/careers/${d.slug}” already belongs to “${clash.title}”. Change the slug.` })
            return false
          }
          return true
        }}
        columns={[
          { id: 'title', header: 'Role', sortValue: (j) => j.title, cell: (j) => (
            <span className="block leading-tight">
              <span className="font-semibold">{j.title || '(untitled)'}</span>
              <span className="block text-[12.5px] text-paper/55">{[j.team, j.location, j.isRemote ? 'remote OK' : ''].filter(Boolean).join(' · ') || '—'}</span>
            </span>
          ) },
          { id: 'type', header: 'Type', hideOnMobile: true, cell: (j) => <span className="font-mono text-[12px]">{jobTypeLabel(j.type)}</span> },
          { id: 'status', header: 'Status', sortValue: (j) => j.status, cell: (j) => <span className={adminPill(STATUS_PILL[j.status])}>{j.status}</span> },
          { id: 'apps', header: 'Responses', align: 'right', sortValue: (j) => counts.get(j.id) ?? 0, cell: (j) => <span className="font-mono text-[13px] font-bold tabular-nums">{counts.get(j.id) ?? 0}</span> },
          { id: 'link', header: <span className="sr-only">Public link</span>, hideOnMobile: true, cell: (j) => (j.status === 'open' && j.slug ? (
            <a href={`/careers/${j.slug}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex min-h-10 items-center gap-1 font-mono text-[11px] uppercase tracking-[0.1em] text-volt underline-offset-4 focus-ring can-hover:hover:underline">
              Live <ExternalLink aria-hidden className="size-3.5" />
            </a>
          ) : null) },
        ]}
        form={(j, set, err, isNew) => (
          <div key={j.id}>
            <FormSection title="The role" jp="職種">
              <TextField
                className="sm:col-span-2"
                label="Job title"
                value={j.title}
                error={err.title}
                maxLength={120}
                placeholder="Graphic designer (merch)"
                onChange={(title) => set(isNew && (!j.slug || j.slug === slugify(j.title)) ? { title, slug: slugify(title) } : { title })}
              />
              <TextField label="URL slug" mono value={j.slug} error={err.slug} maxLength={80} hint={j.slug ? `/careers/${j.slug}` : 'Fills in from the title'} onChange={(v) => set({ slug: slugify(v) })} />
              <TextField label="Team" value={j.team} error={err.team} maxLength={60} placeholder="Design · Print · Stalls · Content" onChange={(team) => set({ team })} />
              <SelectField label="Type" value={j.type} onChange={(type) => set({ type })} options={JOB_TYPES.map((t) => ({ id: t.id, label: t.label }))} />
              <TextField label="Location" value={j.location} error={err.location} maxLength={120} placeholder="City, State" onChange={(location) => set({ location })} />
              <div className="sm:col-span-2">
                <Toggle label="Remote OK" hint="Shows “Remote OK” and marks the post as remote-friendly for Google Jobs" checked={j.isRemote} onChange={(isRemote) => set({ isRemote })} tone="door" />
              </div>
            </FormSection>

            <FormSection title="Description" jp="説明">
              <MarkdownField value={j.description} error={err.description} onChange={(description) => set({ description })} />
              <LinesField label="What you’ll do" value={j.responsibilities} error={err.responsibilities} placeholder={'Design two tee drops a month\nPrep print files for the press'} onChange={(responsibilities) => set({ responsibilities })} />
              <LinesField label="What we’re looking for" value={j.requirements} error={err.requirements} placeholder={'A portfolio of illustration or merch work\nComfortable in Illustrator or Procreate'} onChange={(requirements) => set({ requirements })} />
              <LinesField label="Perks" value={j.perks} error={err.perks} placeholder="Only list perks you really offer" onChange={(perks) => set({ perks })} />
            </FormSection>

            <FormSection title="Application questions" jp="質問">
              <QuestionsBuilder value={j.questions} errors={err} onChange={(questions) => set({ questions })} />
            </FormSection>

            <FormSection title="Publish" jp="公開">
              <SelectField label="Status" value={j.status} onChange={(status) => set({ status })} options={JOB_STATUSES.map((s) => ({ id: s.id, label: s.id === 'open' ? 'Open — live on /careers' : s.id === 'closed' ? 'Closed — hidden, keeps responses' : 'Draft — private' }))} />
              <p className="self-end text-[12.5px] leading-snug text-paper/50">
                Open posts appear on /careers with Google Jobs markup within seconds of saving. Close a role to stop new applications; its responses stay here.
              </p>
            </FormSection>
          </div>
        )}
      />
    </AdminPanel>
  )
}
