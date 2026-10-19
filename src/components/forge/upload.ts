// Artwork upload: POST /api/upload-url → PUT to the signed URL (XHR for progress) → 7-day view link.
// Owner: P3 forge. Never throws: returns a result the UI can always continue from.
import { supabaseBrowser } from '@/lib/supabase/client'

export const ACCEPT: Record<string, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'image/webp': 'WebP',
  'image/svg+xml': 'SVG',
  'application/pdf': 'PDF',
}
export const ACCEPT_ATTR = '.png,.jpg,.jpeg,.webp,.svg,.pdf,image/png,image/jpeg,image/webp,image/svg+xml,application/pdf'
export const MAX_BYTES = 10 * 1024 * 1024
export const MAX_FILES = 6

export function fileProblem(f: File): string | null {
  if (!ACCEPT[f.type]) return `${f.name}: use PNG, JPG, WebP, SVG or PDF.`
  if (f.size > MAX_BYTES) return `${f.name} is ${(f.size / 1048576).toFixed(1)} MB — the limit is 10 MB.`
  if (f.size === 0) return `${f.name} looks empty.`
  return null
}

export type UploadOutcome =
  | { status: 'ok'; url: string }
  | { status: 'unconfigured' }
  | { status: 'failed'; reason: string }

function putWithProgress(url: string, file: File, onProgress: (p: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('content-type', file.type)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
    xhr.onerror = () => resolve(false)
    xhr.ontimeout = () => resolve(false)
    xhr.timeout = 120_000
    xhr.send(file)
  })
}

async function post(body: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch('/api/upload-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, data }
}

export async function uploadArtwork(file: File, onProgress: (p: number) => void): Promise<UploadOutcome> {
  try {
    const sign = await post({ filename: file.name.slice(0, 200), contentType: file.type, size: file.size })
    if (sign.status === 503) return { status: 'unconfigured' }
    if (sign.status !== 200) return { status: 'failed', reason: String(sign.data.error ?? 'sign') }
    const { signedUrl, path, token, bucket } = sign.data as { signedUrl?: string; path?: string; token?: string; bucket?: string }
    if (!signedUrl || !path) return { status: 'failed', reason: 'sign' }

    onProgress(0.02)
    let ok = await putWithProgress(signedUrl, file, onProgress)
    if (!ok && token && bucket) {
      // fallback: the SDK path (no progress events)
      const sb = supabaseBrowser()
      if (sb) {
        const { error } = await sb.storage.from(bucket).uploadToSignedUrl(path, token, file)
        ok = !error
      }
    }
    if (!ok) return { status: 'failed', reason: 'upload' }
    onProgress(1)

    const view = await post({ viewPath: path })
    const url = typeof view.data.url === 'string' ? view.data.url : ''
    return url ? { status: 'ok', url } : { status: 'failed', reason: 'view' }
  } catch {
    return { status: 'failed', reason: 'network' }
  }
}
