'use server'
// P4b — cache invalidation after admin writes. The write itself happens in the browser under RLS;
// this action only tells Next to drop the 'use cache' entries for the touched catalogue tags.
import { updateTag } from 'next/cache'
import { TAGS } from '@/lib/data/repo'
import { getAdminSession } from '@/lib/supabase/server'

type TagKey = keyof typeof TAGS

export async function revalidateCatalog(keys: TagKey[]): Promise<{ ok: boolean }> {
  const session = await getAdminSession()
  if (!session?.isAdmin) return { ok: false }
  for (const k of new Set(keys)) {
    const tag = TAGS[k]
    if (tag) updateTag(tag)
  }
  return { ok: true }
}
