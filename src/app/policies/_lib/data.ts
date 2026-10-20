// Pages CMS — public reads (server only). Cookie-less client inside 'use cache' (+ cacheTag 'pages'), so
// /policies/* stays static; admin saves call updateTag('pages') (src/components/admin/pages/actions.ts).
// Fallback: the built-in copy in @/components/content/policies when the row is missing, Supabase is not
// configured, or the query fails. Never throws.
import { cacheLife, cacheTag } from 'next/cache'
import { publicClient } from '@/lib/supabase/server'
import { POLICIES, POLICIES_UPDATED, policyBySlug } from '@/components/content/policies'

export const PAGES_TAG = 'pages'
export const PAGE_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

export interface PublicPage {
  slug: string
  /** visible H1 */
  h1: string
  /** absolute SEO title */
  seoTitle: string
  description: string
  jp: string
  kicker: string
  body: string
  /** "19 October 2026" */
  updatedLabel: string
  source: 'db' | 'builtin'
}

interface PageRow {
  slug: string
  title: string
  description: string | null
  body_md: string
  updated_at: string | null
}

/** All CMS rows (public columns only), or null when Supabase is unavailable. */
async function loadPageRows(): Promise<PageRow[] | null> {
  'use cache'
  cacheLife('hours')
  cacheTag(PAGES_TAG)
  const sb = publicClient()
  if (!sb) return null
  try {
    const { data, error } = await sb.from('pages').select('slug,title,description,body_md,updated_at').limit(200)
    if (error) return null
    return (data ?? []) as PageRow[]
  } catch {
    return null
  }
}

const fmtDay = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return POLICIES_UPDATED
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

function fromBuiltin(slug: string): PublicPage | null {
  const p = policyBySlug(slug)
  if (!p) return null
  return {
    slug: p.slug, h1: p.h1, seoTitle: p.title, description: p.description, jp: p.jp, kicker: p.kicker,
    body: p.body, updatedLabel: POLICIES_UPDATED, source: 'builtin',
  }
}

function fromRow(r: PageRow): PublicPage {
  const b = policyBySlug(r.slug)
  const h1 = (r.title || b?.h1 || r.slug).trim()
  return {
    slug: r.slug,
    h1,
    seoTitle: b && h1 === b.h1 ? b.title : `${h1} | The Escape Door`,
    description: (r.description || '').trim() || b?.description || `${h1} — The Escape Door.`,
    jp: b?.jp ?? 'ページ',
    kicker: b?.kicker ?? `Pages · ${h1}`,
    body: r.body_md ?? '',
    updatedLabel: r.updated_at ? fmtDay(r.updated_at) : POLICIES_UPDATED,
    source: 'db',
  }
}

/** One page: the CMS row when present, else the built-in policy, else null (→ 404). */
export async function getPublicPage(slug: string): Promise<PublicPage | null> {
  if (!PAGE_SLUG_RE.test(slug)) return null
  const rows = await loadPageRows()
  const row = rows?.find((r) => r.slug === slug && (r.body_md ?? '').trim())
  return row ? fromRow(row) : fromBuiltin(slug)
}

/** Every page that renders under /policies/*: the four built-ins plus any page added in the admin. */
export async function getPublicPages(): Promise<Array<Pick<PublicPage, 'slug' | 'h1'>>> {
  const rows = (await loadPageRows()) ?? []
  const out = new Map<string, string>(POLICIES.map((p) => [p.slug, p.h1]))
  for (const r of rows) if (PAGE_SLUG_RE.test(r.slug) && (r.body_md ?? '').trim()) out.set(r.slug, (r.title || r.slug).trim())
  return [...out.entries()].map(([slug, h1]) => ({ slug, h1 }))
}
