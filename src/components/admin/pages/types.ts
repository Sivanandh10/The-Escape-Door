// Pages CMS — shapes shared by the admin page (server), its actions and the editor (client).

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
}

export type PageResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: 'slug' | 'title' | 'description' | 'body'; conflict?: AdminPageRow }

export const PAGE_LIMITS = { title: 120, description: 300, body: 60000 } as const
