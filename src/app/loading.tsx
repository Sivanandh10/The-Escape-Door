// Root route-transition fallback (UX). Every route without its own loading.tsx shows this within one frame of a
// click while the next page streams: a branded ink/volt progress strip pinned above the header + F1's screentone
// RouteSkeleton (same layout rhythm as real pages, so there is no layout jump when content lands).
// Server component, CSS only, no JS, no images. Static pages prerender their full HTML, so this never appears on
// a hard load of a static page — only during client navigations that have to wait.
import { RouteSkeleton } from '@/components/layout/RouteSkeleton'

const CSS = `
.ted-route-bar { position: fixed; inset: 0 0 auto 0; z-index: 95; height: 5px; background: var(--color-ink); pointer-events: none; }
.ted-route-bar > span {
  position: absolute; inset: 0; transform-origin: 0 50%; transform: scaleX(.18);
  background-color: var(--color-volt);
  background-image: linear-gradient(-45deg, rgba(11,11,15,.22) 25%, transparent 25%, transparent 50%, rgba(11,11,15,.22) 50%, rgba(11,11,15,.22) 75%, transparent 75%);
  background-size: 14px 14px;
}
.ted-route-door {
  position: fixed; top: 12px; right: 16px; z-index: 95; pointer-events: none;
  display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px;
  border: 3px solid var(--color-ink); background: var(--color-paper); color: var(--color-ink);
  box-shadow: 4px 4px 0 0 var(--color-ink);
  opacity: 0;
}
.ted-route-door i { display: block; width: 12px; height: 16px; border: 2.5px solid currentColor; border-bottom-width: 0; position: relative; }
.ted-route-door i::after { content: ''; position: absolute; right: 1.5px; top: 6px; width: 3px; height: 3px; background: var(--color-door); }
@media (prefers-reduced-motion: no-preference) {
  .ted-route-bar > span { animation: ted-route-grow 2.4s cubic-bezier(.1,.7,.2,1) forwards, ted-route-stripe .6s linear infinite; }
  /* the badge only appears if the wait is long enough to notice (no flash on fast navigations) */
  .ted-route-door { animation: ted-route-pop .24s cubic-bezier(.34,1.56,.64,1) .45s forwards; }
  .ted-route-door i { animation: ted-route-swing .7s ease-in-out .45s infinite alternate; transform-origin: 0 50%; }
}
@media (prefers-reduced-motion: reduce) {
  .ted-route-bar > span { transform: scaleX(.6); }
  .ted-route-door { opacity: 1; }
}
@keyframes ted-route-grow { 0% { transform: scaleX(.08); } 40% { transform: scaleX(.55); } 100% { transform: scaleX(.92); } }
@keyframes ted-route-stripe { to { background-position: 28px 0; } }
@keyframes ted-route-pop { from { opacity: 0; transform: translateY(-8px) scale(.9); } to { opacity: 1; transform: none; } }
@keyframes ted-route-swing { from { transform: perspective(60px) rotateY(0deg); } to { transform: perspective(60px) rotateY(-55deg); } }
@media (max-width: 767px) { .ted-route-door { top: auto; bottom: 16px; right: 16px; } }
`

export default function Loading() {
  return (
    <>
      <style>{CSS}</style>
      <div className="ted-route-bar" aria-hidden="true">
        <span />
      </div>
      <div className="ted-route-door label text-[11px]" aria-hidden="true">
        <i />
        Opening the door
      </div>
      <RouteSkeleton variant="page" />
    </>
  )
}
