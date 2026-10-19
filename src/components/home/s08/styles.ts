// Scoped CSS for S08: stage materials (halftone spotlight, light cone, floor), katana crossfade + LED sweep.
// Per-frame work is opacity / transform / mask-position only.
export const S08_CSS = `
#cosplay .s08-stage {
  --x: 58%; --y: 46%;
  height: 480px;
  background: #121218;
}
@media (min-width: 768px) { #cosplay .s08-stage { height: 540px; } }
@media (min-width: 1024px) { #cosplay .s08-stage { height: clamp(560px, 46vw, 720px); } }

/* #32 spotlight, manga edition: paper dots revealed in a hard-ish circle around the pointer */
#cosplay .s08-spot {
  background-image: radial-gradient(circle at center, rgba(244,239,230,.34) 30%, transparent 34%);
  background-size: 8px 8px;
  -webkit-mask-image: radial-gradient(circle 300px at var(--x) var(--y), #000 0 45%, rgba(0,0,0,.35) 70%, transparent 72%);
          mask-image: radial-gradient(circle 300px at var(--x) var(--y), #000 0 45%, rgba(0,0,0,.35) 70%, transparent 72%);
}
#cosplay .s08-cone {
  background-image: radial-gradient(circle at center, rgba(255,225,77,.16) 30%, transparent 34%);
  background-size: 6px 6px;
  clip-path: polygon(40% 0, 60% 0, 86% 100%, 14% 100%);
  -webkit-mask-image: linear-gradient(to bottom, #000, transparent 92%);
          mask-image: linear-gradient(to bottom, #000, transparent 92%);
}
#cosplay .s08-floor {
  background-image: radial-gradient(circle at center, rgba(109,59,255,.55) 30%, transparent 34%);
  background-size: 7px 7px;
  -webkit-mask-image: radial-gradient(ellipse 46% 60% at 50% 100%, #000 40%, transparent 72%);
          mask-image: radial-gradient(ellipse 46% 60% at 50% 100%, #000 40%, transparent 72%);
}
#cosplay .s08-bigword {
  font-size: clamp(140px, 30vw, 460px);
  color: transparent;
  -webkit-text-stroke: 2px rgba(244,239,230,.13);
  letter-spacing: -0.01em;
}
#cosplay .s08-mode-led .s08-bigword { -webkit-text-stroke-color: rgba(109,59,255,.5); }

/* katana placement: diagonal and oversized on phones, near-horizontal on desktop */
#cosplay .s08-blade-pos { width: 150vw; max-width: 1180px; translate: -50% -50%; }
#cosplay .s08-blade { transform: rotate(-33deg); }
@media (min-width: 640px) { #cosplay .s08-blade-pos { width: 112vw; } #cosplay .s08-blade { transform: rotate(-20deg); } }
@media (min-width: 1024px) { #cosplay .s08-blade-pos { width: min(84vw, 1180px); } #cosplay .s08-blade { transform: rotate(-8deg); } }

/* #40 crossfade */
#cosplay .s08-k { transition: opacity .6s var(--ease-hover); }
#cosplay .s08-mode-led .s08-k-basic, #cosplay .s08-mode-basic .s08-k-led { opacity: 0; }
#cosplay .s08-sweep { stroke-dasharray: 80 1000; stroke-dashoffset: 1080; opacity: 0; }
#cosplay .s08-tick { opacity: 0; }

#cosplay .s08-stub::after {
  content: ""; position: absolute; top: 8px; bottom: 8px; right: 14px; width: 0;
  border-right: 3px dashed rgba(244,239,230,.35);
}
#cosplay .s08-card-wrap { transform: rotate(var(--r)); }
#cosplay .s08-card { box-shadow: 5px 5px 0 0 var(--color-door); transition: translate .2s var(--ease-hover), box-shadow .2s var(--ease-hover); }
#cosplay .s08-card-img { transition: scale .5s var(--ease-expo); }

@media (prefers-reduced-motion: no-preference) {
  #cosplay .s08-mode-led .s08-sweep { animation: s08-sweep 2.6s cubic-bezier(.55,.05,.35,1) .6s infinite; }
  #cosplay .s08-mode-led .s08-halo { animation: s08-hum 2.6s ease-in-out infinite; }
  #cosplay .s08-mode-led .s08-tick { animation: s08-tick 2.6s steps(1, end) .6s infinite; }
  #cosplay .s08-blade { animation: s08-float 6s var(--ease-inout) infinite alternate; }
  #cosplay .s08-sfx { animation: s08-pop .55s var(--ease-slam) both, s08-out .3s linear 1.6s both; }
  #cosplay .s08-spot { animation: s08-tone 14s linear infinite; }
}
@media (hover: hover) and (pointer: fine) {
  #cosplay .s08-card:hover { translate: -3px -3px; box-shadow: 8px 8px 0 0 var(--color-volt); }
  #cosplay .s08-card:hover .s08-card-img { scale: 1.06; }
}
#cosplay .s08-card:focus-visible { box-shadow: 8px 8px 0 0 var(--color-volt); }
@media (prefers-reduced-motion: reduce) {
  #cosplay .s08-mode-led .s08-tick { opacity: 1; }
}
@keyframes s08-sweep {
  0% { stroke-dashoffset: 1080; opacity: 1; }
  55% { stroke-dashoffset: 0; opacity: 1; }
  62%, 100% { stroke-dashoffset: -80; opacity: 0; }
}
@keyframes s08-hum { 0%, 100% { opacity: .75; } 50% { opacity: 1; } }
@keyframes s08-tick { 0%, 50% { opacity: 0; } 55%, 75% { opacity: 1; } 80%, 100% { opacity: 0; } }
@keyframes s08-float { from { translate: 0 6px; } to { translate: 0 -8px; } }
@keyframes s08-pop { 0% { opacity: 0; transform: scale(.2); } 60% { opacity: 1; transform: scale(1.18); } 100% { transform: scale(1); } }
@keyframes s08-out { to { opacity: 0; } }
@keyframes s08-tone { to { background-position: 64px 32px; } }
`
