// Pages CMS — shapes shared by the admin page (server), its actions and the editor (client).

/** An unpublished working copy (public.page_drafts, status 'draft' — migration 0014). */
export interface AdminPageDraft {
  title: string
  description: string
  body: string
  /** e.g. "DRAFT — typical terms, not yet confirmed…" (seeded drafts); '' for drafts saved in the editor */
  note: string
  updatedAt: string | null
  updatedByName: string | null
}

export interface AdminPageRow {
  slug: string
  title: string
  description: string
  /** markdown (CMS dialect, see src/app/policies/_lib/markdown.tsx) */
  body: string
  /** DB updated_at (ISO) — null while the page still shows its built-in text */
  updatedAt: string | null
  updatedByName: string | null
  /** a row exists in public.pages (false = built-in text, not saved to the database yet) */
  stored: boolean
  /** one of the four built-in policies (deleting its row resets it to the built-in text) */
  builtin: boolean
  /** the page is on the site (stored, or a built-in). false = it exists only as a draft (never published) */
  live: boolean
  /** open draft (not on the site yet), or null */
  draft: AdminPageDraft | null
}

export type PageResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: 'slug' | 'title' | 'description' | 'body'; conflict?: AdminPageRow }

export const PAGE_LIMITS = { title: 120, description: 300, body: 60000 } as const
