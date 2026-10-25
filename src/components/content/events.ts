// Stall/event date rules (feedback: "Feb/Mar with no year and TBC looks outdated"). Owner: HOME. Server-safe, pure.
// An event is shown with dates ONLY when the admin marked it confirmed AND set a real start date that has not
// already ended. Everything else upcoming is "next season": venue/city only — no month, no year, no "TBC".
import type { FestEvent } from '@/lib/types'

const ISO = /^\d{4}-\d{2}-\d{2}/

/** yyyy-mm-dd of today (IST is close enough: dates are whole days). Pass it in so pages stay cacheable. */
export function isoDay(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/** Confirmed + dated + not over yet. `today` = yyyy-mm-dd (omit to skip the "already over" check). */
export function isDatedUpcoming(e: FestEvent, today?: string): boolean {
  if (e.status !== 'upcoming' || !e.confirmed || !e.startDate || !ISO.test(e.startDate)) return false
  if (!today) return true
  const end = e.endDate && ISO.test(e.endDate) ? e.endDate : e.startDate
  return end.slice(0, 10) >= today
}

export function splitUpcoming(events: FestEvent[], today?: string) {
  const upcoming = events.filter((e) => e.status === 'upcoming')
  const dated = upcoming
    .filter((e) => isDatedUpcoming(e, today))
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))
  const nextSeason = upcoming.filter((e) => !dated.includes(e))
  // the admin's free-text dateLabel ("21–28 Feb · dates to be confirmed") never reaches the page or the RSC payload:
  // dated events get a label built from real dates (with the year), the rest a neutral "next season" line
  return {
    dated: dated.map((e) => ({ ...e, dateLabel: dateRangeLabel(e) })),
    nextSeason: nextSeason.map((e) => ({ ...e, dateLabel: NEXT_SEASON_LABEL })),
  }
}

export const NEXT_SEASON_LABEL = 'Next season · dates announced soon'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "14–16 Mar 2027" / "30 Mar – 2 Apr 2027" / "3 Jan 2027 – 2 Jan 2028" from ISO dates (always carries the year). */
export function dateRangeLabel(e: Pick<FestEvent, 'startDate' | 'endDate'>): string {
  if (!e.startDate || !ISO.test(e.startDate)) return ''
  const p = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number)
    return { y, m: MONTHS[m - 1] ?? '', d }
  }
  const a = p(e.startDate)
  if (!e.endDate || !ISO.test(e.endDate) || e.endDate.slice(0, 10) === e.startDate.slice(0, 10)) return `${a.d} ${a.m} ${a.y}`
  const b = p(e.endDate)
  if (a.y !== b.y) return `${a.d} ${a.m} ${a.y} – ${b.d} ${b.m} ${b.y}`
  if (a.m !== b.m) return `${a.d} ${a.m} – ${b.d} ${b.m} ${b.y}`
  return `${a.d}–${b.d} ${a.m} ${a.y}`
}
