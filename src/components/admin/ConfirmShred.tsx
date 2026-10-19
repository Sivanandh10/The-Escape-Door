'use client'
// #69 delete-with-undo (P4a). Trash button → paper slip "Shred this?" → slip feeds into the shredder and falls
// out as strips → onConfirm() (optimistic remove) → sonner toast "Shredded … · Undo" → onCommit() when the
// undo window closes (or on pagehide). Undo → onUndo() and nothing is committed.
//   <ConfirmShred itemLabel={lead.name} onConfirm={() => hide(id)} onUndo={() => restore(id)} onCommit={() => del(id)} />
// Imperative (bulk, no popover):  shredWithUndo({ itemLabel: '3 leads', onConfirm, onUndo, onCommit })
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { Lock, Trash2 } from 'lucide-react'
import { prefersReducedMotion } from '@/lib/motion'
import { cn, seeded } from '@/lib/utils'
import { adminBtn } from './ui'

export interface ShredOptions {
  /** what is being deleted, shown on the slip + toast ("Riya · Surat") */
  itemLabel: string
  /** optimistic removal from the UI — runs immediately after the shred */
  onConfirm: () => void
  /** the real delete — runs once the undo window closes (await-able); throw to show an error toast */
  onCommit?: () => void | Promise<void>
  /** restore the item in the UI */
  onUndo?: () => void
  /** undo window in ms (default 6000) */
  undoMs?: number
}

export interface ConfirmShredProps extends ShredOptions {
  /** trigger text; icon-only when variant="icon" (default) */
  label?: string
  variant?: 'icon' | 'button'
  /** confirm button text (default "Shred it") */
  confirmText?: string
  disabled?: boolean
  /** shown as tooltip + in the popover when disabled (e.g. DEMO_WRITE_NOTE) */
  disabledReason?: string
  /** hierarchy lock (not the superadmin): lock icon instead of the bin, disabled, tooltip = disabledReason */
  locked?: boolean
  className?: string
}

// pending commits survive the row unmounting; flushed on pagehide (best effort)
const pending = new Map<string, () => void>()
let flushBound = false
function bindFlush() {
  if (flushBound || typeof window === 'undefined') return
  flushBound = true
  window.addEventListener('pagehide', () => {
    for (const commit of [...pending.values()]) commit()
  })
}

/** Optimistic remove + undo toast + deferred commit. Returns the toast id. */
export function shredWithUndo({ itemLabel, onConfirm, onCommit, onUndo, undoMs = 6000 }: ShredOptions): string {
  bindFlush()
  const id = `shred-${Date.now().toString(36)}-${Math.floor(performance.now()).toString(36)}`
  let settled = false
  const commit = () => {
    if (settled) return
    settled = true
    pending.delete(id)
    if (!onCommit) return
    Promise.resolve()
      .then(onCommit)
      .catch((err: unknown) => {
        onUndo?.()
        toast.error(`Couldn't delete “${itemLabel}” — it's back in the list.`, {
          description: err instanceof Error && err.message ? err.message : undefined,
        })
      })
  }
  const undo = () => {
    if (settled) return
    settled = true
    pending.delete(id)
    onUndo?.()
    toast.success(`Restored “${itemLabel}”`, { duration: 2200 })
  }
  pending.set(id, commit)
  onConfirm()
  toast(`Shredded “${itemLabel}”`, {
    id,
    description: 'Gone in a few seconds unless you undo.',
    duration: undoMs,
    action: { label: 'Undo', onClick: undo },
    onAutoClose: commit,
    onDismiss: commit,
  })
  return id
}

const STRIPS = 9

export function ConfirmShred({
  itemLabel, onConfirm, onCommit, onUndo, undoMs, label = 'Delete', variant = 'icon', confirmText = 'Shred it',
  disabled, disabledReason, locked, className,
}: ConfirmShredProps) {
  const off = disabled || locked
  const [open, setOpen] = useState(false)
  const [shredding, setShredding] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  const close = useCallback((refocus = true) => {
    setOpen(false)
    setShredding(false)
    if (refocus) triggerRef.current?.focus()
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      const W = 300, H = 236, m = 12
      let left = r.right - W
      left = Math.max(m, Math.min(left, window.innerWidth - W - m))
      let top = r.bottom + 8
      if (top + H > window.innerHeight - m) top = Math.max(m, r.top - H - 8)
      setPos({ top, left })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open])

  useEffect(() => {
    if (!open) return
    popRef.current?.querySelector<HTMLButtonElement>('[data-keep]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'Tab' && popRef.current) {
        const f = popRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    const onDown = (e: PointerEvent) => {
      if (!popRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) close(false)
    }
    const onScroll = () => close(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', onScroll, { capture: true })
    }
  }, [open, close])

  const confirm = () => {
    if (shredding) return
    const go = () => {
      setOpen(false)
      setShredding(false)
      shredWithUndo({ itemLabel, onConfirm, onCommit, onUndo, undoMs })
    }
    if (prefersReducedMotion()) return go()
    setShredding(true)
    window.setTimeout(go, 640)
  }

  const rnd = seeded(itemLabel.length * 97 + 13)
  const strips = Array.from({ length: STRIPS }, (_, i) => ({
    sx: (rnd() - 0.5) * 36,
    sr: (rnd() - 0.5) * 34,
    d: 120 + i * 22 + rnd() * 40,
  }))

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={variant === 'icon' || locked ? `${label} ${itemLabel}${locked && disabledReason ? ` — ${disabledReason}` : ''}` : undefined}
        title={off ? disabledReason : `${label} ${itemLabel}`}
        aria-disabled={off || undefined}
        data-locked={locked ? 'true' : undefined}
        onClick={(e) => {
          e.stopPropagation()
          if (off) {
            if (disabledReason) toast(disabledReason, { id: locked ? 'delete-locked' : undefined, icon: locked ? <Lock aria-hidden className="size-4" /> : undefined })
            return
          }
          setOpen((o) => !o)
        }}
        className={cn(
          variant === 'icon'
            ? 'grid size-11 place-items-center border-2 border-transparent text-paper/60 transition-colors duration-150 focus-ring can-hover:hover:border-hype can-hover:hover:text-hype aria-expanded:border-hype aria-expanded:text-hype aria-disabled:opacity-40'
            : adminBtn({ variant: 'ghost', size: 'sm', className: 'can-hover:hover:border-hype can-hover:hover:text-hype aria-disabled:opacity-50' }),
          locked && 'cursor-not-allowed can-hover:hover:border-paper/25 can-hover:hover:text-paper/70',
          className,
        )}
      >
        {locked ? <Lock aria-hidden="true" className="size-4" /> : <Trash2 aria-hidden="true" className="size-4" />}
        {variant === 'button' && label}
      </button>

      {open && pos && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popRef}
            role="alertdialog"
            aria-modal="false"
            aria-labelledby={titleId}
            className="fixed z-[120] w-[300px] border-4 border-ink bg-ink text-paper shadow-[6px_6px_0_var(--color-hype)]"
            style={{ top: pos.top, left: pos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-hype px-3 py-1.5 text-paper">
              <p id={titleId} className="font-display text-[20px] uppercase leading-none">Shred this?</p>
              <span lang="ja" aria-hidden="true" className="font-sfx-jp text-[13px]">ビリビリ</span>
            </div>
            {/* the slip + shredder mouth */}
            <div className="relative h-[92px] overflow-hidden px-4 pt-3">
              <div className={cn('relative z-0 border-2 border-ink bg-paper px-3 py-2 text-ink grain', shredding && 'admin-slip-feed')}>
                <p className="label text-[9.5px] text-ink/60">Deleting</p>
                <p className="truncate font-semibold">{itemLabel}</p>
              </div>
              {/* shredder slot */}
              <div className="absolute inset-x-2 bottom-0 z-10 h-4 border-2 border-paper/30 bg-tone-2" aria-hidden="true">
                <div className="tone-bg h-full opacity-40 [--tone-color:var(--color-paper)] [--tone-step:4px]" />
              </div>
            </div>
            {/* strips falling out under the slot */}
            <div className="pointer-events-none relative h-0" aria-hidden="true">
              {shredding && (
                <div className="absolute inset-x-5 top-0 flex h-[72px] gap-[3px] overflow-visible">
                  {strips.map((s, i) => (
                    <span
                      key={i}
                      className="admin-strip block h-full flex-1 border-x border-ink/30 bg-paper"
                      style={{ ['--sx' as string]: `${s.sx}px`, ['--sr' as string]: `${s.sr}deg`, ['--d' as string]: `${s.d}ms` }}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="relative z-10 bg-ink px-4 pb-4 pt-5">
              <p className="mb-3 text-[12.5px] leading-snug text-paper/65">You get a few seconds to undo before it&apos;s gone for good.</p>
              <div className="flex gap-2">
                <button type="button" data-keep="" onClick={() => close()} className={adminBtn({ variant: 'ghost', size: 'sm', className: 'flex-1' })}>
                  Keep
                </button>
                <button type="button" onClick={confirm} disabled={shredding} className={adminBtn({ variant: 'danger', size: 'sm', className: 'flex-1' })}>
                  <Trash2 aria-hidden="true" className="size-3.5" />
                  {shredding ? 'Shredding…' : confirmText}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
