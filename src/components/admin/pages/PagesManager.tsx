'use client'
// Admin → Pages (CMS + ADMIN-DATA). Pick a page → edit title, meta description and markdown with a live
// preview side by side (stacked with Write / Preview tabs on phones). Two ways to save:
//   "Save draft" (Ctrl/Cmd+S) → public.page_drafts only, the site does not change (migration 0014);
//   "Publish"                 → public.pages + updateTag('pages') → /policies/<slug> updates at once, draft closed.
// Drafts seeded with a note ("DRAFT — typical terms…") ask for a confirm before they go live. "Discard draft" has
// undo. Stale-tab guard (someone else saved first), unsaved-changes guard, format toolbar, "PRINTED!" stamp on
// publish (signature). Delete / "reset to built-in" = superadmin only (#69 shred + undo; server re-checks).
import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  AlertTriangle, Bold, Eye, FilePlus2, Heading2, Italic, Link2, List, ListOrdered, MessageCircle, PenLine, Quote, RotateCcw, ExternalLink,
  FileText, Save, Undo2, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MD_BODY_CLASS, MdBlocks, MdInline, parsePageMarkdown } from '@/app/policies/_lib/markdown'
import { AdminPanel } from '../AdminPage'
import { ConfirmShred } from '../ConfirmShred'
import { ErrorState } from '../ErrorState'
import { DEMO_WRITE_NOTE, useCanDelete } from '../AdminContext'
import { adminBtn, adminInput, adminLabel, adminPill } from '../ui'
import { deletePage, discardDraft, restoreDraft, saveDraft, savePage } from './actions'
import { PAGE_LIMITS, type AdminPageRow } from './types'

type FieldKey = 'slug' | 'title' | 'description' | 'body'
interface Draft { slug: string; title: string; description: string; body: string }

const NEW_TEMPLATE = `One or two sentences that sum up this page.

## First *section*

Write the details here. Wrap the accent word of a heading in *stars*.

## Ask us about *this* {pending}

Sections marked {pending} show an “Ask us for details” badge that links to the contact page.
`

/** The editor starts from the open draft when there is one, else from the live text. */
const toDraft = (r: AdminPageRow | null | undefined): Draft =>
  r
    ? r.draft
      ? { slug: r.slug, title: r.draft.title, description: r.draft.description, body: r.draft.body }
      : { slug: r.slug, title: r.title, description: r.description, body: r.body }
    : { slug: '', title: '', description: '', body: NEW_TEMPLATE }

const slugFrom = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '')

const fmtStamp = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })

export function PagesManager({ initial, loadError, draftError = null, demo }: { initial: AdminPageRow[]; loadError: string | null; draftError?: string | null; demo: boolean }) {
  const canDelete = useCanDelete()
  const [rows, setRows] = useState(initial)
  const [sel, setSel] = useState<string>(initial[0]?.slug ?? '')
  const [isNew, setIsNew] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial[0]))
  const [slugTouched, setSlugTouched] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState<AdminPageRow | null>(null)
  const [conflictKind, setConflictKind] = useState<'publish' | 'draft'>('publish')
  const [savingKind, setSavingKind] = useState<'publish' | 'draft' | null>(null)
  const [askPublish, setAskPublish] = useState(false)
  const [pendingSwitch, setPendingSwitch] = useState<{ to: string | null } | null>(null)
  const [pane, setPane] = useState<'write' | 'preview'>('write')
  const [stamp, setStamp] = useState(0)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const selRef = useRef(sel)
  useEffect(() => {
    selRef.current = isNew ? '' : sel
  })
  const ids = { title: useId(), slug: useId(), desc: useId(), body: useId() }

  const current = isNew ? null : rows.find((r) => r.slug === sel) ?? null
  const source = current ? toDraft(current) : null
  const dirty = isNew || !source || draft.title !== source.title || draft.description !== source.description || draft.body !== source.body
  const writeBlocked = demo || !!loadError
  const draftsOn = !writeBlocked && !draftError
  /** something to publish: unsaved edits, an open draft, or a page that only exists as a draft */
  const canPublish = dirty || !!current?.draft || (!!current && !current.live)

  // live preview (deferred so typing never janks on long pages)
  const deferredBody = useDeferredValue(draft.body)
  const doc = useMemo(() => parsePageMarkdown(deferredBody), [deferredBody])
  const stats = useMemo(() => {
    const words = deferredBody.replace(/[#*_>`[\]()-]/g, ' ').split(/\s+/).filter(Boolean).length
    return { words, sections: doc.sections.length, pending: doc.sections.filter((s) => s.pending).length, minutes: Math.max(1, Math.round(words / 220)) }
  }, [deferredBody, doc])

  // ---------------------------------------------------------------- switching pages
  const open = useCallback(
    (slug: string | null) => {
      setPendingSwitch(null)
      setErrors({})
      setConflict(null)
      setAskPublish(false)
      if (slug === null) {
        setIsNew(true)
        setSel('')
        setDraft(toDraft(null))
        setSlugTouched(false)
      } else {
        setIsNew(false)
        setSel(slug)
        setDraft(toDraft(rows.find((r) => r.slug === slug)))
      }
      setPane('write')
    },
    [rows],
  )
  const requestOpen = (slug: string | null) => {
    if (slug !== null && slug === sel && !isNew) return
    if (dirty && !saving && (isNew || current)) setPendingSwitch({ to: slug })
    else open(slug)
  }

  // leave-page guard
  useEffect(() => {
    if (!dirty || writeBlocked || (!isNew && !current)) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty, writeBlocked, isNew, current])

  // ---------------------------------------------------------------- save (publish / draft)
  const putRow = useCallback((saved: AdminPageRow) => {
    setRows((rs) => {
      const i = rs.findIndex((x) => x.slug === saved.slug)
      if (i === -1) return [...rs, saved]
      const next = rs.slice()
      next[i] = saved
      return next
    })
  }, [])

  const guard = useCallback((): boolean => {
    if (demo) {
      toast(DEMO_WRITE_NOTE, { id: 'demo-block' })
      return false
    }
    if (loadError) {
      toast.error('Can’t save yet', { description: loadError })
      return false
    }
    return true
  }, [demo, loadError])

  /** PUBLISH — goes live on /policies/<slug>. */
  const save = useCallback(
    async (force = false): Promise<boolean> => {
      if (saving || !guard()) return false
      setAskPublish(false)
      setSaving(true)
      setSavingKind('publish')
      setErrors({})
      const r = await savePage({
        ...draft,
        isNew,
        base: current?.updatedAt ?? null,
        ...(current?.draft ? { draftBase: current.draft.updatedAt } : {}),
        force,
      }).catch((e: unknown) => ({
        ok: false as const,
        error: e instanceof Error ? e.message : 'Network error — try again.',
      }))
      setSaving(false)
      setSavingKind(null)
      if (!r.ok) {
        if ('field' in r && r.field) setErrors({ [r.field]: r.error })
        if ('conflict' in r && r.conflict) {
          setConflict(r.conflict)
          setConflictKind('publish')
        }
        toast.error('Not published', { description: r.error })
        return false
      }
      const saved = r.data
      putRow(saved)
      setIsNew(false)
      setSel(saved.slug)
      setDraft(toDraft(saved))
      setConflict(null)
      setStamp((n) => n + 1)
      toast.success(`“${saved.title}” is live`, {
        description: `/policies/${saved.slug} shows it now.`,
        action: { label: 'View', onClick: () => window.open(`/policies/${saved.slug}`, '_blank', 'noopener') },
      })
      return true
    },
    [saving, guard, draft, isNew, current, putRow],
  )

  /** Publish button: drafts carrying a "DRAFT — confirm…" note ask once before they go live. */
  const requestPublish = () => {
    if (current?.draft?.note && !askPublish) setAskPublish(true)
    else void save()
  }

  /** SAVE DRAFT — the site does not change. */
  const saveAsDraft = useCallback(
    async (force = false): Promise<boolean> => {
      if (saving || !guard()) return false
      if (draftError) {
        toast.error('Drafts are off', { description: draftError })
        return false
      }
      setSaving(true)
      setSavingKind('draft')
      setErrors({})
      const r = await saveDraft({ ...draft, isNew, base: current?.draft?.updatedAt ?? null, force }).catch((e: unknown) => ({
        ok: false as const,
        error: e instanceof Error ? e.message : 'Network error — try again.',
      }))
      setSaving(false)
      setSavingKind(null)
      if (!r.ok) {
        if ('field' in r && r.field) setErrors({ [r.field]: r.error })
        if ('conflict' in r && r.conflict) {
          setConflict(r.conflict)
          setConflictKind('draft')
        }
        toast.error('Draft not saved', { description: r.error })
        return false
      }
      const saved = r.data
      putRow(saved)
      setIsNew(false)
      setSel(saved.slug)
      setDraft(toDraft(saved))
      setConflict(null)
      toast.success('Draft saved', { description: `Not on the site yet — /policies/${saved.slug} shows the ${saved.live ? 'live text' : 'page only once you publish'}.` })
      return true
    },
    [saving, guard, draftError, draft, isNew, current, putRow],
  )

  /** Ctrl/Cmd+S and "save, then switch": a draft when drafts work, otherwise publish (the old behaviour). */
  const quickSave = useCallback(() => (draftsOn ? saveAsDraft() : save()), [draftsOn, saveAsDraft, save])

  // DISCARD DRAFT (+ undo) — the live page is untouched
  const dropDraft = async () => {
    if (!current?.draft || saving || !guard()) return
    const slug = current.slug
    const before = current
    setSaving(true)
    const r = await discardDraft({ slug }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'Network error — try again.' }))
    setSaving(false)
    if (!r.ok) {
      toast.error('Draft not discarded', { description: r.error })
      return
    }
    const after = r.data
    if (after) {
      putRow(after)
      if (selRef.current === slug) setDraft(toDraft(after))
    } else {
      // the page only existed as a draft → it leaves the list
      const rest = rows.filter((x) => x.slug !== slug)
      setRows(rest)
      if (selRef.current === slug) {
        if (rest[0]) open(rest[0].slug)
        else open(null)
      }
    }
    toast('Draft discarded', {
      description: before.live ? 'The live page is unchanged.' : 'It was never on the site.',
      duration: 8000,
      action: {
        label: 'Undo',
        onClick: async () => {
          const u = await restoreDraft({ slug }).catch(() => null)
          if (!u || !u.ok || !u.data) {
            toast.error('Couldn’t bring the draft back', { description: u && !u.ok ? u.error : 'Reload and try again.' })
            return
          }
          const back = u.data
          putRow(back)
          setIsNew(false)
          setSel(slug)
          setDraft(toDraft(back))
          toast.success('Draft is back')
        },
      },
    })
  }

  // Ctrl/Cmd+S
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (dirty) void quickSave()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [dirty, quickSave])

  // ---------------------------------------------------------------- formatting toolbar
  const edit = (fn: (v: string, s: number, e: number) => { v: string; s: number; e: number }) => {
    const ta = bodyRef.current
    if (!ta || writeBlocked) return
    const r = fn(draft.body, ta.selectionStart, ta.selectionEnd)
    setDraft((d) => ({ ...d, body: r.v }))
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(r.s, r.e)
    })
  }
  const wrap = (mark: string, fallback: string) =>
    edit((v, s, e) => {
      const inner = v.slice(s, e) || fallback
      return { v: v.slice(0, s) + mark + inner + mark + v.slice(e), s: s + mark.length, e: s + mark.length + inner.length }
    })
  const lineStart = (v: string, s: number) => v.lastIndexOf('\n', s - 1) + 1
  const prefix = (p: string, numbered = false) =>
    edit((v, s, e) => {
      const a = lineStart(v, s)
      const lines = v.slice(a, e).split('\n')
      const out = lines.map((l, i) => (numbered ? `${i + 1}. ` : p) + l.replace(/^(#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s?)/, '')).join('\n')
      return { v: v.slice(0, a) + out + v.slice(e), s: a, e: a + out.length }
    })
  const link = () =>
    edit((v, s, e) => {
      const text = v.slice(s, e) || 'link text'
      const ins = `[${text}](/contact)`
      return { v: v.slice(0, s) + ins + v.slice(e), s: s + text.length + 3, e: s + text.length + 11 }
    })
  const markPending = () =>
    edit((v, s) => {
      // the heading this cursor sits under
      const before = v.slice(0, s)
      const h = before.lastIndexOf('\n## ') + 1 || (before.startsWith('## ') ? 0 : -1)
      if (h < 0) {
        toast('Put the cursor inside a section first', { description: 'The “Ask us for details” badge marks a whole “## Heading” section.' })
        return { v, s, e: s }
      }
      const end = v.indexOf('\n', h)
      const lineEnd = end === -1 ? v.length : end
      const line = v.slice(h, lineEnd)
      let next: string
      const m = /\s*\{([^{}]*)\}\s*$/.exec(line)
      if (m) {
        const toks = m[1].trim().split(/\s+/).filter(Boolean)
        const has = toks.some((t) => /^\.?pending$/i.test(t))
        const kept = has ? toks.filter((t) => !/^\.?pending$/i.test(t)) : [...toks, 'pending']
        next = line.slice(0, m.index) + (kept.length ? ` {${kept.join(' ')}}` : '')
      } else next = `${line} {pending}`
      const nv = v.slice(0, h) + next + v.slice(lineEnd)
      const pos = Math.min(s + (next.length - line.length), nv.length)
      return { v: nv, s: pos, e: pos }
    })
  const onBodyKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.metaKey || e.ctrlKey)) return
    const k = e.key.toLowerCase()
    if (k === 'b') { e.preventDefault(); wrap('**', 'bold') }
    else if (k === 'i') { e.preventDefault(); wrap('*', 'italic') }
    else if (k === 'k') { e.preventDefault(); link() }
  }

  // ---------------------------------------------------------------- delete / reset
  const shred = (row: AdminPageRow) => {
    let before: AdminPageRow[] = []
    let prevSel = sel
    return {
      itemLabel: row.builtin ? `${row.title} (edited copy)` : row.title,
      onConfirm: () => {
        before = rows
        prevSel = sel
        const fallback = row.builtin
          ? { ...row, body: '', stored: false, updatedAt: null, updatedByName: null }
          : null
        // optimistic: built-in pages go back to their built-in text (filled in by the server reply), others vanish
        setRows((rs) => (fallback ? rs : rs.filter((r) => r.slug !== row.slug)))
        if (!fallback) {
          const next = rows.find((r) => r.slug !== row.slug)
          if (next) open(next.slug)
          else open(null)
        }
      },
      onUndo: () => {
        setRows(before)
        if (prevSel) {
          setSel(prevSel)
          setIsNew(false)
          setDraft(toDraft(before.find((r) => r.slug === prevSel)))
        }
      },
      onCommit: async () => {
        const r = await deletePage(row.slug)
        if (!r.ok) throw new Error(r.error)
        const restored = r.data.restored
        if (restored) {
          setRows((rs) => (rs.some((x) => x.slug === restored.slug) ? rs.map((x) => (x.slug === restored.slug ? restored : x)) : [...rs, restored]))
          if (selRef.current === restored.slug) setDraft(toDraft(restored))
          if (restored.builtin) toast.success(`“${restored.title}” is back to the built-in text`)
          else toast.success(`“${restored.title}” is off the site`, { description: 'Its open draft is kept.' })
        }
      },
      undoMs: 6000,
    }
  }

  // ---------------------------------------------------------------- render
  const fieldErr = (k: FieldKey) => errors[k]
  const setField = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setErrors((er) => {
      const next = { ...er }
      for (const k of Object.keys(patch) as FieldKey[]) delete next[k]
      return next
    })
  }

  return (
    <>
      {loadError && <ErrorState title="Pages didn’t load from the database" message={`${loadError} The built-in texts are shown, and saving is off until this is fixed.`} onRetry={() => location.reload()} />}
      {demo && (
        <p className="border-2 border-hype px-3 py-2 font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-hype">
          Demo mode — built-in texts and the starter drafts, read-only. Connect Supabase to edit.
        </p>
      )}
      {draftError && !writeBlocked && (
        <p role="status" className="border-2 border-volt/60 px-3 py-2 text-[13px] font-medium text-volt">
          {draftError}
        </p>
      )}

      {/* page picker */}
      <nav aria-label="Pages" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {rows.map((r, i) => {
          const active = !isNew && r.slug === sel
          return (
            <button
              key={r.slug}
              type="button"
              aria-pressed={active}
              onClick={() => requestOpen(r.slug)}
              className={cn(
                'admin-rise group relative flex min-h-[112px] flex-col justify-between border-2 p-3 text-left focus-ring transition-[translate,box-shadow,border-color] duration-150',
                active
                  ? 'border-ink bg-paper text-ink shadow-[5px_5px_0_var(--color-door)]'
                  : 'border-paper/15 bg-[#121218] text-paper can-hover:hover:-translate-y-0.5 can-hover:hover:border-paper/40',
              )}
              style={{ ['--d' as string]: `${Math.min(i, 6) * 50}ms` }}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-[15px] font-bold leading-tight">{r.title}</span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className={adminPill(r.live && r.stored ? 'volt' : 'muted')}>{!r.live ? 'Not live' : r.stored ? 'Live' : 'Built-in'}</span>
                  {r.draft && <span className={adminPill(r.draft.note ? 'hype' : 'pink')}>Draft</span>}
                </span>
              </span>
              <span className={cn('mt-2 block truncate font-mono text-[11px]', active ? 'text-ink/60' : 'text-paper/45')}>/policies/{r.slug}</span>
              <span className={cn('mt-1 block truncate text-[11.5px]', active ? 'text-ink/60' : 'text-paper/45')}>
                {r.draft
                  ? r.draft.note
                    ? 'Draft waiting for your check'
                    : `Draft${r.draft.updatedAt ? ` saved ${fmtStamp(r.draft.updatedAt)}` : ''}${r.draft.updatedByName ? ` · ${r.draft.updatedByName}` : ''}`
                  : r.updatedAt
                    ? `Saved ${fmtStamp(r.updatedAt)}${r.updatedByName ? ` · ${r.updatedByName}` : ''}`
                    : 'Not edited yet'}
              </span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => requestOpen(null)}
          disabled={writeBlocked}
          title={demo ? DEMO_WRITE_NOTE : undefined}
          aria-pressed={isNew}
          className={cn(
            'grid min-h-[112px] place-items-center border-2 border-dashed p-3 font-mono text-[12px] font-bold uppercase tracking-[0.12em] focus-ring transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
            isNew ? 'border-volt bg-volt text-ink' : 'border-paper/25 text-paper/70 can-hover:hover:border-volt can-hover:hover:text-volt',
          )}
        >
          <span className="flex items-center gap-2">
            <FilePlus2 aria-hidden="true" className="size-4" /> New page
          </span>
        </button>
      </nav>

      {pendingSwitch && (
        <div role="alertdialog" aria-label="Unsaved changes" className="flex flex-wrap items-center gap-3 border-2 border-ink bg-volt p-3 text-ink shadow-[5px_5px_0_var(--color-hype)]">
          <p className="mr-auto text-[14px] font-semibold">You have unsaved changes{draft.title ? ` in “${draft.title}”` : ''}.</p>
          <button type="button" className={adminBtn({ variant: 'door', size: 'sm' })} onClick={async () => { const to = pendingSwitch.to; if (await quickSave()) open(to) }} disabled={saving || writeBlocked}>
            {draftsOn ? 'Save draft, then switch' : 'Publish, then switch'}
          </button>
          <button type="button" className={cn(adminBtn({ variant: 'quiet', size: 'sm' }), 'text-ink')} onClick={() => open(pendingSwitch.to)}>
            Discard changes
          </button>
          <button type="button" className={cn(adminBtn({ variant: 'quiet', size: 'sm' }), 'text-ink')} onClick={() => setPendingSwitch(null)}>
            Keep editing
          </button>
        </div>
      )}

      {conflict && (
        <div role="alert" className="flex flex-wrap items-center gap-3 border-2 border-ink bg-hype p-3 text-paper shadow-[5px_5px_0_var(--color-volt)]">
          <p className="mr-auto text-[14px] font-semibold">
            {conflictKind === 'draft'
              ? <>{conflict.draft?.updatedByName || 'Someone'} saved a newer draft of “{conflict.title}”{conflict.draft?.updatedAt ? ` at ${fmtStamp(conflict.draft.updatedAt)}` : ''}, after you opened it.</>
              : <>{conflict.updatedByName || conflict.draft?.updatedByName || 'Someone'} saved “{conflict.title}”{conflict.updatedAt ? ` at ${fmtStamp(conflict.updatedAt)}` : ''}, after you opened it.</>}
          </p>
          <button
            type="button"
            className={adminBtn({ variant: 'ghost', size: 'sm' })}
            onClick={() => {
              setRows((rs) => rs.map((x) => (x.slug === conflict.slug ? conflict : x)))
              setDraft(toDraft(conflict))
              setConflict(null)
            }}
          >
            Load their version
          </button>
          <button type="button" className={adminBtn({ variant: 'primary', size: 'sm' })} onClick={() => void (conflictKind === 'draft' ? saveAsDraft(true) : save(true))} disabled={saving}>
            {conflictKind === 'draft' ? 'Save my draft over it' : 'Publish mine over it'}
          </button>
        </div>
      )}

      {(isNew || current) && (
        <AdminPanel
          index={1}
          shadow="door"
          title={isNew ? <>New <em>page</em></> : <>Edit · {current?.title}</>}
          jp={isNew ? '新しいページ' : 'ページ編集'}
          action={
            !isNew && current?.live ? (
              <Link href={`/policies/${current.slug}`} target="_blank" rel="noopener" className="inline-flex min-h-9 items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-volt focus-ring">
                View live <ExternalLink aria-hidden="true" className="size-3.5" />
              </Link>
            ) : undefined
          }
        >
          {/* draft banner */}
          {!isNew && current?.draft && (
            <div
              role="note"
              className={cn(
                'mb-5 flex flex-wrap items-start gap-3 border-2 p-3 text-[13.5px] leading-snug text-paper',
                current.draft.note ? 'border-hype bg-hype/10' : 'border-pink/60 bg-pink/5',
              )}
            >
              <AlertTriangle aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', current.draft.note ? 'text-hype' : 'text-pink')} />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
                  You’re editing a draft — not on the site
                </p>
                {current.draft.note && <p className="mt-1 font-semibold">{current.draft.note}</p>}
                <p className="mt-1 text-paper/65">
                  {current.live
                    ? <>/policies/{current.slug} still shows the live text. Press <b>Publish</b> when this draft is right.</>
                    : <>This page has never been published — /policies/{current.slug} is not on the site yet.</>}
                  {current.draft.updatedAt ? ` Draft saved ${fmtStamp(current.draft.updatedAt)}${current.draft.updatedByName ? ` by ${current.draft.updatedByName}` : ''}.` : ''}
                </p>
              </div>
            </div>
          )}

          {/* meta fields */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor={ids.title} className={adminLabel}>Title (H1)</label>
              <input
                id={ids.title}
                value={draft.title}
                maxLength={PAGE_LIMITS.title}
                readOnly={writeBlocked}
                aria-invalid={!!fieldErr('title')}
                onChange={(e) => setField({ title: e.target.value, ...(isNew && !slugTouched ? { slug: slugFrom(e.target.value) } : {}) })}
                placeholder="Privacy policy"
                className={adminInput}
              />
              {fieldErr('title') && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-hype">{fieldErr('title')}</p>}
            </div>
            <div>
              <label htmlFor={ids.slug} className={adminLabel}>Address</label>
              <div className="flex items-stretch">
                <span className="grid place-items-center border-2 border-r-0 border-paper/20 bg-paper/5 px-2.5 font-mono text-[12.5px] text-paper/55">/policies/</span>
                <input
                  id={ids.slug}
                  value={draft.slug}
                  readOnly={!isNew || writeBlocked}
                  aria-invalid={!!fieldErr('slug')}
                  aria-describedby={`${ids.slug}-hint`}
                  onChange={(e) => { setSlugTouched(true); setField({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40) }) }}
                  placeholder="size-guide"
                  className={cn(adminInput, 'font-mono text-[14px]', !isNew && 'cursor-not-allowed opacity-70')}
                />
              </div>
              <p id={`${ids.slug}-hint`} className={cn('mt-1.5 text-[12.5px] leading-snug', fieldErr('slug') ? 'font-medium text-hype' : 'text-paper/50')} role={fieldErr('slug') ? 'alert' : undefined}>
                {fieldErr('slug') ?? (isNew ? 'Lowercase letters, numbers and dashes. Can’t be changed after the first save.' : 'Fixed — links and Google already point here.')}
              </p>
            </div>
            <div className="md:col-span-2">
              <label htmlFor={ids.desc} className={adminLabel}>Search description</label>
              <textarea
                id={ids.desc}
                rows={2}
                value={draft.description}
                maxLength={PAGE_LIMITS.description}
                readOnly={writeBlocked}
                aria-invalid={!!fieldErr('description')}
                onChange={(e) => setField({ description: e.target.value })}
                placeholder="One or two sentences Google shows under the page title."
                className={cn(adminInput, 'resize-y leading-relaxed')}
              />
              <p className={cn('mt-1 flex justify-between gap-3 text-[12px]', fieldErr('description') ? 'text-hype' : 'text-paper/45')}>
                <span>{fieldErr('description') ?? 'Shown in Google results and link previews.'}</span>
                <span className="font-mono tabular-nums">{draft.description.length}/{PAGE_LIMITS.description}</span>
              </p>
            </div>
          </div>

          {/* write / preview tabs (phones + tablets) */}
          <div role="tablist" aria-label="Editor view" className="mt-6 inline-flex border-2 border-paper/20 lg:hidden">
            {(['write', 'preview'] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={pane === p}
                onClick={() => setPane(p)}
                className={cn('inline-flex min-h-11 items-center gap-2 px-4 font-mono text-[11px] font-bold uppercase tracking-[0.12em] focus-ring', pane === p ? 'bg-volt text-ink' : 'text-paper/70')}
              >
                {p === 'write' ? <PenLine aria-hidden="true" className="size-3.5" /> : <Eye aria-hidden="true" className="size-3.5" />}
                {p}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-5 lg:mt-6 lg:grid-cols-2">
            {/* editor */}
            <div className={cn('min-w-0', pane !== 'write' && 'hidden lg:block')}>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={ids.body} className={cn(adminLabel, 'mb-0')}>Page text (markdown)</label>
                <span className="font-mono text-[10.5px] text-paper/40 tabular-nums">{draft.body.length.toLocaleString('en-IN')}/{PAGE_LIMITS.body.toLocaleString('en-IN')}</span>
              </div>
              <div role="toolbar" aria-label="Formatting" aria-controls={ids.body} className="mt-2 flex flex-wrap gap-1 border-2 border-b-0 border-paper/20 bg-paper/5 p-1">
                <Tool label="Section heading" onClick={() => prefix('## ')} disabled={writeBlocked}><Heading2 className="size-4" /></Tool>
                <Tool label="Bold (Ctrl+B)" onClick={() => wrap('**', 'bold')} disabled={writeBlocked}><Bold className="size-4" /></Tool>
                <Tool label="Italic / accent word (Ctrl+I)" onClick={() => wrap('*', 'accent')} disabled={writeBlocked}><Italic className="size-4" /></Tool>
                <Tool label="Bullet list" onClick={() => prefix('- ')} disabled={writeBlocked}><List className="size-4" /></Tool>
                <Tool label="Numbered list" onClick={() => prefix('', true)} disabled={writeBlocked}><ListOrdered className="size-4" /></Tool>
                <Tool label="Link (Ctrl+K)" onClick={link} disabled={writeBlocked}><Link2 className="size-4" /></Tool>
                <Tool label="Note" onClick={() => prefix('> ')} disabled={writeBlocked}><Quote className="size-4" /></Tool>
                <Tool label="Add an “Ask us for details” badge to this section" onClick={markPending} disabled={writeBlocked}><MessageCircle className="size-4" /></Tool>
              </div>
              <textarea
                id={ids.body}
                ref={bodyRef}
                value={draft.body}
                maxLength={PAGE_LIMITS.body}
                readOnly={writeBlocked}
                spellCheck
                aria-invalid={!!fieldErr('body')}
                onKeyDown={onBodyKey}
                onChange={(e) => setField({ body: e.target.value })}
                className={cn(adminInput, 'min-h-[420px] resize-y font-mono text-[13.5px] leading-[1.6] lg:min-h-[560px]')}
              />
              {fieldErr('body') && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-hype">{fieldErr('body')}</p>}
              <details className="mt-3 border-2 border-paper/15 p-3 text-[13px] text-paper/70">
                <summary className="cursor-pointer font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-paper/80 focus-ring">How to format</summary>
                <ul className="mt-2 space-y-1 font-mono text-[12px] leading-relaxed">
                  <li><b className="text-volt">Text before the first ##</b> = intro under the title</li>
                  <li><b className="text-volt">## How we *ship*</b> = section; *word* gets the yellow highlight</li>
                  <li><b className="text-volt">## Returns {'{pending}'}</b> = “Ask us for details” badge (links to the contact page)</li>
                  <li><b className="text-volt">## Rights {'{#rights}'}</b> = fixed link anchor (/policies/privacy#rights)</li>
                  <li><b className="text-volt">**bold**  *italic*  [text](/contact)</b> — links: /page, https://…, mailto:, tel:</li>
                  <li><b className="text-volt">- item / 1. item / &gt; note / ---</b> lists, a note box, a divider</li>
                  <li>HTML is shown as plain text — nothing can inject code into the site.</li>
                </ul>
              </details>
            </div>

            {/* live preview */}
            <div className={cn('min-w-0', pane !== 'preview' && 'hidden lg:block')}>
              <p className={cn(adminLabel, 'flex items-center gap-2')}>
                <Eye aria-hidden="true" className="size-3.5" /> Live preview
                <span className="ml-auto font-mono text-[10.5px] normal-case tracking-normal text-paper/45">
                  {stats.words} words · {stats.sections} sections{stats.pending ? ` · ${stats.pending} “ask us” badge${stats.pending === 1 ? '' : 's'}` : ''} · {stats.minutes} min read
                </span>
              </p>
              <Preview draft={draft} doc={doc} stamp={stamp} isDraft={!!current?.draft || dirty} />
            </div>
          </div>

          {/* publish confirm for drafts that carry a "DRAFT — confirm…" note */}
          {askPublish && current?.draft?.note && (
            <div role="alertdialog" aria-label="Publish this draft?" className="mt-6 flex flex-wrap items-center gap-3 border-2 border-ink bg-hype p-3 text-paper shadow-[5px_5px_0_var(--color-volt)]">
              <p className="mr-auto max-w-[62ch] text-[14px] font-semibold leading-snug">
                This draft has typical terms, not yours yet. Publish only if every number (days, ₹, time windows) is what you really offer — customers will hold you to it.
              </p>
              <button type="button" className={adminBtn({ variant: 'primary', size: 'sm' })} onClick={() => void save()} disabled={saving}>
                Yes, I checked — publish
              </button>
              <button type="button" className={cn(adminBtn({ variant: 'quiet', size: 'sm' }), 'text-paper')} onClick={() => setAskPublish(false)}>
                <X aria-hidden className="size-4" /> Keep editing
              </button>
            </div>
          )}

          {/* save bar */}
          <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap items-center gap-3 border-t-4 border-ink bg-[#0e0e13]/95 px-4 py-3 backdrop-blur-sm sm:-mx-5 sm:px-5">
            <button
              type="button"
              onClick={requestPublish}
              disabled={saving || !canPublish || writeBlocked}
              title={demo ? DEMO_WRITE_NOTE : !canPublish ? 'Nothing new to publish' : 'Publish — /policies shows it at once'}
              className={adminBtn({ variant: 'primary' })}
            >
              {savingKind === 'publish' ? <span className="inline-block size-3.5 animate-spin border-2 border-ink border-t-transparent" aria-hidden /> : <FileText aria-hidden className="size-4" />}
              {savingKind === 'publish' ? 'Publishing…' : 'Publish'}
            </button>
            {(draftsOn || demo) && (
              <button
                type="button"
                onClick={() => void saveAsDraft()}
                disabled={saving || !dirty || writeBlocked || !!draftError}
                title={demo ? DEMO_WRITE_NOTE : !dirty ? 'No changes to save' : 'Save draft — the site does not change (Ctrl/Cmd+S)'}
                className={adminBtn({ variant: 'ghost' })}
              >
                {savingKind === 'draft' ? <span className="inline-block size-3.5 animate-spin border-2 border-paper border-t-transparent" aria-hidden /> : <Save aria-hidden className="size-4" />}
                {savingKind === 'draft' ? 'Saving…' : 'Save draft'}
              </button>
            )}
            {dirty && !isNew && current && (
              <button type="button" onClick={() => { setDraft(toDraft(current)); setErrors({}) }} className={adminBtn({ variant: 'quiet' })} title={current.draft ? 'Back to the saved draft' : 'Back to the live text'}>
                <RotateCcw aria-hidden className="size-4" /> Undo changes
              </button>
            )}
            {!dirty && current?.draft && (
              <button type="button" onClick={() => void dropDraft()} disabled={saving || writeBlocked} className={adminBtn({ variant: 'quiet' })} title={current.live ? 'Throw the draft away — the live page stays as it is' : 'Throw the draft away'}>
                <Undo2 aria-hidden className="size-4" /> Discard draft
              </button>
            )}
            {isNew && rows.length > 0 && (
              <button type="button" onClick={() => open(rows[0].slug)} className={adminBtn({ variant: 'ghost' })}>Cancel</button>
            )}
            <span className="label text-[10px]" aria-live="polite">
              {saving
                ? ''
                : dirty && (isNew || current)
                  ? <span className="text-volt">● Unsaved changes</span>
                  : current?.draft
                    ? <span className="text-pink">● Draft saved — not live yet</span>
                    : <span className="text-paper/45">All changes published</span>}
            </span>
            <span className="ml-auto flex items-center gap-3">
              <span className="hidden text-[12px] text-paper/50 sm:inline">
                {current?.updatedAt
                  ? `Last updated ${fmtStamp(current.updatedAt)}${current.updatedByName ? ` by ${current.updatedByName}` : ''}`
                  : current?.live
                    ? 'Built-in text — publishing copies it into the database.'
                    : ''}
              </span>
              {current?.stored && (
                <ConfirmShred
                  {...shred(current)}
                  variant="button"
                  label={current.builtin ? 'Reset to built-in' : 'Delete page'}
                  confirmText={current.builtin ? 'Reset it' : 'Shred it'}
                  disabled={writeBlocked}
                  disabledReason={demo ? DEMO_WRITE_NOTE : undefined}
                  locked={!canDelete}
                />
              )}
            </span>
          </div>
        </AdminPanel>
      )}
    </>
  )
}

function Tool({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="grid min-h-10 min-w-10 place-items-center text-paper/75 focus-ring transition-colors duration-150 disabled:opacity-40 can-hover:hover:bg-paper/10 can-hover:hover:text-volt active:translate-y-px"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  )
}

/** Paper panel that mirrors /policies/<slug>: H1, intro, numbered sections, pending badges. */
function Preview({ draft, doc, stamp, isDraft }: { draft: Draft; doc: ReturnType<typeof parsePageMarkdown>; stamp: number; isDraft: boolean }) {
  return (
    <div className="relative max-h-[640px] overflow-y-auto border-2 border-ink bg-paper text-ink shadow-[5px_5px_0_var(--color-volt)] lg:max-h-[720px]">
      {stamp > 0 && (
        <span
          key={stamp}
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-4 z-10 rotate-[-9deg] border-[3px] border-hype px-3 py-1 font-sfx text-[30px] leading-none tracking-wide text-hype opacity-0 motion-safe:animate-[pages-stamp_1600ms_cubic-bezier(0.34,1.56,0.64,1)_both]"
        >
          PRINTED!
        </span>
      )}
      <style>{`@keyframes pages-stamp{0%{opacity:0;transform:rotate(-9deg) scale(1.8)}14%{opacity:1;transform:rotate(-9deg) scale(.94)}22%{transform:rotate(-9deg) scale(1)}80%{opacity:1}100%{opacity:0;transform:rotate(-9deg) scale(1)}}`}</style>
      <div className="border-b-4 border-ink bg-ink px-5 py-5 text-paper">
        <p className="label text-volt">Preview{isDraft ? ' · not live yet' : ''} · /policies/{draft.slug || '…'}</p>
        <p className="h-display mt-3 text-[clamp(34px,4vw,52px)] leading-[0.9]">{draft.title || 'Untitled page'}</p>
        {doc.intro.length > 0 && (
          <div className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-paper/80 [&_p+p]:mt-3">
            <MdBlocks blocks={doc.intro} />
          </div>
        )}
      </div>
      <div className="px-5 py-6">
        {doc.sections.length === 0 && <p className="text-[15px] text-ink/60">Add a section with “## Heading” to see it here.</p>}
        {doc.sections.map((s, i) => (
          <section key={s.id} className={cn(i > 0 && 'mt-10 border-t-[3px] border-ink pt-7')}>
            <p className="label text-tone-2">{String(i + 1).padStart(2, '0')} <span className="ml-2 font-mono normal-case tracking-normal text-tone-3">#{s.id}</span></p>
            <p className="h-display mt-2 text-[clamp(28px,3vw,40px)] [&_em]:accent">
              <MdInline nodes={s.title} />
            </p>
            {s.pending && (
              <p className="mt-3 inline-flex items-center gap-2 border-[3px] border-ink bg-volt px-3 py-1.5 text-[13px] font-semibold shadow-hard-sm">
                <MessageCircle aria-hidden="true" className="size-4" /> Ask us for details
              </p>
            )}
            <div className={cn('mt-4 !text-[15.5px]', MD_BODY_CLASS)}>
              <MdBlocks blocks={s.blocks} />
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
