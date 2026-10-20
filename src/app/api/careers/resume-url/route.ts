// POST /api/careers/resume-url — signed upload URL for a résumé (private bucket 'careers'). Owner: CAREERS.
// Body { filename, contentType, size } → { bucket, path, token, maxBytes }.
// The browser then calls supabaseBrowser().storage.from(bucket).uploadToSignedUrl(path, token, file) and passes
// `path` to POST /api/careers/apply, which checks the object really exists (and its size) before saving.
// Path: resumes/<yyyy-mm>/<uuid>.<ext> — no user input in the path. pdf/doc/docx only, ≤ 5 MB.
// Same-origin + per-IP rate limit. 503 { error: 'uploads-unconfigured' } when Supabase isn't set up.
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { RESUME_MAX_BYTES, RESUME_TYPES } from '@/components/careers/model'
import { allow, clientKey, json, readJson, sameOrigin } from '../../_lib/guard'

const BUCKET = 'careers'

const Req = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.enum(Object.keys(RESUME_TYPES) as [string, ...string[]], { error: 'Upload a PDF or Word file (.pdf, .doc, .docx).' }),
  size: z.number().int().positive().max(RESUME_MAX_BYTES, { error: 'Max file size is 5 MB.' }),
})

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403)
  if (!allow(`careers-upload:ip:${clientKey(req)}`, 10, 60 * 60_000)) {
    return json({ error: 'rate-limited' }, 429, { 'retry-after': '3600' })
  }

  const body = await readJson(req, 2 * 1024)
  if ('error' in body) return json({ error: 'invalid' }, 400)
  const parsed = Req.safeParse(body.data)
  if (!parsed.success) return json({ error: 'invalid', fieldErrors: z.flattenError(parsed.error).fieldErrors }, 400)

  const sb = supabaseAdmin()
  if (!sb) return json({ error: 'uploads-unconfigured' }, 503)

  const ext = RESUME_TYPES[parsed.data.contentType]
  const now = new Date()
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const path = `resumes/${month}/${randomUUID()}.${ext}`

  try {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path)
    if (error || !data) {
      console.error('[api/careers/resume-url] sign failed', error?.message)
      return json({ error: 'uploads-unavailable' }, 503)
    }
    return json({ bucket: BUCKET, path: data.path ?? path, token: data.token, maxBytes: RESUME_MAX_BYTES })
  } catch (e) {
    console.error('[api/careers/resume-url] threw', e instanceof Error ? e.message : e)
    return json({ error: 'uploads-unavailable' }, 503)
  }
}
