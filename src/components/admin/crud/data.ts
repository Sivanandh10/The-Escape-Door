'use client'
// P4b — client data layer for the admin CRUD pages.
// - live:    Supabase browser client under RLS (admin session); optimistic UI with rollback.
// - demo:    Supabase env missing → read-only seed/demo rows; every write explains itself.
// - sandbox: opt-in from demo → edits apply locally only (clearly labelled, never saved).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabaseBrowser } from '@/lib/supabase/client'
import { deleteRows, revalidateCatalog, type DeletableTable } from './actions'
import type { TAGS } from '@/lib/data/repo'
import type { Perm } from '@/lib/admin/permissions'
import { DELETE_LOCK_NOTE, READONLY_NOTE, useCan, useCanDelete } from '../AdminContext'

export type Row = Record<string, unknown>
export type CrudMode = 'live' | 'demo' | 'sandbox'
export type CrudStatus = 'loading' | 'ready' | 'error'
type TagKey = keyof typeof TAGS

export { str, num, bool, strArr, newId, slugify } from './util'
import { slugify } from './util'

// ---------------------------------------------------------------- mode
export function getAdminClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null
  return supabaseBrowser()
}

/** Shared mode store so the banner and every manager agree (sandbox is a session-wide opt-in). */
let sandbox = false
const listeners = new Set<() => void>()
export function setSandbox(v: boolean) {
  sandbox = v
  listeners.forEach((l) => l())
}
export function useCrudMode(): CrudMode {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => void listeners.delete(l)
  }, [])
  if (isSupabaseConfigured()) return 'live'
  return sandbox ? 'sandbox' : 'demo'
}

export function explainDemo() {
  toast('Demo mode — nothing was saved', {
    description: 'Connect Supabase (env keys + admin login) to save changes. Or switch on Sandbox in the banner to try edits locally.',
    id: 'demo-block',
  })
}

/** Live, but the member's role can't write here (RLS would refuse anyway). */
export function explainReadOnly() {
  toast('View only — nothing changed', { description: READONLY_NOTE, id: 'readonly-block' })
}

async function revalidate(tags?: TagKey[]) {
  if (!tags?.length) return
  try {
    await revalidateCatalog(tags)
  } catch {
    /* cache will expire on its own (cacheLife hours) */
  }
}

function errMsg(e: unknown): string {
  if (!e) return 'Unknown error'
  if (typeof e === 'string') return e
  if (typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return 'Unknown error'
}

// ---------------------------------------------------------------- generic table hook
export interface CrudConfig<T> {
  table: string
  pk: 'id' | 'slug'
  fromRow: (r: Row) => T
  toRow: (t: T) => Row
  order?: { column: string; ascending?: boolean }
  tags?: TagKey[]
  /** human name for toasts */
  label: (t: T) => string
  /** for reorder(): write the position into the item */
  setOrder?: (t: T, i: number) => T
}

export interface Crud<T> {
  mode: CrudMode
  /** live, but the member's role lacks the write permission → edit controls disabled, writes refused */
  readOnly: boolean
  /** hierarchy rule: only the superadmin deletes. false → delete buttons show locked (server + RLS refuse too) */
  canDelete: boolean
  status: CrudStatus
  error: string | null
  rows: T[]
  reload: () => void
  /** insert or update (optimistic). Returns true when stored (or applied in sandbox). */
  save: (item: T, opts?: { quiet?: boolean }) => Promise<boolean>
  /** quick patch of one row (status chips etc.) */
  update: (key: string, fn: (t: T) => T, opts?: { quiet?: boolean; success?: string }) => Promise<boolean>
  /** ConfirmShred / shredWithUndo props for one row (#69: optimistic hide → undo window → real delete) */
  shredProps: (key: string, after?: () => void) => {
    itemLabel: string
    onConfirm: () => void
    onUndo: () => void
    onCommit: () => Promise<void>
    disabled: boolean
    disabledReason?: string
    /** not the superadmin → lock icon + "Only the superadmin can delete" */
    locked: boolean
  }
  reorder: (keys: string[]) => Promise<boolean>
  keyOf: (t: T) => string
  /** write several rows without per-row toasts (used for single-flag swaps) */
  saveMany: (items: T[]) => Promise<boolean>
}

export interface CrudOptions {
  /** permission needed to write (e.g. 'leads.edit'). Without it the manager is view-only. */
  perm?: Perm
}

export function useCrud<T>(cfg: CrudConfig<T>, initial: T[], opts?: CrudOptions): Crud<T> {
  const mode = useCrudMode()
  const allowed = useCan(opts?.perm ?? 'dashboard.view')
  const readOnly = mode === 'live' && !!opts?.perm && !allowed
  const mayDelete = useCanDelete()
  const canDelete = mode !== 'live' || mayDelete
  const cfgRef = useRef(cfg)
  // eslint-disable-next-line react-hooks/refs -- latest-config ref, read only inside callbacks
  cfgRef.current = cfg
  const keyOf = useCallback((t: T) => String((t as Record<string, unknown>)[cfgRef.current.pk === 'slug' ? 'slug' : 'id']), [])

  const [rows, setRows] = useState<T[]>(initial)
  const rowsRef = useRef(rows)
  // eslint-disable-next-line react-hooks/refs -- latest-rows ref for optimistic rollback, read only inside callbacks
  rowsRef.current = rows
  const [status, setStatus] = useState<CrudStatus>(mode === 'live' ? 'loading' : 'ready')
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const sb = getAdminClient()
    if (!sb) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- demo/sandbox: nothing to fetch
      setStatus('ready')
      return
    }
    let alive = true
    setStatus('loading')
    ;(async () => {
      try {
        let q = sb.from(cfgRef.current.table).select('*')
        const o = cfgRef.current.order
        if (o) q = q.order(o.column, { ascending: o.ascending ?? true })
        const { data, error: e } = await q
        if (!alive) return
        if (e) throw e
        setRows((data as Row[]).map(cfgRef.current.fromRow))
        setError(null)
        setStatus('ready')
      } catch (e) {
        if (!alive) return
        setError(errMsg(e))
        setStatus('error')
      }
    })()
    return () => {
      alive = false
    }
  }, [nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  const applyLocal = useCallback(
    (item: T) => {
      const k = keyOf(item)
      setRows((rs) => {
        const i = rs.findIndex((r) => keyOf(r) === k)
        if (i === -1) return [item, ...rs]
        const next = rs.slice()
        next[i] = item
        return next
      })
    },
    [keyOf],
  )

  const saveMany = useCallback(
    async (items: T[]): Promise<boolean> => {
      if (mode === 'demo') {
        explainDemo()
        return false
      }
      if (readOnly) {
        explainReadOnly()
        return false
      }
      const before = rowsRef.current
      items.forEach(applyLocal)
      if (mode === 'sandbox') return true
      const sb = getAdminClient()!
      const { error: e } = await sb.from(cfgRef.current.table).upsert(items.map(cfgRef.current.toRow))
      if (e) {
        setRows(before)
        toast.error('Could not save', { description: errMsg(e) })
        return false
      }
      void revalidate(cfgRef.current.tags)
      return true
    },
    [mode, readOnly, applyLocal],
  )

  const save = useCallback(
    async (item: T, opts?: { quiet?: boolean }): Promise<boolean> => {
      if (mode === 'demo') {
        explainDemo()
        return false
      }
      if (readOnly) {
        explainReadOnly()
        return false
      }
      const before = rowsRef.current
      applyLocal(item)
      if (mode === 'sandbox') {
        if (!opts?.quiet) toast.success(`Saved “${cfgRef.current.label(item)}”`, { description: 'Sandbox — local only, not stored.' })
        return true
      }
      const sb = getAdminClient()!
      const { data, error: e } = await sb.from(cfgRef.current.table).upsert(cfgRef.current.toRow(item)).select().single()
      if (e) {
        setRows(before)
        toast.error('Could not save', { description: errMsg(e) })
        return false
      }
      if (data) applyLocal(cfgRef.current.fromRow(data as Row))
      void revalidate(cfgRef.current.tags)
      if (!opts?.quiet) toast.success(`Saved “${cfgRef.current.label(item)}”`)
      return true
    },
    [mode, readOnly, applyLocal],
  )

  const update = useCallback(
    async (key: string, fn: (t: T) => T, opts?: { quiet?: boolean; success?: string }): Promise<boolean> => {
      const cur = rowsRef.current.find((r) => keyOf(r) === key)
      if (!cur) return false
      if (mode === 'demo') {
        explainDemo()
        return false
      }
      if (readOnly) {
        explainReadOnly()
        return false
      }
      const next = fn(cur)
      const before = rowsRef.current
      applyLocal(next)
      if (mode === 'sandbox') {
        if (opts?.success) toast.success(opts.success, { description: 'Sandbox — local only.' })
        return true
      }
      const sb = getAdminClient()!
      const row = cfgRef.current.toRow(next)
      delete row.created_at
      const { error: e } = await sb.from(cfgRef.current.table).update(row).eq(cfgRef.current.pk, key)
      if (e) {
        setRows(before)
        toast.error('Change rolled back', { description: errMsg(e) })
        return false
      }
      void revalidate(cfgRef.current.tags)
      if (opts?.success) toast.success(opts.success)
      return true
    },
    [mode, readOnly, applyLocal, keyOf],
  )

  const shredProps = useCallback(
    (key: string, after?: () => void) => {
      const item = rowsRef.current.find((r) => keyOf(r) === key)
      const itemLabel = item ? cfgRef.current.label(item) : 'item'
      let idx = -1
      const locked = !canDelete
      return {
        itemLabel,
        locked,
        disabled: mode === 'demo' || locked || readOnly,
        disabledReason: mode === 'demo'
          ? 'Demo mode — deleting is switched off. Try sandbox to rehearse it.'
          : locked ? DELETE_LOCK_NOTE : readOnly ? READONLY_NOTE : undefined,
        onConfirm: () => {
          idx = rowsRef.current.findIndex((r) => keyOf(r) === key)
          setRows((rs) => rs.filter((r) => keyOf(r) !== key))
          after?.()
        },
        onUndo: () => {
          if (!item) return
          setRows((rs) => {
            if (rs.some((r) => keyOf(r) === key)) return rs
            const next = rs.slice()
            next.splice(Math.max(0, Math.min(idx, next.length)), 0, item)
            return next
          })
        },
        onCommit: async () => {
          if (mode !== 'live') return
          // superadmin-only server action (re-checks the session, then deletes under RLS + revalidates tags)
          const r = await deleteRows(cfgRef.current.table as DeletableTable, [key])
          if (!r.ok) throw new Error(r.error)
        },
      }
    },
    [mode, readOnly, canDelete, keyOf],
  )

  const reorder = useCallback(
    async (keys: string[]): Promise<boolean> => {
      const set = cfgRef.current.setOrder
      if (!set) return false
      if (mode === 'demo') {
        explainDemo()
        return false
      }
      if (readOnly) {
        explainReadOnly()
        return false
      }
      const before = rowsRef.current
      const byKey = new Map(before.map((r) => [keyOf(r), r]))
      const moved = keys.map((k, i) => set(byKey.get(k)!, i + 1)).filter(Boolean)
      const rest = before.filter((r) => !keys.includes(keyOf(r)))
      setRows([...moved, ...rest])
      if (mode === 'sandbox') return true
      const sb = getAdminClient()!
      const { error: e } = await sb.from(cfgRef.current.table).upsert(moved.map(cfgRef.current.toRow))
      if (e) {
        setRows(before)
        toast.error('Order not saved', { description: errMsg(e) })
        return false
      }
      void revalidate(cfgRef.current.tags)
      return true
    },
    [mode, readOnly, keyOf],
  )

  return useMemo(
    () => ({ mode, readOnly, canDelete, status, error, rows, reload, save, update, shredProps, reorder, keyOf, saveMany }),
    [mode, readOnly, canDelete, status, error, rows, reload, save, update, shredProps, reorder, keyOf, saveMany],
  )
}

// ---------------------------------------------------------------- storage
/** Upload an image to the public product-images bucket → public URL. */
export async function uploadProductImage(file: File, folder: string): Promise<string> {
  const sb = getAdminClient()
  if (!sb) throw new Error('Supabase is not connected')
  if (!/^image\/(png|jpe?g|webp|avif)$/.test(file.type)) throw new Error('Use PNG, JPG, WebP or AVIF')
  if (file.size > 5 * 1024 * 1024) throw new Error('Max 5 MB per image')
  const ext = (file.name.split('.').pop() || 'webp').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${folder}/${Date.now().toString(36)}-${slugify(file.name.replace(/\.[^.]+$/, '')) || 'image'}.${ext}`
  const { error } = await sb.storage.from('product-images').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return sb.storage.from('product-images').getPublicUrl(path).data.publicUrl
}

/** Signed read URL for a private custom-upload (path or full URL). */
export async function signCustomUpload(ref: string): Promise<string | null> {
  if (/^https?:\/\//.test(ref) && !/\/storage\/v1\/object\/(sign|authenticated)\/custom-uploads\//.test(ref)) return ref
  const sb = getAdminClient()
  if (!sb) return null
  const path = ref.replace(/^.*\/custom-uploads\//, '').replace(/\?.*$/, '')
  const { data } = await sb.storage.from('custom-uploads').createSignedUrl(path, 60 * 60)
  return data?.signedUrl ?? null
}

// ---------------------------------------------------------------- CSV
export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    // neutralise spreadsheet formula injection
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n')
}

export function downloadText(name: string, text: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿', text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
