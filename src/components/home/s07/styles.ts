// Scoped CSS for S07 (keyframes + var-driven transforms that Tailwind can't express cleanly).
// Everything animated per frame is transform / clip-path / opacity, driven by --g and --sp on #gsm.
export const S07_CSS = `
#gsm { --S: 140px; --sp-k: .62; --ax: 40%; }
@media (min-width: 640px) { #gsm { --S: 180px; --sp-k: .8; --ax: 46%; } }
@media (min-width: 1024px) { #gsm { --S: 200px; --sp-k: 1; --ax: 44%; } }
@media (min-width: 1280px) { #gsm { --S: 212px; } }

#gsm .s07-tone {
  background-image: radial-gradient(circle at center, var(--color-tone-2) 30%, transparent 34%);
  background-size: 9px 9px;
  -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 55%, #000, transparent 75%);
          mask-image: radial-gradient(ellipse 70% 60% at 50% 55%, #000, transparent 75%);
  opacity: .55;
}
#gsm .s07-stage { background: var(--color-ink); }
#gsm .s07-anchor { left: var(--ax); top: 66%; }

#gsm .s07-layer { transform: translate3d(0, calc(var(--i) * var(--sp) * var(--sp-k) * -1px), 0); }
#gsm .s07-drop {
  opacity: 0;
  transform: translate3d(0, -120px, 0);
  transition: opacity .22s linear, transform .55s var(--ease-slam);
}
#gsm .s07-drop.s07-on { opacity: 1; transform: none; }
#gsm .s07-face, #gsm .s07-edge {
  position: absolute;
  width: var(--S); height: var(--S);
  left: calc(var(--S) / -2); top: calc(var(--S) / -2);
  transform: rotateX(60deg) rotateZ(-45deg);
  border: 3px solid var(--color-ink);
}
#gsm .s07-edge { background: var(--color-ink); translate: 0 var(--t); border-color: var(--color-ink); }
#gsm .s07-face {
  background-image:
    radial-gradient(circle at center, rgba(11,11,15,.22) 26%, transparent 30%),
    repeating-linear-gradient(0deg, rgba(11,11,15,.07) 0 2px, transparent 2px 7px),
    repeating-linear-gradient(90deg, rgba(11,11,15,.07) 0 2px, transparent 2px 7px);
  background-size: 7px 7px, auto, auto;
}
#gsm .s07-top { background-image: radial-gradient(circle at center, rgba(11,11,15,.14) 26%, transparent 30%); background-size: 7px 7px; }

#gsm .s07-dim {
  --h: calc((var(--n) - 1) * var(--sp) * var(--sp-k));
  position: absolute; left: calc(var(--S) * .78); top: 0; width: 0; height: 0;
  opacity: 0; transition: opacity .3s linear .35s;
}
#gsm .s07-dim-on { opacity: 1; }
#gsm .s07-dim-line {
  position: absolute; left: 0; bottom: 0; width: 3px; height: 100px;
  background: var(--color-volt); transform-origin: 50% 100%;
  transform: scaleY(calc(var(--h) / 100));
}
#gsm .s07-dim-cap { position: absolute; left: -6px; bottom: -1px; width: 15px; height: 3px; background: var(--color-volt); }
#gsm .s07-dim-cap-top { transform: translateY(calc(var(--h) * -1px)); }
#gsm .s07-dim-label {
  position: absolute; left: 14px; bottom: 0; white-space: nowrap;
  transform: translateY(calc(var(--h) * -.5px + 50%));
}

#gsm .s07-fill {
  background-color: var(--color-volt);
  background-image: linear-gradient(-45deg, rgba(11,11,15,.16) 25%, transparent 25%, transparent 50%, rgba(11,11,15,.16) 50%, rgba(11,11,15,.16) 75%, transparent 75%);
  background-size: 20px 20px;
}
#gsm .s07-fill-v { clip-path: inset(calc((1 - var(--g)) * 100%) 0 0 0); }
#gsm .s07-fill-h { clip-path: inset(0 calc((1 - var(--g)) * 100%) 0 0); }
#gsm .s07-mark-v { transform: translateY(calc((1 - var(--g)) * 100%)); }
#gsm .s07-mark-h { transform: translateX(calc((var(--g) - 1) * 100%)); }
#gsm .s07-gauge-tone {
  background-image: radial-gradient(circle at center, var(--color-tone-3) 28%, transparent 32%);
  background-size: 6px 6px; opacity: .45;
}
#gsm .s07-corner { position: absolute; width: 22px; height: 22px; border-color: var(--color-volt); }

@media (prefers-reduced-motion: no-preference) {
  #gsm .s07-float { animation: s07-float 5s var(--ease-inout) infinite alternate; }
  #gsm .s07-tone { animation: s07-drift 18s linear infinite; }
  #gsm .s07-dot { animation: s07-blink 1s steps(2, jump-none) infinite; }
  #gsm .s07-fill { animation: s07-charge 1.2s linear infinite; }
  #gsm .s07-swap { animation: s07-in .5s var(--ease-expo) both; }
  #gsm .s07-sfx { animation: s07-pop .5s var(--ease-slam) both; }
  #gsm .s07-rumble { animation: s07-rumble .12s steps(2, jump-none) infinite; }
}
@keyframes s07-float { from { transform: translateY(4px); } to { transform: translateY(-8px); } }
@keyframes s07-drift { to { background-position: 90px 45px; } }
@keyframes s07-blink { 50% { opacity: .15; } }
@keyframes s07-charge { to { background-position: 0 -40px; } }
@keyframes s07-in { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes s07-pop { 0% { opacity: 0; transform: scale(.2); } 60% { opacity: 1; transform: scale(1.18); } 100% { transform: scale(1); } }
@keyframes s07-rumble { 0% { translate: -1px 1px; } 100% { translate: 1px -1px; } }
`
