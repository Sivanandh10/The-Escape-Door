'use client'
// Saved QR links (settings 'qr_links', perm qr.use): list + Add / Edit (label, src, path) / Delete
// (superadmin shredder, lock for everyone else) + "Load" back into the builder.
import { z } from 'zod'
import { Upload } from 'lucide-react'
import { AdminPanel } from '../AdminPage'
import { adminBtn } from '../ui'
import type { Crud } from '../crud/data'
import { EntityManager } from '../crud/EntityManager'
import { FormSection, TextField } from '../crud/kit'
import { fmtDate, newId } from '../crud/util'
import type { QrLink } from '../crud/settingsSchemas'

const linkSchema = z.object({
  label: z.string().trim().min(2, 'Name it (e.g. Mood Indigo 2026 · stall B)').max(80),
  src: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase-with-dashes').max(40),
  path: z.string().regex(/^\/[a-z0-9\-/]*$/, 'A site path, e.g. / or /arc/naruto').max(120),
})

export function newQrLink(src: string, path: string, label: string): QrLink {
  return { id: newId('qr-'), src, path, label, createdAt: new Date().toISOString() }
}

export function SavedLinks({ crud, siteUrl, onLoad, buildUrl, slugify }: {
  crud: Crud<QrLink>
  siteUrl: string
  onLoad: (l: QrLink) => void
  buildUrl: (siteUrl: string, path: string, src: string) => string
  slugify: (v: string) => string
}) {
  return (
    <AdminPanel id="qr-saved" index={2} title={<>Saved <em className="accent">links</em></>} jp="保存済み" shadow="volt">
      <EntityManager<QrLink>
        crud={crud}
        caption="Saved links"
        noun="link"
        jp="リンク編集"
        reorderable
        searchText={(l) => `${l.label} ${l.src} ${l.path}`}
        blank={() => newQrLink('', '/', '')}
        schema={linkSchema}
        emptyBody="Build a link above and tap “Save link” — every stall's QR stays here to reprint."
        columns={[
          { id: 'label', header: 'Link', cell: (l) => <span className="block leading-tight"><span className="font-semibold">{l.label || l.src}</span><span className="block font-mono text-[11px] text-paper/50">{fmtDate(l.createdAt)}</span></span> },
          { id: 'src', header: 'src → page', cell: (l) => <span className="font-mono text-[12px]"><span className="text-volt">{l.src}</span> → {l.path}</span> },
          {
            id: 'load', header: '', className: 'w-[96px]',
            cell: (l) => (
              <button type="button" onClick={(e) => { e.stopPropagation(); onLoad(l) }} className={adminBtn({ variant: 'ghost', size: 'sm', className: 'min-h-10' })}>
                <Upload aria-hidden className="size-3.5" /> Load
              </button>
            ),
          },
        ]}
        form={(l, set, e) => (
          <FormSection title="Link" jp="リンク">
            <TextField className="sm:col-span-2" label="Label" value={l.label} error={e.label} maxLength={80} onChange={(label) => set({ label })} placeholder="Mood Indigo 2026 · stall B" />
            <TextField label="src (attribution tag)" mono value={l.src} error={e.src} onChange={(src) => set({ src: slugify(src) })} hint="Scans are counted under this tag." />
            <TextField label="Landing path" mono value={l.path} error={e.path} onChange={(path) => set({ path: path.trim().toLowerCase() })} placeholder="/arc/jujutsu-kaisen" />
            <p className="break-all font-mono text-[11.5px] text-paper/55 sm:col-span-2">{l.src ? buildUrl(siteUrl, l.path || '/', l.src) : 'Fill src to see the tracked link.'}</p>
          </FormSection>
        )}
      />
    </AdminPanel>
  )
}
