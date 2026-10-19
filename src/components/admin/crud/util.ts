// P4b — pure helpers shared by the admin CRUD (server + client safe).

export const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d)
export const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v)
    ? v
    : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))
      ? Number(v)
      : null
export const bool = (v: unknown, d = false): boolean => (typeof v === 'boolean' ? v : d)
export const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

export function newId(prefix: string): string {
  const u = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}${Math.random()}`
  return `${prefix}${u.replace(/[^a-z0-9]/gi, '').slice(0, 20)}`
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

const DATE_FMT = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
/** "18 Oct, 6:30 pm" in IST — deterministic on server and client. */
export function fmtDate(iso: string): string {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? DATE_FMT.format(t) : '—'
}

/** wa.me link for a contact string when it looks like a phone number (India default +91). */
export function waFor(contact: string): string | null {
  if (!contact || contact.includes('@')) return null
  let d = contact.replace(/\D/g, '')
  if (d.length === 10) d = `91${d}`
  return d.length >= 11 && d.length <= 15 ? `https://wa.me/${d}` : null
}
