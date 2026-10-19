'use client'
// P4b — generic CRUD list + editor drawer (zod-validated, optimistic save, reorder, #69 shred + undo).
// Used by Products, Collections, Events & Partners and Instagram.
import { useEffect, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import type { ZodType } from 'zod'
import { ConfirmShred } from '../ConfirmShred'
import { DataTable, type DataTableColumn } from '../DataTable'
import { EmptyState } from '../EmptyState'
import { adminBtn } from '../ui'
import type { Crud } from './data'
import { Drawer, SaveBar, StateSwitch, issuesToErrors } from './kit'

export interface EntityManagerProps<T> {
  crud: Crud<T>
  caption: string
  noun: string
  jp?: string
  columns: DataTableColumn<T>[]
  searchText: (t: T) => string
  blank: () => T
  schema: ZodType<unknown>
  form: (draft: T, set: (patch: Partial<T>) => void, errors: Record<string, string>, isNew: boolean) => ReactNode
  /** extra writes before save (e.g. single drop-of-week swap); return false to abort */
  beforeSave?: (draft: T) => Promise<boolean> | boolean
  reorderable?: boolean
  toolbar?: ReactNode
  rows?: T[]
  emptyBody?: ReactNode
  wide?: boolean
}

export function EntityManager<T>({
  crud, caption, noun, jp, columns, searchText, blank, schema, form, beforeSave, reorderable, toolbar, rows, emptyBody, wide,
}: EntityManagerProps<T>) {
  const [draft, setDraft] = useState<T | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const list = rows ?? crud.rows

  useEffect(() => {
    if (!draft) { setErrors({}); setDirty(false) }
  }, [draft])

  const openNew = () => { setDraft(blank()); setIsNew(true) }
  const openEdit = (t: T) => { setDraft(structuredClone(t)); setIsNew(false) }
  const set = (patch: Partial<T>) => { setDraft((d) => (d ? { ...d, ...patch } : d)); setDirty(true) }

  const save = async () => {
    if (!draft) return
    const r = schema.safeParse(draft)
    if (!r.success) { setErrors(issuesToErrors(r.error.issues)); return }
    setErrors({})
    setSaving(true)
    if (beforeSave && !(await beforeSave(draft))) { setSaving(false); return }
    const ok = await crud.save(draft)
    setSaving(false)
    if (ok) setDraft(null)
  }

  const move = (t: T, dir: -1 | 1) => {
    const keys = crud.rows.map(crud.keyOf)
    const i = keys.indexOf(crud.keyOf(t))
    const j = i + dir
    if (j < 0 || j >= keys.length) return
    ;[keys[i], keys[j]] = [keys[j], keys[i]]
    void crud.reorder(keys)
  }

  return (
    <>
      <StateSwitch status={crud.status} error={crud.error} onRetry={crud.reload}>
        <DataTable
          caption={caption}
          rows={list}
          columns={columns}
          rowKey={crud.keyOf}
          onRowClick={openEdit}
          selectedKey={draft && !isNew ? crud.keyOf(draft) : null}
          search={{ placeholder: `Search ${caption.toLowerCase()}…`, text: searchText }}
          pageSize={reorderable ? 0 : 25}
          toolbar={
            <>
              <button type="button" onClick={openNew} className={adminBtn()}>
                <Plus aria-hidden className="size-4" /> New {noun}
              </button>
              {toolbar}
            </>
          }
          rowActions={(t) => (
            <span className="flex items-center gap-0.5">
              {reorderable && (
                <>
                  <button type="button" aria-label="Move up" onClick={() => move(t, -1)} className="grid size-11 place-items-center text-paper/55 focus-ring can-hover:hover:text-volt"><ArrowUp aria-hidden className="size-4" /></button>
                  <button type="button" aria-label="Move down" onClick={() => move(t, 1)} className="grid size-11 place-items-center text-paper/55 focus-ring can-hover:hover:text-volt"><ArrowDown aria-hidden className="size-4" /></button>
                </>
              )}
              <ConfirmShred {...crud.shredProps(crud.keyOf(t))} />
            </span>
          )}
          empty={<EmptyState title={`No ${caption.toLowerCase()} yet`} body={emptyBody ?? `Add the first ${noun}.`} action={<button type="button" onClick={openNew} className={adminBtn()}><Plus aria-hidden className="size-4" /> New {noun}</button>} />}
        />
      </StateSwitch>

      <Drawer
        open={!!draft}
        onClose={() => setDraft(null)}
        title={isNew ? `New ${noun}` : `Edit ${noun}`}
        jp={jp}
        wide={wide}
        footer={draft && <SaveBar saving={saving} dirty={dirty} mode={crud.mode} onSave={save} onCancel={() => setDraft(null)} extra={Object.keys(errors).length ? <span role="alert" className="label text-[10px] text-hype">{Object.keys(errors).length} field(s) to fix</span> : null} />}
      >
        {draft && form(draft, set, errors, isNew)}
      </Drawer>
    </>
  )
}
