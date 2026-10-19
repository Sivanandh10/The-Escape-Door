// Job list for scripts/generate-mockups.mjs: every /mockups/<slug>-<side>.webp the catalogue references.
import { mockupJobs } from '@/lib/art/catalog'

export async function GET() {
  return Response.json({ width: 1200, height: 1500, jobs: mockupJobs() })
}
