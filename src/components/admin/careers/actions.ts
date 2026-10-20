'use server'
// Careers admin — server actions. Owner: CAREERS.
// Job/application writes happen in the browser under RLS (has_perm('careers.edit')), like every other admin
// CRUD page; this action refreshes the public /careers cache afterwards. It re-checks the caller's
// permission server-side and accepts no input (nothing to validate beyond the session).
import { updateTag } from 'next/cache'
import { checkPerm } from '../server'
import { CAREERS_TAG } from '@/components/careers/data'

export async function revalidateCareers(): Promise<{ ok: boolean; error?: string }> {
  const auth = await checkPerm('careers.edit')
  if (!auth.ok) return { ok: false, error: auth.error }
  updateTag(CAREERS_TAG)
  return { ok: true }
}
