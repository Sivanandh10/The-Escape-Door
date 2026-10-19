// POST /api/upload-url — Custom Forge artwork uploads straight to Supabase Storage.
// Owner: F2. Bucket `custom-uploads` (private). Two modes:
//   1. { filename, contentType, size }  → { bucket, path, token, signedUrl }
//      Browser then: supabaseBrowser().storage.from(bucket).uploadToSignedUrl(path, token, file)
//      (or PUT the file to signedUrl). Path: custom/<yyyy-mm>/<uuid>.<ext>
//   2. { viewPath }                     → { url } 7-day signed read link for the WhatsApp message
// When Supabase isn't configured: 503 { error: 'uploads-unconfigured' } → UI falls back to
// "send the file on WhatsApp".
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { allow, clientKey, json, readJson, sameOrigin } from '../_lib/guard'

const BUCKET = 'custom-uploads'
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
}
const VIEW_TTL = 7 * 24 * 60 * 60

const UploadReq = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.enum(Object.keys(TYPES) as [string, ...string[]], { error: 'Use PNG, JPG, WebP, SVG or PDF.' }),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, { error: 'Max file size is 10 MB.' }),
})
const ViewReq = z.object({
  viewPath: z.string().regex(/^custom\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(png|jpg|webp|svg|pdf)$/),
})

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403)
  if (!allow(`upload:ip:${clientKey(req)}`, 30, 60 * 60_000)) {
    return json({ error: 'rate-limited' }, 429, { 'retry-after': '3600' })
  }

  const body = await readJson(req, 4 * 1024)
  if ('error' in body) return json({ error: 'invalid' }, 400)

  const sb = supabaseAdmin()

  const view = ViewReq.safeParse(body.data)
  if (view.success) {
    if (!sb) return json({ error: 'uploads-unconfigured' }, 503)
    try {
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(view.data.viewPath, VIEW_TTL)
      if (error || !data?.signedUrl) return json({ error: 'not-found' }, 404)
      return json({ url: data.signedUrl, expiresIn: VIEW_TTL })
    } catch {
      return json({ error: 'server' }, 500)
    }
  }

  const parsed = UploadReq.safeParse(body.data)
  if (!parsed.success) {
    return json({ error: 'invalid', fieldErrors: z.flattenError(parsed.error).fieldErrors }, 400)
  }
  if (!sb) return json({ error: 'uploads-unconfigured' }, 503)

  const ext = TYPES[parsed.data.contentType]
  // UTC month folder (no user input in the path).
  const now = new Date()
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const path = `custom/${month}/${randomUUID()}.${ext}`

  try {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path)
    if (error || !data) {
      console.error('[api/upload-url] sign failed', error?.message)
      return json({ error: 'uploads-unavailable' }, 503)
    }
    return json({ bucket: BUCKET, path: data.path ?? path, token: data.token, signedUrl: data.signedUrl, maxBytes: MAX_UPLOAD_BYTES })
  } catch (e) {
    console.error('[api/upload-url] threw', e instanceof Error ? e.message : e)
    return json({ error: 'uploads-unavailable' }, 503)
  }
}
