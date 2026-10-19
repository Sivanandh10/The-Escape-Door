// S00 PRELOADER — "volume cover" intro (#01 #24 #06 #03). Owner: S00 agent.
// Server component: ships a tiny inline gate script + the overlay markup. The overlay is CSS-hidden unless the
// gate adds `html.ted-pl` before first paint (first visit this session, not reduced-motion, not a bot, no ?nopreload).
// The hero renders underneath from the start, so the preloader never blocks HTML or LCP.
// Other sections can wait for the door: `html[data-preloader="done"]` / window event `ted:preloader-done`.
import Preloader from './s00/Preloader'

// Runs during HTML parsing (before paint). `?preload=force` bypasses every gate (lab / QA only).
const GATE = `(function(){try{var d=document.documentElement,q=location.search,n=navigator;if(!/[?&]preload=force/.test(q)){if(/[?&]nopreload/.test(q))return;if(sessionStorage.getItem('ted:pl'))return;if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;if(n.webdriver)return;if(/bot|crawl|spider|slurp|lighthouse|headless|prerender|preview/i.test(n.userAgent))return}d.classList.add('ted-pl')}catch(e){}})()`

export default function S00Preloader() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: GATE }} />
      <Preloader />
    </>
  )
}
