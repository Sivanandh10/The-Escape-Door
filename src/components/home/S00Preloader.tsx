// S00 PRELOADER — "volume cover" intro (#01 #24 #06 #03). Owner: S00 agent (UX pass).
// Server component: ships a tiny inline gate script + the overlay markup. The overlay is CSS-hidden unless the
// gate adds `html.ted-pl` before first paint (FIRST VISIT only — localStorage — not reduced-motion, not a bot,
// no ?nopreload). The hero renders underneath from the start, so the preloader never blocks HTML or LCP.
// Hard budget: content is never held for more than ~1.2 s. The gate arms its own 1.2 s release timer, which
// fires even if React hydrates late; the client timeline fits the remaining budget or skips with a quick fade.
// Other sections can wait for the door: `html[data-preloader="done"]` / window event `ted:preloader-done`.
import Preloader from './s00/Preloader'

// Runs during HTML parsing (before paint). `?preload=force` bypasses every gate (lab / QA only); `&t=` freezes.
const GATE = `(function(){try{var d=document.documentElement,q=location.search,n=navigator,seen=function(){try{return localStorage.getItem('ted:pl')||sessionStorage.getItem('ted:pl')}catch(e){return null}};if(!/[?&]preload=force/.test(q)){if(/[?&]nopreload/.test(q))return;if(seen())return;if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;if(n.webdriver)return;if(/bot|crawl|spider|slurp|lighthouse|headless|prerender|preview/i.test(n.userAgent))return}d.classList.add('ted-pl');window.__tedPlT=performance.now();try{localStorage.setItem('ted:pl','1')}catch(e){}if(!/[?&]t=/.test(q))setTimeout(function(){if(d.dataset.preloader!=='run'){d.classList.remove('ted-pl');d.dataset.preloader='done'}},1200)}catch(e){}})()`

export default function S00Preloader() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: GATE }} />
      <Preloader />
    </>
  )
}
