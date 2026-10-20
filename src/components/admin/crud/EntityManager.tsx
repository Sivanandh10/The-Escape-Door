'use client'
// P4b — generic CRUD list + editor drawer (zod-validated, optimistic save, reorder, #69 shred + undo).
// Used by Products, Collections, Deals, Custom rules, Pricing (tiers / fits), Events & Partners, Instagram and QR links.
// Add = toolbar "New …"; Edit = row click → drawer; Delete = row shredder + drawer "Delete" (superadmin only, lock otherwise).
import { useEffect, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import type { ZodType } from 'zod'
import { ConfirmShred } from '../ConfirmShred'
import { DataTable, type DataTableColumn } from '../DataTable'
import { EmptyState } from '../EmptyState'
import { adminBtn } from '../ui'
import { READONLY_NOTE } from '../AdminContext'
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form state when the drawer closes
    if (!draft) { setErrors({}); setDirty(false) }
  }, [draft])

  const openNew = () => { setDraft(blank()); setIsNew(true) }
  const openEdit = (t: T) => { setDraft(structuredClone(t)); setIsNew(false) }
  const set = (patch: Partial<T>) => { setDraft((d) => (d ? { ...d, ...patch } : d)); setDirty(true) }

  const save = async () => {
    if (!draft) return
    const r = schema.safeParse(draft)
    if (!r.success) { setErrors(issuesToErrors(r.error.issues)); return }
    // "New" must never overwrite an existing row/item that happens to share the key (saves are upserts)
    if (isNew) {
      const k = crud.keyOf(draft)
      if (k && crud.rows.some((x) => crud.keyOf(x) === k)) {
        const field = (['id', 'slug', 'type'] as const).find((f) => (draft as Record<string, unknown>)[f] === k) ?? 'id'
        setErrors({ [field]: `“${k}” already exists — open it from the list to edit it, or pick another` })
        return
      }
    }
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
              <button type="button" onClick={openNew} disabled={crud.readOnly} title={crud.readOnly ? READONLY_NOTE : undefined} className={adminBtn()}>
                <Plus aria-hidden className="size-4" /> New {noun}
              </button>
              {toolbar}
            </>
          }
          rowActions={(t) => (
            <span className="flex items-center gap-0.5">
              {reorderable && (
                <>
                  <button type="button" aria-label="Move up" disabled={crud.readOnly} onClick={() => move(t, -1)} className="grid size-11 place-items-center text-paper/55 focus-ring can-hover:hover:text-volt"><ArrowUp aria-hidden className="size-4" /></button>
                  <button type="button" aria-label="Move down" disabled={crud.readOnly} onClick={() => move(t, 1)} className="grid size-11 place-items-center text-paper/55 focus-ring can-hover:hover:text-volt"><ArrowDown aria-hidden className="size-4" /></button>
                </>
              )}
              <ConfirmShred {...crud.shredProps(crud.keyOf(t))} />
            </span>
          )}
          empty={<EmptyState title={`No ${caption.toLowerCase()} yet`} body={emptyBody ?? `Add the first ${noun}.`} action={crud.readOnly ? undefined : <button type="button" onClick={openNew} className={adminBtn()}><Plus aria-hidden className="size-4" /> New {noun}</button>} />}
        />
      </StateSwitch>

      <Drawer
        open={!!draft}
        onClose={() => setDraft(null)}
        title={isNew ? `New ${noun}` : `Edit ${noun}`}
        jp={jp}
        wide={wide}
        footer={draft && (
          <SaveBar
            saving={saving}
            dirty={dirty}
            mode={crud.mode}
            readOnly={crud.readOnly}
            onSave={save}
            onCancel={() => setDraft(null)}
            extra={
              <>
                {Object.keys(errors).length ? <span role="alert" className="label text-[10px] text-hype">{Object.keys(errors).length} field(s) to fix</span> : null}
                {/* delete from inside the editor too (superadmin: shredder; everyone else: lock) */}
                {!isNew && <ConfirmShred {...crud.shredProps(crud.keyOf(draft), () => setDraft(null))} variant="button" label="Delete" />}
              </>
            }
          />
        )}
      >
        {draft && form(draft, set, errors, isNew)}
      </Drawer>
    </>
  )
}
