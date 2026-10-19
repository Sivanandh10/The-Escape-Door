'use client'
// Client data layer for settings-stored admin lists (public.settings key/value JSON rows).
//   const crud = useSettingList<HoodieTier>('hoodie_tiers', initial, { perm: 'catalog.edit', label: (t) => t.name })
//   <EntityManager crud={crud} … />                       // same Crud<T> contract as useCrud()
//   const ap = useSettingObject('apparel_custom', initial, 'catalog.edit')
// Reads: browser client (settings has a public read policy). Writes: saveSettingValue() server action
// (permission re-check, zod, superadmin-only removals, updateTag('settings')). Demo/sandbox like useCrud.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Perm } from '@/lib/admin/permissions'
import { DELETE_LOCK_NOTE, READONLY_NOTE, useCan, useCanDelete } from '../AdminContext'
import { explainDemo, explainReadOnly, getAdminClient, useCrudMode, type Crud, type CrudMode, type CrudStatus } from './data'
import { saveSettingValue } from './settingsActions'
import type { SettingKey, SettingListKey } from './settingsSchemas'

async function readSetting(key: SettingKey): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  const sb = getAdminClient()
  if (!sb) return { ok: true, value: null }
  const { data, error } = await sb.from('settings').select('value').eq('key', key).maybeSingle()
  if (error) return { ok: false, error: error.message }
  return { ok: true, value: (data as { value?: unknown } | null)?.value ?? null }
}

/** null error = stored; `value` is what the server stored (lists: merged with items this tab didn't know about). */
async function persist(key: SettingKey, value: unknown, remove?: string[]): Promise<{ error: string | null; value?: unknown }> {
  try {
    const r = await saveSettingValue(key, value, remove?.length ? { remove } : undefined)
    return r.ok ? { error: null, value: r.value } : { error: r.error }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Network error' }
  }
}

function upsertInto<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((r) => r.id === item.id)
  if (i === -1) return [...list, item]
  const next = list.slice()
  next[i] = item
  return next
}

export interface SettingListOptions<T> {
  perm: Perm
  label: (t: T) => string
}

/** A settings-stored array as a Crud<T> (EntityManager-compatible). Items are keyed by `id`. */
export function useSettingList<T extends { id: string }>(key: SettingListKey, initial: T[], opts: SettingListOptions<T>): Crud<T> {
  const mode = useCrudMode()
  const allowed = useCan(opts.perm)
  const readOnly = mode === 'live' && !allowed
  const mayDelete = useCanDelete()
  const canDelete = mode !== 'live' || mayDelete
  const labelRef = useRef(opts.label)
  // eslint-disable-next-line react-hooks/refs -- latest-label ref, read only inside callbacks
  labelRef.current = opts.label
  const initialRef = useRef(initial)

  const [rows, setRows] = useState<T[]>(initial)
  const rowsRef = useRef(rows)
  // eslint-disable-next-line react-hooks/refs -- latest-rows ref for optimistic rollback, read only inside callbacks
  rowsRef.current = rows
  const [status, setStatus] = useState<CrudStatus>(mode === 'live' ? 'loading' : 'ready')
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!getAdminClient()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- demo/sandbox: nothing to fetch
      setStatus('ready')
      return
    }
    let alive = true
    setStatus('loading')
    readSetting(key).then((r) => {
      if (!alive) return
      if (!r.ok) {
        setError(r.error)
        setStatus('error')
        return
      }
      // nothing stored (or an empty list) → the site shows the defaults the page passed in
      setRows(Array.isArray(r.value) && r.value.length ? (r.value as T[]) : initialRef.current)
      setError(null)
      setStatus('ready')
    })
    return () => {
      alive = false
    }
  }, [key, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const keyOf = useCallback((t: T) => t.id, [])

  /** optimistic write of a whole list; rolls back + toasts on failure */
  const write = useCallback(
    async (next: T[], success?: string): Promise<boolean> => {
      if (mode === 'demo') {
        explainDemo()
        return false
      }
      if (readOnly) {
        explainReadOnly()
        return false
      }
      const before = rowsRef.current
      setRows(next)
      rowsRef.current = next
      if (mode === 'sandbox') {
        if (success) toast.success(success, { description: 'Sandbox — local only, not stored.' })
        return true
      }
      const r = await persist(key, next)
      if (r.error) {
        setRows(before)
        rowsRef.current = before
        toast.error('Could not save', { description: r.error })
        return false
      }
      // the server keeps items saved elsewhere that this tab didn't have → show the stored list
      if (Array.isArray(r.value)) {
        setRows(r.value as T[])
        rowsRef.current = r.value as T[]
      }
      if (success) toast.success(success)
      return true
    },
    [key, mode, readOnly],
  )

  const save = useCallback(
    (item: T, o?: { quiet?: boolean }) => write(upsertInto(rowsRef.current, item), o?.quiet ? undefined : `Saved “${labelRef.current(item)}”`),
    [write],
  )
  const saveMany = useCallback((items: T[]) => write(items.reduce<T[]>((l, x) => upsertInto(l, x), rowsRef.current)), [write])
  const update = useCallback(
    async (k: string, fn: (t: T) => T, o?: { quiet?: boolean; success?: string }) => {
      const cur = rowsRef.current.find((r) => r.id === k)
      if (!cur) return false
      return write(upsertInto(rowsRef.current, fn(cur)), o?.success)
    },
    [write],
  )

  const reorder = useCallback(
    async (keys: string[]) => {
      const byKey = new Map(rowsRef.current.map((r) => [r.id, r]))
      const moved = keys.map((k) => byKey.get(k)).filter((x): x is T => !!x)
      return write([...moved, ...rowsRef.current.filter((r) => !keys.includes(r.id))])
    },
    [write],
  )

  const shredProps = useCallback(
    (k: string, after?: () => void) => {
      const item = rowsRef.current.find((r) => r.id === k)
      const itemLabel = item ? labelRef.current(item) : 'item'
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
          idx = rowsRef.current.findIndex((r) => r.id === k)
          const next = rowsRef.current.filter((r) => r.id !== k)
          rowsRef.current = next
          setRows(next)
          after?.()
        },
        onUndo: () => {
          if (!item) return
          setRows((rs) => {
            if (rs.some((r) => r.id === k)) return rs
            const next = rs.slice()
            next.splice(Math.max(0, Math.min(idx, next.length)), 0, item)
            rowsRef.current = next
            return next
          })
        },
        onCommit: async () => {
          if (mode !== 'live') return
          // declared removal → the server re-checks the superadmin (checkDelete) before dropping it
          const r = await persist(key, rowsRef.current.filter((x) => x.id !== k), [k])
          if (r.error) throw new Error(r.error)
          if (Array.isArray(r.value)) {
            setRows(r.value as T[])
            rowsRef.current = r.value as T[]
          }
        },
      }
    },
    [key, mode, readOnly, canDelete],
  )

  return useMemo(
    () => ({ mode, readOnly, canDelete, status, error, rows, reload, save, update, shredProps, reorder, keyOf, saveMany }),
    [mode, readOnly, canDelete, status, error, rows, reload, save, update, shredProps, reorder, keyOf, saveMany],
  )
}

export interface SettingObject<T> {
  mode: CrudMode
  readOnly: boolean
  status: CrudStatus
  error: string | null
  value: T
  reload: () => void
  /** validated by the caller; returns true when stored (or applied in sandbox) */
  save: (next: T) => Promise<boolean>
}

/** A settings-stored object (e.g. apparel_custom). */
export function useSettingObject<T extends object>(key: SettingKey, initial: T, perm: Perm): SettingObject<T> {
  const mode = useCrudMode()
  const allowed = useCan(perm)
  const readOnly = mode === 'live' && !allowed
  const initialRef = useRef(initial)
  const [value, setValue] = useState<T>(initial)
  const [status, setStatus] = useState<CrudStatus>(mode === 'live' ? 'loading' : 'ready')
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!getAdminClient()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- demo/sandbox: nothing to fetch
      setStatus('ready')
      return
    }
    let alive = true
    setStatus('loading')
    readSetting(key).then((r) => {
      if (!alive) return
      if (!r.ok) {
        setError(r.error)
        setStatus('error')
        return
      }
      const v = r.value
      setValue(v && typeof v === 'object' && !Array.isArray(v) ? ({ ...initialRef.current, ...(v as Partial<T>) } as T) : initialRef.current)
      setError(null)
      setStatus('ready')
    })
    return () => {
      alive = false
    }
  }, [key, nonce])

  const save = useCallback(
    async (next: T) => {
      if (mode === 'demo') {
        explainDemo()
        return false
      }
      if (readOnly) {
        explainReadOnly()
        return false
      }
      const before = value
      setValue(next)
      if (mode === 'sandbox') return true
      const r = await persist(key, next)
      if (r.error) {
        setValue(before)
        toast.error('Could not save', { description: r.error })
        return false
      }
      return true
    },
    [key, mode, readOnly, value],
  )

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { mode, readOnly, status, error, value, reload, save }
}
