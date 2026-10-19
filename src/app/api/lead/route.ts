// POST /api/lead — save a lead (order, custom request, remind-me, newsletter, exit intent).
// zod 4 validation · honeypot "company" · body ≤ 32 KB · naive per-instance rate limit
// (per IP-hash and per visitor) · service-role insert when configured, else { ok, stored:false }.
// Owner: F2. Personal data: only what the form sends (name, city, contact, message) — DPDP 2023.
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { allow, clientKey, json, readJson, sameOrigin } from '../_lib/guard'

const MAX_BODY = 32 * 1024
const MAX_PAYLOAD = 16 * 1024

const short = (max: number) => z.string().trim().max(max).optional()

const Attribution = z.object({
  src: short(64),
  utm_source: short(100),
  utm_medium: short(100),
  utm_campaign: short(100),
  referrer: short(200),
  landing: short(200),
}).partial()

const LeadSchema = z
  .object({
    kind: z.enum(['whatsapp_order', 'custom_request', 'remind_me', 'newsletter', 'exit_intent']),
    name: short(80),
    city: short(80),
    contact: short(120),
    message: short(2000),
    payload: z.unknown().optional(),
    source: Attribution.optional(),
    visitorId: z.string().trim().max(64).regex(/^[\w-]*$/).optional(),
    company: z.string().max(200).optional(), // honeypot
  })
  .superRefine((v, ctx) => {
    if ((v.kind === 'remind_me' || v.kind === 'newsletter') && (!v.contact || v.contact.length < 5)) {
      ctx.addIssue({ code: 'custom', path: ['contact'], message: 'Add a WhatsApp number or email so we can reach you.' })
    }
    if (v.contact && v.contact.length >= 5 && !/^[+\d][\d\s-]{6,}$/.test(v.contact) && !z.email().safeParse(v.contact).success) {
      ctx.addIssue({ code: 'custom', path: ['contact'], message: 'Enter a phone number or an email address.' })
    }
    if (v.payload !== undefined) {
      let size = 0
      try { size = JSON.stringify(v.payload).length } catch { size = Infinity }
      if (size > MAX_PAYLOAD) ctx.addIssue({ code: 'custom', path: ['payload'], message: 'Order details are too large.' })
    }
  })

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return json({ ok: false, stored: false, error: 'forbidden' }, 403)

  const ipKey = clientKey(req)
  if (!allow(`lead:ip:${ipKey}`, 12, 10 * 60_000)) {
    return json({ ok: false, stored: false, error: 'rate-limited' }, 429, { 'retry-after': '600' })
  }

  const body = await readJson(req, MAX_BODY)
  if ('error' in body) {
    return json({ ok: false, stored: false, error: body.error === 'too-large' ? 'too-large' : 'invalid' }, body.error === 'too-large' ? 413 : 400)
  }

  const parsed = LeadSchema.safeParse(body.data)
  if (!parsed.success) {
    return json({ ok: false, stored: false, error: 'invalid', fieldErrors: z.flattenError(parsed.error).fieldErrors }, 400)
  }
  const lead = parsed.data

  // Honeypot: pretend success, store nothing.
  if (lead.company && lead.company.trim() !== '') return json({ ok: true, stored: false })

  if (lead.visitorId && !allow(`lead:v:${lead.visitorId}`, 20, 60 * 60_000)) {
    return json({ ok: false, stored: false, error: 'rate-limited' }, 429, { 'retry-after': '3600' })
  }

  const sb = supabaseAdmin()
  if (!sb) return json({ ok: true, stored: false })

  try {
    const { data, error } = await sb
      .from('leads')
      .insert({
        kind: lead.kind,
        name: lead.name || null,
        city: lead.city || null,
        contact: lead.contact || null,
        message: lead.message || null,
        payload: lead.payload ?? null,
        source: lead.source ?? null,
        src: lead.source?.src || null,
        visitor_id: lead.visitorId || null,
      })
      .select('id')
      .single()
    if (error || !data) {
      console.error('[api/lead] insert failed', error?.message)
      // The customer still continues to WhatsApp; the lead is just not stored.
      return json({ ok: true, stored: false })
    }
    return json({ ok: true, stored: true, id: (data as { id: string }).id })
  } catch (e) {
    console.error('[api/lead] insert threw', e instanceof Error ? e.message : e)
    return json({ ok: true, stored: false })
  }
}
