// GET /api/auth/mal/status → { enabled } — the login modal hides the MyAnimeList button until the Netlify env
// vars MAL_CLIENT_ID / MAL_CLIENT_SECRET (or the app_secrets rows, 0013) are set (owner: AUTH). Never reveals the values.
import { connection } from 'next/server'
import { isMalConfigured } from '@/lib/auth/mal'

export async function GET() {
  await connection()
  return new Response(JSON.stringify({ enabled: await isMalConfigured() }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-robots-tag': 'noindex' },
  })
}
