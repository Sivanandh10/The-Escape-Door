// Procedural, deterministic sound design (no samples, no licences needed).
// node reel/sfx.mjs out.wav 15  -> 48 kHz 16-bit stereo WAV synced to the reel's beat grid (120 BPM).
import { writeFileSync } from 'node:fs'
const [, , out = 'sfx.wav', durS = '15'] = process.argv
const SR = 48000, DUR = +durS, N = Math.round(SR * DUR)
const L = new Float32Array(N), R = new Float32Array(N)
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
const rnd = mulberry32(99)
const add = (t0, fn, len, gain = 1, pan = 0) => { const s0 = Math.round(t0 * SR); for (let i = 0; i < len * SR; i++) { const j = s0 + i; if (j < 0 || j >= N) continue; const v = fn(i / SR) * gain; L[j] += v * (1 - pan) ; R[j] += v * (1 + pan) } }
// building blocks
const kick = (t0, g = .9) => { let ph = 0; add(t0, t => { const f = 45 + 110 * Math.exp(-t * 28); ph += 2 * Math.PI * f / SR; return Math.sin(ph) * Math.exp(-t * 9) }, .35, g) }
const hat = (t0, g = .12) => { let lp = 0; add(t0, t => { const n = rnd() * 2 - 1; const hp = n - lp; lp = lp * .6 + n * .4; return hp * Math.exp(-t * 60) }, .06, g, .3) }
const impact = (t0, g = 1) => { // low boom + noise crack + sub tail
  let ph = 0; add(t0, t => { const f = 32 + 140 * Math.exp(-t * 14); ph += 2 * Math.PI * f / SR; return Math.tanh(1.8 * Math.sin(ph)) * Math.exp(-t * 3.2) }, 1.2, g)
  let lp = 0; add(t0, t => { const n = rnd() * 2 - 1; lp += (n - lp) * .25; return lp * Math.exp(-t * 18) }, .3, g * .9)
}
const thud = (t0, g = .5) => { let ph = 0; add(t0, t => { const f = 70 + 160 * Math.exp(-t * 30); ph += 2 * Math.PI * f / SR; return Math.sin(ph) * Math.exp(-t * 14) }, .25, g); let lp = 0; add(t0, t => { const n = rnd() * 2 - 1; lp += (n - lp) * .5; return lp * Math.exp(-t * 45) }, .08, g * .5) }
const whoosh = (t0, len = .35, g = .45, pan = 0) => { let lp = 0, bp = 0; add(t0, t => { const p = t / len; const env = Math.sin(Math.PI * Math.min(1, p)) ** 2; const c = .02 + .25 * p; const n = rnd() * 2 - 1; lp += (n - lp) * c; bp += (lp - bp) * c; return (lp - bp) * 3 * env }, len, g, pan) }
const pop = (t0, f0 = 900, g = .35) => { let ph = 0; add(t0, t => { const f = f0 * (1 + 1.5 * Math.exp(-t * 60)); ph += 2 * Math.PI * f / SR; return Math.sin(ph) * Math.exp(-t * 30) }, .12, g) }
const rumble = (t0, len, g = .35) => { let lp = 0; add(t0, t => { const n = rnd() * 2 - 1; lp += (n - lp) * .015; const env = Math.min(1, t / len) ; return lp * 6 * env * (1 + .5 * Math.sin(t * 2 * Math.PI * 9)) }, len, g) }
const tick = (t0, g = .25) => { let ph = 0; add(t0, t => { ph += 2 * Math.PI * 2400 / SR; return Math.sin(ph) * Math.exp(-t * 120) }, .03, g) }
const logoHit = (t0) => { impact(t0, 1); [220, 277, 330, 440].forEach((f, i) => { let ph = 0; add(t0, t => { ph += 2 * Math.PI * f / SR; return Math.sin(ph) * Math.exp(-t * 1.6) * (1 + .3 * Math.sin(t * 30)) }, 2, .07, i % 2 ? .3 : -.3) }) }

// --- beat bed: kick on beats, hats on off-beats (quiet under the hook, full from 2.0) ---
for (let b = 0; b * .5 < DUR - .4; b++) { const t = b * .5; if (t >= 2 && t < 12.9) kick(t, .55); if (t >= 2 && t < 12.9) hat(t + .25) }
// --- shot sync (matches HITS / shotlist) ---
rumble(0, .5, .5)                       // ゴゴゴ
impact(0.5, 1)                          // ドン!
whoosh(0.62, .5, .5)                    // leaves swing
whoosh(1.45, .55, .6)                   // push through the door
;[0, .25, .5, .75, 1].forEach((d, i) => thud(2 + d, .6))        // panels slam
pop(3.32, 700, .4)                      // caption slam
whoosh(4.18, .36, .55, -.4)             // page turn
for (let i = 0; i < 6; i++) whoosh(4.5 + i * .5 + .26, .26, .38, i % 2 ? .5 : -.5)   // arc door flips
whoosh(7.25, .35, .5)                   // dive into stage
thud(7.5, .4)                           // tee lands
whoosh(8.25, .4, .45, .3)               // turntable
pop(8.02, 1200, .25); pop(8.86, 1000, .25)  // callouts
pop(9.0, 600, .45)                      // ₹800 pill
whoosh(9.24, .3, .5, -.3)               // ink wipe
impact(9.5, .6)                         // polaroid burst
for (let i = 0; i < 7; i++) pop(9.5 + i * .045, 1400 + i * 120, .15)
impact(10.0, .85)                       // 3 FOR ₹100
for (let i = 0; i < 12; i++) tick(10.28 + i * .033, .12) // typing
pop(10.5, 900, .3); pop(10.62, 1100, .3)
whoosh(11.25, .35, .55)                 // bands sweep
;[0, 1, 2].forEach(i => tick(11.8 + i * .1, .25))           // 1× 2× 3×
whoosh(12.62, .4, .6)                   // door closes
logoHit(13.0)                           // バン! + wordmark
pop(13.5, 650, .45)                     // PICK YOUR ARC
for (let i = 0; i < 13; i++) tick(13.75 + i * .027, .12)    // url typing

// --- master: soft clip + normalise + 10 ms fade edges ---
let peak = 0; for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 1.1); R[i] = Math.tanh(R[i] * 1.1); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])) }
const g = .89 / (peak || 1), fade = SR * .01
const buf = Buffer.alloc(44 + N * 4)
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40)
for (let i = 0; i < N; i++) { const e = Math.min(1, i / fade, (N - i) / fade); buf.writeInt16LE(Math.round(L[i] * g * e * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(R[i] * g * e * 32767), 46 + i * 4) }
writeFileSync(out, buf)
console.log('sfx ->', out)
