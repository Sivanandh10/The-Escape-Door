// First-party, privacy-light analytics (client). Owner: F2.
// → POST batches to NEXT_PUBLIC_TRACK_ENDPOINT (default /.netlify/functions/track, which adds
//   country/region/city from Netlify context.geo and never stores IPs). CONTRACTS §10.4/§10.5.
// Anonymous random visitor id (localStorage) + session id (sessionStorage). No fingerprinting.
// Honours Do-Not-Track / Global Privacy Control. track() never throws; in `next dev` the
// endpoint 404s and that is swallowed.
import type { Attribution } from './types'

export type AnalyticsEvent =
  | 'page_view' | 'add_to_cart' | 'remove_from_cart' | 'wishlist_add' | 'whatsapp_click' | 'checkout_start'
  | 'custom_start' | 'custom_submit' | 'remind_me' | 'newsletter' | 'collection_open' | 'product_view'
  | 'search' | 'filter' | 'scroll_depth' | 'page_leave'

type Props = Record<string, string | number | boolean | null | undefined>

interface QueuedEvent { name: string; path: string; ts: number; props?: Props }

const ENDPOINT = process.env.NEXT_PUBLIC_TRACK_ENDPOINT || '/.netlify/functions/track'
const VID_KEY = 'ted-vid'
const SID_KEY = 'ted-sid'
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
function randomId(): string {
  try { if (crypto?.randomUUID) return crypto.randomUUID() } catch { /* old browsers */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

let memVid = ''
let memSid = ''
/** Anonymous random visitor id (persists in localStorage). */
export function getVisitorId(): string {
  if (!isBrowser()) return ''
  let v = safeGet('local', VID_KEY)
  if (!v) { v = memVid || randomId(); memVid = v; safeSet('local', VID_KEY, v) }
  return v
}
export function getSessionId(): string {
  if (!isBrowser()) return ''
  let s = safeGet('session', SID_KEY)
  if (!s) { s = memSid || randomId(); memSid = s; safeSet('session', SID_KEY, s) }
  return s
}

/** false when DNT/GPC is on, for automation (navigator.webdriver) and on the server. */
export function isTrackingEnabled(): boolean {
  if (!isBrowser()) return false
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

function payload(events: QueuedEvent[]) {
  const w = isBrowser() ? window.innerWidth : 0
  return JSON.stringify({
    v: getVisitorId(),
    s: getSessionId(),
    attr: getAttribution(),
    device: w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop',
    events,
  })
}

/** Send the queue now. `beacon` = page is going away (uses sendBeacon / keepalive). */
export function flush(beacon = false): void {
  if (timer) { clearTimeout(timer); timer = null }
  if (!queue.length || !isBrowser()) return
  const batch = queue.splice(0, MAX_BATCH)
  const body = payload(batch)
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
    const clean: Props | undefined = props
      ? Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined).slice(0, 20)
          .map(([k, v]) => [k.slice(0, 40), typeof v === 'string' ? v.slice(0, 200) : v]))
      : undefined
    queue.push({ name, path: window.location.pathname, ts: Date.now(), ...(clean && Object.keys(clean).length ? { props: clean } : {}) })
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
  captureAttribution()

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
