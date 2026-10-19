// Lead submission (client). Owner: F2. POST /api/lead — never throws.
import type { LeadInput } from './types'
import { getAttribution, getVisitorId } from './analytics'

export interface LeadResult {
  ok: boolean
  id?: string
  /** false when Supabase is not configured (dev / before launch) — the UI still proceeds */
  stored: boolean
  /** 'invalid' | 'rate-limited' | 'network' | 'server' when ok is false */
  error?: string
  /** zod field errors from the server, if any */
  fieldErrors?: Record<string, string[]>
}

export interface SubmitLeadOptions {
  /** value of the hidden honeypot input named "company" (bots fill it; humans don't) */
  honeypot?: string
  signal?: AbortSignal
}

/** Save a lead before opening WhatsApp / showing success. */
export async function submitLead(input: LeadInput, opts: SubmitLeadOptions = {}): Promise<LeadResult> {
  try {
    const body = {
      ...input,
      source: { ...getAttribution(), ...(input.source ?? {}) },
      visitorId: getVisitorId() || undefined,
      company: opts.honeypot ?? '',
    }
    const res = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: opts.signal,
    })
    const data = (await res.json().catch(() => ({}))) as Partial<LeadResult>
    if (!res.ok) {
      return {
        ok: false,
        stored: false,
        error: data.error ?? (res.status === 429 ? 'rate-limited' : res.status === 400 ? 'invalid' : 'server'),
        ...(data.fieldErrors ? { fieldErrors: data.fieldErrors } : {}),
      }
    }
    return { ok: data.ok !== false, stored: !!data.stored, ...(data.id ? { id: data.id } : {}) }
  } catch {
    return { ok: false, stored: false, error: 'network' }
  }
}
