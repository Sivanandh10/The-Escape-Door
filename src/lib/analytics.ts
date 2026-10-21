// First-party, privacy-light analytics (client). Owner: F2.
// → POST batches to NEXT_PUBLIC_TRACK_ENDPOINT (default /.netlify/functions/track, which adds
//   country/region/city from Netlify context.geo and never stores IPs). CONTRACTS §10.4/§10.5.
// Anonymous random visitor id (localStorage) + rolling session id (localStorage, shared by tabs).
// No fingerprinting. Honours Do-Not-Track / Global Privacy Control. track() never throws; in
// `next dev` the endpoint 404s and that is swallowed.
//
// Honest counting (what the admin dashboard calls a visit / unique visitor / page view):
// - Visit = session. A session ends after 30 min without activity or when the local day changes.
//   Passive events (scroll_depth, page_leave) keep a live session alive but never start one.
// - Page view: the same path in the same session is recorded once per 30 min, so reloads,
//   back/forward and React re-mounts don't add views. A different page is a new view, same visit.
// - Never tracked: /admin/*, /lab/*, /api/*. Opening any /admin page marks this browser as staff
//   (localStorage 'ted-staff'='1') and nothing is tracked on it after that. /?track=1 clears it.
import type { Attribution } from './types'

export type AnalyticsEvent =
  | 'page_view' | 'add_to_cart' | 'remove_from_cart' | 'wishlist_add' | 'whatsapp_click' | 'checkout_start'
  | 'custom_start' | 'custom_submit' | 'remind_me' | 'newsletter' | 'collection_open' | 'product_view'
  | 'search' | 'filter' | 'scroll_depth' | 'page_leave'
  // photo search (never carries the image): open {from}, result {kind: exact|similar|none|error, top, ms}
  | 'image_search_open' | 'image_search_result'

type Props = Record<string, string | number | boolean | null | undefined>

interface QueuedEvent { name: string; path: string; ts: number; props?: Props; sid: string }

const ENDPOINT = process.env.NEXT_PUBLIC_TRACK_ENDPOINT || '/.netlify/functions/track'
const VID_KEY = 'ted-vid'
const SESS_KEY = 'ted-sess'
const PV_KEY = 'ted-pv'
const STAFF_KEY = 'ted-staff'
const SESSION_IDLE_MS = 30 * 60 * 1000
const PV_DEDUPE_MS = 30 * 60 * 1000
/** Events that describe an existing page view; they never start a session (only keep a live one alive). */
const PASSIVE = new Set(['scroll_depth', 'page_leave'])
const EXCLUDED_PATH = /^\/(admin|lab|api)(\/|$)/
const ADMIN_PATH = /^\/admin(\/|$)/
const ATTR_KEY = 'ted-attr'
const MAX_BATCH = 20
const FLUSH_MS = 5000

const isBrowser = () => typeof window !== 'undefined'

function safeGet(store: 'local' | 'session', k: string): string | null {
  try { return (store === 'local' ? window.localStorage : window.sessionStorage).getItem(k) } catch { return null }
}
function safeSet(store: 'local' | 'session', k: string, v: string): void {
  try { (store === 'local' ? window.localStorage : window.sessionStorage).setItem(k, v) } catch { /* private mode */ }
}
function safeRemove(store: 'local' | 'session', k: string): void {
  try { (store === 'local' ? window.localStorage : window.sessionStorage).removeItem(k) } catch { /* private mode */ }
}
function randomId(): string {
  try { if (crypto?.randomUUID) return crypto.randomUUID() } catch { /* old browsers */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

let memVid = ''
/** Anonymous random visitor id (persists in localStorage). */
export function getVisitorId(): string {
  if (!isBrowser()) return ''
  let v = safeGet('local', VID_KEY)
  if (!v) { v = memVid || randomId(); memVid = v; safeSet('local', VID_KEY, v) }
  return v
}

// ---------------------------------------------------------------- rolling session
interface SessionState { id: string; last: number; day: string }
let memSess: SessionState | null = null
const localDay = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }

function readSession(): SessionState | null {
  const raw = safeGet('local', SESS_KEY)
  if (raw) {
    const [id, last, day] = raw.split('|')
    const n = Number(last)
    if (id && /^[\w-]{6,64}$/.test(id) && Number.isFinite(n) && day) return { id, last: n, day }
  }
  return memSess
}
function writeSession(st: SessionState): void {
  memSess = st
  safeSet('local', SESS_KEY, `${st.id}|${st.last}|${st.day}`)
}

/**
 * Current session id. A session = activity with gaps under 30 min on the same local day, shared
 * by every tab. `touch` (user activity) rotates an expired session and refreshes lastSeen.
 * Without it (passive events: scroll depth, time on page) a still-live session is kept alive
 * (scrolling/reading is activity) but an expired one is never rotated, so they never start a visit.
 */
export function getSessionId(touch = false): string {
  if (!isBrowser()) return ''
  const now = Date.now()
  const today = localDay(now)
  const cur = readSession()
  const expired = !cur || now - cur.last > SESSION_IDLE_MS || cur.day !== today
  if (cur && !touch) {
    if (!expired && now > cur.last) writeSession({ ...cur, last: now })
    return cur.id
  }
  if (expired) {
    const next = { id: randomId(), last: now, day: today }
    writeSession(next)
    return next.id
  }
  if (now > cur.last) writeSession({ ...cur, last: now })
  return cur.id
}

type PvMap = { sid: string; p: Record<string, number> }
let memPv: PvMap | null = null
/** true when this path was already counted in this session within the last 30 min (reload, back/forward, re-mount). */
function isRepeatPageView(sid: string, path: string, now: number): boolean {
  let map: PvMap | null = null
  const raw = safeGet('local', PV_KEY)
  if (raw) { try { map = JSON.parse(raw) as PvMap } catch { /* corrupted */ } }
  if (!map) map = memPv
  if (!map || map.sid !== sid || !map.p || typeof map.p !== 'object') map = { sid, p: {} }
  const last = map.p[path]
  if (typeof last === 'number' && now >= last && now - last < PV_DEDUPE_MS) return true
  map.p[path] = now
  const keys = Object.keys(map.p)
  if (keys.length > 200) for (const k of keys.slice(0, keys.length - 200)) delete map.p[k]
  memPv = map
  safeSet('local', PV_KEY, JSON.stringify(map))
  return false
}

// ---------------------------------------------------------------- staff exclusion
let memStaff = false
/**
 * Opening any /admin page marks this browser as staff; a URL with ?track=1 clears it.
 * true = this browser must not be tracked.
 */
function isStaff(): boolean {
  try {
    if (ADMIN_PATH.test(window.location.pathname)) {
      memStaff = true
      safeSet('local', STAFF_KEY, '1')
      return true
    }
    if (new URLSearchParams(window.location.search).get('track') === '1') {
      memStaff = false
      safeRemove('local', STAFF_KEY)
    }
  } catch { /* ignore */ }
  return memStaff || safeGet('local', STAFF_KEY) === '1'
}

/** false when DNT/GPC is on, for automation (navigator.webdriver), for staff browsers and on the server. */
export function isTrackingEnabled(): boolean {
  if (!isBrowser()) return false
  if (isStaff()) return false
  try {
    const n = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string }
    const w = window as Window & { doNotTrack?: string }
    if (n.doNotTrack === '1' || w.doNotTrack === '1' || n.msDoNotTrack === '1' || n.globalPrivacyControl === true) return false
    if (n.webdriver) return false
  } catch { return false }
  return true
}

// ---------------------------------------------------------------- attribution
const ATTR_PARAMS = ['src', 'utm_source', 'utm_medium', 'utm_campaign'] as const
let memAttr: Attribution | null = null

/** Capture ?src= / utm_* / referrer host / landing path for this session (first touch, new campaign overrides). */
export function captureAttribution(): Attribution {
  if (!isBrowser()) return {}
  try {
    const params = new URLSearchParams(window.location.search)
    const fromUrl: Attribution = {}
    for (const k of ATTR_PARAMS) {
      const v = params.get(k)
      if (v) fromUrl[k] = v.slice(0, 64).replace(/[^\w.\- ]/g, '')
    }
    const existing = getAttribution()
    const hasCampaign = Object.keys(fromUrl).length > 0
    if (Object.keys(existing).length && !hasCampaign) return existing
    let referrer: string | undefined
    try {
      if (document.referrer) {
        const r = new URL(document.referrer)
        if (r.host !== window.location.host) referrer = r.host
      }
    } catch { /* bad referrer */ }
    const attr: Attribution = { ...fromUrl, ...(referrer ? { referrer } : {}), landing: window.location.pathname }
    memAttr = attr
    safeSet('session', ATTR_KEY, JSON.stringify(attr))
    return attr
  } catch { return memAttr ?? {} }
}

/** The session's attribution ({} when none / on the server). */
export function getAttribution(): Attribution {
  if (!isBrowser()) return {}
  const raw = safeGet('session', ATTR_KEY)
  if (raw) { try { return JSON.parse(raw) as Attribution } catch { /* corrupted */ } }
  return memAttr ?? {}
}

// ---------------------------------------------------------------- queue + transport
let queue: QueuedEvent[] = []
let timer: ReturnType<typeof setTimeout> | null = null

function payload(events: Omit<QueuedEvent, 'sid'>[], sid: string) {
  const w = isBrowser() ? window.innerWidth : 0
  return JSON.stringify({
    v: getVisitorId(),
    s: sid,
    attr: getAttribution(),
    device: w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop',
    events,
  })
}

/** Send the queue now. `beacon` = page is going away (uses sendBeacon / keepalive). */
export function flush(beacon = false): void {
  if (timer) { clearTimeout(timer); timer = null }
  if (!queue.length || !isBrowser()) return
  // one POST per session id (a queue can straddle a session rollover)
  const sid = queue[0].sid
  const batch: QueuedEvent[] = [], rest: QueuedEvent[] = []
  for (const e of queue) (e.sid === sid && batch.length < MAX_BATCH ? batch : rest).push(e)
  queue = rest
  const body = payload(batch.map(({ name, path, ts, props }) => ({ name, path, ts, ...(props ? { props } : {}) })), sid)
  try {
    let sent = false
    if (beacon && typeof navigator.sendBeacon === 'function') {
      sent = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))
    }
    if (!sent) {
      void fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {})
    }
  } catch { /* never throw */ }
  if (queue.length) flush(beacon)
}

function schedule() {
  if (queue.length >= MAX_BATCH) { flush(); return }
  if (!timer) timer = setTimeout(() => flush(), FLUSH_MS)
}

/** Record an event. Safe anywhere on the client; no-op on the server or when tracking is off. */
export function track(event: AnalyticsEvent | (string & {}), props?: Props): void {
  try {
    if (!isTrackingEnabled()) return
    const name = String(event).toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40)
    if (!name) return
    const path = window.location.pathname
    if (EXCLUDED_PATH.test(path)) return
    const now = Date.now()
    const sid = getSessionId(!PASSIVE.has(name))
    if (!sid) return
    if (name === 'page_view' && isRepeatPageView(sid, path, now)) return
    const clean: Props | undefined = props
      ? Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined).slice(0, 20)
          .map(([k, v]) => [k.slice(0, 40), typeof v === 'string' ? v.slice(0, 200) : v]))
      : undefined
    queue.push({ name, path, ts: now, sid, ...(clean && Object.keys(clean).length ? { props: clean } : {}) })
    // Mirror to GA4 if F1 loaded gtag (optional).
    const gtag = (window as Window & { gtag?: (...a: unknown[]) => void }).gtag
    if (typeof gtag === 'function') { try { gtag('event', name, clean ?? {}) } catch { /* ignore */ } }
    schedule()
  } catch { /* never throw */ }
}

// ---------------------------------------------------------------- page lifecycle
let initialised = false
let currentPath = ''
let pageStart = 0
let visibleMs = 0
let visibleSince = 0
let maxDepth = 0
const depthMarks = [25, 50, 75, 100]

function startPage(path: string) {
  currentPath = path
  pageStart = Date.now()
  visibleMs = 0
  visibleSince = document.visibilityState === 'visible' ? pageStart : 0
  maxDepth = 0
  track('page_view', { title: document.title.slice(0, 120) })
  measureDepth()
}

function endPage(beacon: boolean) {
  if (!currentPath) return
  if (visibleSince) { visibleMs += Date.now() - visibleSince; visibleSince = 0 }
  if (visibleMs > 0) track('page_leave', { ms: Math.min(visibleMs, 30 * 60 * 1000), depth: maxDepth })
  visibleMs = 0
  flush(beacon)
}

function measureDepth() {
  try {
    const doc = document.documentElement
    const scrollable = Math.max(doc.scrollHeight, document.body?.scrollHeight ?? 0)
    const seen = window.scrollY + window.innerHeight
    const pct = scrollable > 0 ? Math.min(100, Math.round((seen / scrollable) * 100)) : 100
    for (const m of depthMarks) {
      if (pct >= m && maxDepth < m) { maxDepth = m; track('scroll_depth', { depth: m }) }
    }
  } catch { /* ignore */ }
}

/** Manually report a client-side navigation (initAnalytics already detects pushState/popstate). */
export function trackPageView(path: string = isBrowser() ? window.location.pathname : ''): void {
  if (!isBrowser() || !path || path === currentPath) return
  endPage(false)
  startPage(path)
}

/**
 * Call once on the client (F1 Providers). Captures attribution, sends page_view, tracks
 * scroll depth (25/50/75/100), visible time on page (sent on hide via sendBeacon) and
 * App Router navigations. Idempotent; returns a cleanup function.
 */
export function initAnalytics(): () => void {
  if (!isBrowser() || initialised) return () => {}
  initialised = true
  if (!isStaff() && !EXCLUDED_PATH.test(window.location.pathname)) captureAttribution()

  let raf = 0
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; measureDepth() }) }
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') endPage(true)
    else visibleSince = Date.now()
  }
  const onPageHide = () => endPage(true)
  const onRoute = () => { setTimeout(() => trackPageView(window.location.pathname), 0) }

  const origPush = history.pushState
  const origReplace = history.replaceState
  history.pushState = function (...args: Parameters<History['pushState']>) { const r = origPush.apply(this, args); onRoute(); return r }
  history.replaceState = function (...args: Parameters<History['replaceState']>) { const r = origReplace.apply(this, args); onRoute(); return r }

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('popstate', onRoute)
  window.addEventListener('pagehide', onPageHide)
  document.addEventListener('visibilitychange', onVisibility)

  startPage(window.location.pathname)

  return () => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('popstate', onRoute)
    window.removeEventListener('pagehide', onPageHide)
    document.removeEventListener('visibilitychange', onVisibility)
    if (history.pushState !== origPush) history.pushState = origPush
    if (history.replaceState !== origReplace) history.replaceState = origReplace
    if (raf) cancelAnimationFrame(raf)
    flush(true)
    initialised = false
    currentPath = ''
  }
}
