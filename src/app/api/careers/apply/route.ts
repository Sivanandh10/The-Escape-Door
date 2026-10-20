// POST /api/careers/apply — save a job application. Owner: CAREERS.
// The ONLY insert path for public.job_applications (RLS has no insert policy; service role here).
// Same-origin · body ≤ 48 KB · honeypot "website" · per-IP + per-email rate limits · zod (applySchema) ·
// job must exist and be OPEN · answers re-checked against the job's questions (labels snapshotted) ·
// résumé path must point at an object that really exists in the private 'careers' bucket (≤ 5 MB) ·
// at least a résumé or a portfolio/LinkedIn link. Personal data: only what the form sends (DPDP 2023).
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { RESUME_MAX_BYTES, applySchema, checkAnswers, jobFromRow } from '@/components/careers/model'
import { allow, clientKey, json, readJson, sameOrigin } from '../../_lib/guard'

const MAX_BODY = 48 * 1024

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ip = clientKey(req)
  if (!allow(`careers-apply:ip:${ip}`, 6, 10 * 60_000)) {
    return json({ ok: false, error: 'rate-limited' }, 429, { 'retry-after': '600' })
  }

  const body = await readJson(req, MAX_BODY)
  if ('error' in body) return json({ ok: false, error: body.error === 'too-large' ? 'too-large' : 'invalid' }, body.error === 'too-large' ? 413 : 400)

  const parsed = applySchema.safeParse(body.data)
  if (!parsed.success) {
    return json({ ok: false, error: 'invalid', fieldErrors: z.flattenError(parsed.error).fieldErrors }, 400)
  }
  const a = parsed.data

  // Honeypot: pretend success, store nothing.
  if (a.website && a.website.trim() !== '') return json({ ok: true, stored: false })

  if (!allow(`careers-apply:email:${a.email.toLowerCase()}`, 5, 60 * 60_000)) {
    return json({ ok: false, error: 'rate-limited' }, 429, { 'retry-after': '3600' })
  }

  if (!a.resumePath && !a.portfolioUrl && !a.linkedinUrl) {
    return json({ ok: false, error: 'invalid', fieldErrors: { resume: ['Attach your résumé or add a portfolio / LinkedIn link.'] } }, 400)
  }

  const sb = supabaseAdmin()
  if (!sb) return json({ ok: false, error: 'unconfigured' }, 503)

  try {
    const { data: jobRow, error: jobErr } = await sb.from('jobs').select('*').eq('id', a.jobId).maybeSingle()
    if (jobErr) {
      console.error('[api/careers/apply] job read failed', jobErr.message)
      return json({ ok: false, error: 'server' }, 500)
    }
    if (!jobRow) return json({ ok: false, error: 'job-not-found' }, 404)
    const job = jobFromRow(jobRow as Record<string, unknown>)
    if (job.status !== 'open') return json({ ok: false, error: 'job-closed' }, 409)

    const checked = checkAnswers(job.questions, a.answers)
    if (!checked.ok) {
      const fe: Record<string, string[]> = {}
      for (const [k, m] of Object.entries(checked.errors)) fe[`q:${k}`] = [m]
      return json({ ok: false, error: 'invalid', fieldErrors: fe }, 400)
    }

    if (a.resumePath) {
      const info = await sb.storage.from('careers').info(a.resumePath)
      if (info.error || !info.data) {
        return json({ ok: false, error: 'invalid', fieldErrors: { resume: ['The résumé upload didn’t finish. Attach it again.'] } }, 400)
      }
      const size = Number((info.data as { size?: unknown }).size ?? 0)
      if (size > RESUME_MAX_BYTES) {
        return json({ ok: false, error: 'invalid', fieldErrors: { resume: ['Max file size is 5 MB.'] } }, 400)
      }
    }

    const { data, error } = await sb
      .from('job_applications')
      .insert({
        job_id: job.id,
        job_title: job.title,
        name: a.name,
        email: a.email.toLowerCase(),
        phone: a.phone,
        city: a.city,
        portfolio_url: a.portfolioUrl,
        linkedin_url: a.linkedinUrl,
        resume_path: a.resumePath,
        resume_name: a.resumePath ? a.resumeName : '',
        answers: checked.value,
        consent: true,
      })
      .select('id')
      .single()
    if (error || !data) {
      // 23505 = the same uploaded file was already used for an application (double submit)
      if (error?.code === '23505') return json({ ok: true, stored: true, duplicate: true })
      console.error('[api/careers/apply] insert failed', error?.message)
      return json({ ok: false, error: 'server' }, 500)
    }
    return json({ ok: true, stored: true, id: (data as { id: string }).id })
  } catch (e) {
    console.error('[api/careers/apply] threw', e instanceof Error ? e.message : e)
    return json({ ok: false, error: 'server' }, 500)
  }
}
