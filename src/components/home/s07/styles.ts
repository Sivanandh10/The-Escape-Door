// Scoped CSS for S07 (keyframes + var-driven transforms that Tailwind can't express cleanly).
// Everything animated per frame is transform / clip-path / opacity, driven by --g and --sp on #gsm.
export const S07_CSS = `
#gsm { --st: 4px; --dw: min(50vw, 196px); }
@media (min-width: 640px) { #gsm { --st: 5px; --dw: 244px; } }
@media (min-width: 1024px) { #gsm { --st: 6px; --dw: min(19vw, 300px); } }
@media (max-height: 820px) and (min-width: 1024px) { #gsm { --dw: min(17vw, 250px); } }

#gsm .s07-tone {
  background-image: radial-gradient(circle at center, var(--color-tone-2) 30%, transparent 34%);
  background-size: 9px 9px;
  -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 55%, #000, transparent 75%);
          mask-image: radial-gradient(ellipse 70% 60% at 50% 55%, #000, transparent 75%);
  opacity: .55;
}
#gsm .s07-stage { background: var(--color-ink); }

/* hoodie deck: real product image per tier. Shifted up-left so the fabric layers (bottom-right) stay centred. */
#gsm .s07-deck-wrap { padding: 44px 16px 36px; }
#gsm .s07-deck {
  width: var(--dw);
  aspect-ratio: 4 / 5;
  translate: calc(var(--st) * -3) calc(var(--st) * -2);
}
#gsm .s07-card {
  transform-origin: 50% 100%;
  opacity: 0;
  transform: translate3d(0, 40px, 0) scale(.94);
}
#gsm .s07-deck[data-armed] .s07-card[data-pos="on"] { opacity: 1; transform: none; }
#gsm .s07-deck[data-armed] .s07-card[data-pos="past"] {
  opacity: calc(1 - var(--d) * .28);
  transform: translate3d(calc(var(--d) * -15%), calc(var(--d) * 2%), 0) rotate(calc(var(--d) * -6deg)) scale(calc(1 - var(--d) * .07));
  filter: grayscale(.55) brightness(.62);
}
#gsm .s07-deck[data-armed] .s07-card[data-pos="next"] {
  opacity: 0;
  transform: translate3d(calc(var(--d) * 14%), 8%, 0) rotate(calc(var(--d) * 5deg)) scale(.9);
}
#gsm[data-max] .s07-card[data-pos="on"] { border-color: var(--color-volt); }

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
  #gsm .s07-card {
    transition: transform .55s var(--ease-slam), opacity .3s linear, filter .3s linear, box-shadow .45s var(--ease-expo);
  }
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
