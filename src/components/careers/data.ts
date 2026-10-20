// Careers — server data for the public /careers pages. Owner: CAREERS.
// 'use cache' + cacheTag('careers') with the cookie-less publicClient() (RLS: anon reads OPEN jobs only),
// so /careers stays static. Admin writes call updateTag('careers') (src/components/admin/careers/actions.ts).
// Never throws: an unconfigured / unreachable Supabase (or the table not migrated yet) → no jobs.
// Server-only — do not import from 'use client' files.
import { cacheLife, cacheTag } from 'next/cache'
import { publicClient } from '@/lib/supabase/server'
import { jobFromRow, type Job } from './model'

export const CAREERS_TAG = 'careers'

export async function getOpenJobs(): Promise<Job[]> {
  'use cache'
  cacheLife('hours')
  cacheTag(CAREERS_TAG)
  const sb = publicClient()
  if (!sb) return []
  try {
    const { data, error } = await sb.from('jobs').select('*').eq('status', 'open').order('created_at', { ascending: false })
    if (error || !Array.isArray(data)) return []
    return (data as Record<string, unknown>[]).map(jobFromRow)
  } catch {
    return []
  }
}

export async function getOpenJob(slug: string): Promise<Job | null> {
  'use cache'
  cacheLife('hours')
  cacheTag(CAREERS_TAG)
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null
  const sb = publicClient()
  if (!sb) return null
  try {
    const { data, error } = await sb.from('jobs').select('*').eq('slug', slug).eq('status', 'open').maybeSingle()
    if (error || !data) return null
    return jobFromRow(data as Record<string, unknown>)
  } catch {
    return null
  }
}
