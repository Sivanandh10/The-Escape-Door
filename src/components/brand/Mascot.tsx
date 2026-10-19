// "Kado" the door-spirit — original mascot for The Escape Door (DESIGN §6).
// One SVG rig (viewBox 200×220), swappable faces/arms/props per mood. Pure SVG + CSS — works in Server Components.
// The door leaf opens with the CSS custom property --kado-open (0..1), so a loader can tween it without re-rendering:
//   gsap.to(el, { '--kado-open': 1 })   or   <Mascot mood="peek" open={0.6} />
import type { CSSProperties, ReactNode } from 'react'
import { useId } from 'react'
import { DELA } from './glyphs.generated'
import { placeWord, safeId } from './lettering'

export type MascotMood = 'idle' | 'peek' | 'wave' | 'shock' | 'sleepy' | 'cheer' | 'work'
export const MASCOT_MOODS: MascotMood[] = ['idle', 'peek', 'wave', 'shock', 'sleepy', 'cheer', 'work']

export interface MascotProps {
  mood?: MascotMood
  /** rendered width in px (height = width × 1.1). Omit to size with CSS. */
  size?: number
  className?: string
  /** idle loop: bob, blink, tail sway (+ mood extras). Off under prefers-reduced-motion. */
  animate?: boolean
  /** door-leaf opening 0..1 (defaults: peek 0.5, cheer 0.12, others 0). */
  open?: number
  /** paper die-cut outline so Kado reads on ink backgrounds (default true) */
  sticker?: boolean
  /** soft ground shadow (default true) */
  shadow?: boolean
  /** Accessible name. Pass '' for decorative (aria-hidden). */
  title?: string
}

const C = {
  ink: '#0B0B0F',
  paper: '#F4EFE6',
  door: '#6D3BFF',
  doorDark: '#4A22C9',
  lav: '#C9B8FF',
  lavDark: '#A48CF2',
  volt: '#FFE14D',
  pink: '#FF9FCF',
  hype: '#FF2D3D',
}

// ---------- geometry ----------
const FRAME = 'M44 136V66C44 36 68 15 100 15C132 15 156 36 156 66V136Z'
const LEAF = 'M55 136V68C55 44 75 26 100 26C125 26 145 44 145 68V136Z'
const BODY = 'M59 162C59 141 77 134 100 134C123 134 141 141 141 162C141 183 123 195 100 195C77 195 59 183 59 162Z'
const TAIL = 'M108 185C122 203 150 207 166 193C174 186 176 176 171 166C170 176 165 185 156 189C143 195 128 192 117 179Z'
const HINGE_X = 55
const LEAF_W = 90

/** capsule from shoulder (x1,y1) to hand (x2,y2) */
type Arm = { x1: number; y1: number; x2: number; y2: number; r?: number; cls?: string; origin?: string }
const ARMS: Record<MascotMood, Arm[]> = {
  idle: [
    { x1: 70, y1: 155, x2: 52, y2: 171 },
    { x1: 130, y1: 155, x2: 148, y2: 171 },
  ],
  sleepy: [
    { x1: 70, y1: 160, x2: 58, y2: 180 },
    { x1: 130, y1: 160, x2: 142, y2: 180 },
  ],
  peek: [
    { x1: 70, y1: 155, x2: 52, y2: 171 },
    { x1: 130, y1: 152, x2: 161, y2: 118, r: 8 },
  ],
  wave: [
    { x1: 70, y1: 155, x2: 52, y2: 171 },
    { x1: 130, y1: 152, x2: 158, y2: 126, cls: 'wave', origin: '130px 152px' },
  ],
  shock: [
    { x1: 70, y1: 152, x2: 46, y2: 134 },
    { x1: 130, y1: 152, x2: 154, y2: 134 },
  ],
  cheer: [
    { x1: 70, y1: 150, x2: 42, y2: 122, cls: 'cheerL', origin: '70px 150px' },
    { x1: 130, y1: 150, x2: 158, y2: 122, cls: 'cheerR', origin: '130px 150px' },
  ],
  work: [
    { x1: 72, y1: 154, x2: 80, y2: 170 },
    { x1: 128, y1: 154, x2: 120, y2: 170 },
  ],
}

function capsule({ x1, y1, x2, y2, r = 8.5 }: Arm) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const nx = -Math.sin(a) * r
  const ny = Math.cos(a) * r
  const f = (n: number) => n.toFixed(2)
  return `M${f(x1 + nx)} ${f(y1 + ny)}L${f(x2 + nx)} ${f(y2 + ny)}A${r} ${r} 0 0 0 ${f(x2 - nx)} ${f(y2 - ny)}L${f(x1 - nx)} ${f(y1 - ny)}A${r} ${r} 0 0 0 ${f(x1 + nx)} ${f(y1 + ny)}Z`
}

const armEl = (a: Arm, k: number, props: Record<string, string | number>) => <path key={k} d={capsule(a)} {...props} />

// ---------- faces (drawn in closed-leaf coordinates; they ride the leaf transform) ----------
const Eye = ({ x, y = 74 }: { x: number; y?: number }) => (
  <g>
    <ellipse cx={x} cy={y} rx="7.2" ry="9.6" fill={C.ink} />
    <circle cx={x - 2.4} cy={y - 3.6} r="2.9" fill="#fff" />
    <circle cx={x + 2.6} cy={y + 3.6} r="1.5" fill={C.volt} />
  </g>
)

const Blush = () => (
  <g>
    {[69, 131].map((x) => (
      <g key={x}>
        <ellipse cx={x} cy="90" rx="7" ry="3.6" fill={C.pink} />
        <path d={`M${x - 4} 92l2.4-4M${x} 92l2.4-4M${x + 4} 92l2.4-4`} stroke={C.ink} strokeWidth="1.2" strokeLinecap="round" opacity=".55" />
      </g>
    ))}
  </g>
)

const line = { stroke: C.ink, strokeWidth: 3.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }

function Face({ mood }: { mood: MascotMood }): ReactNode {
  switch (mood) {
    case 'peek':
      return null
    case 'wave':
      return (
        <g>
          <path d="M75 77Q82 66 89 77M111 77Q118 66 125 77" {...line} strokeWidth={3.6} />
          <path d="M92 86Q100 85 108 86Q106 98 100 98Q94 98 92 86Z" fill={C.ink} stroke={C.ink} strokeWidth="2" strokeLinejoin="round" />
          <path d="M95 94Q100 90 105 94Q103 97.5 100 97.5Q97 97.5 95 94Z" fill={C.hype} />
          <Blush />
        </g>
      )
    case 'shock':
      return (
        <g>
          {[78, 122].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy="72" rx="9" ry="11" fill="#fff" stroke={C.ink} strokeWidth="3" />
              <circle cx={x} cy="73" r="2.4" fill={C.ink} />
            </g>
          ))}
          <ellipse cx="100" cy="95" rx="4.6" ry="6.4" fill={C.ink} />
        </g>
      )
    case 'sleepy':
      return (
        <g>
          <path d="M74 75Q82 82 90 75M110 75Q118 82 126 75" {...line} strokeWidth={3.4} />
          <ellipse cx="100" cy="91" rx="2.6" ry="3" fill={C.ink} />
          <Blush />
        </g>
      )
    case 'cheer':
      return (
        <g>
          <path d="M75 66L88 73L75 80M125 66L112 73L125 80" {...line} strokeWidth={3.6} />
          <path d="M89 84Q100 83 111 84Q109 101 100 101Q91 101 89 84Z" fill={C.ink} stroke={C.ink} strokeWidth="2" strokeLinejoin="round" />
          <path d="M93.5 95Q100 90 106.5 95Q104 100 100 100Q96 100 93.5 95Z" fill={C.hype} />
          <Blush />
        </g>
      )
    case 'work':
      return (
        <g>
          <path d="M72 59L90 64M128 59L110 64" {...line} strokeWidth={3.4} />
          <Eye x={82} y={76} />
          <Eye x={118} y={76} />
          <path d="M94 93H106" {...line} />
        </g>
      )
    default:
      return (
        <g>
          <g className="blink">
            <Eye x={82} />
            <Eye x={118} />
          </g>
          <path d="M93.5 88Q97 92 100 88Q103 92 106.5 88" {...line} strokeWidth={2.8} />
          <Blush />
        </g>
      )
  }
}

// ---------- extras outside the leaf ----------
function Extras({ mood, uid }: { mood: MascotMood; uid: string }): ReactNode {
  if (mood === 'sleepy') {
    const suya = placeWord(DELA.SUYA, { x: 140, y: 34, size: 30, tracking: -4 })
    return (
      <g>
        <g className="bubble">
          <circle cx="86" cy="100" r="8.5" fill="#E9F3FF" stroke={C.ink} strokeWidth="2.2" />
          <path d="M81.5 97Q83 94 86 93.6" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>
        <g className="zz" transform="rotate(-8 170 22)">
          <g fill={C.paper} stroke={C.paper} strokeWidth="30" strokeLinejoin="round">
            {suya.map((l) => (
              <path key={l.key} d={l.d} transform={l.t} />
            ))}
          </g>
          <g fill={C.ink}>
            {suya.map((l) => (
              <path key={l.key} d={l.d} transform={l.t} />
            ))}
          </g>
        </g>
      </g>
    )
  }
  if (mood === 'shock') {
    return (
      <g>
        <path d="M162 34C158 42 156 46 156 49A6 6 0 0 0 168 49C168 46 166 42 162 34Z" fill="#CFE8FF" stroke={C.paper} strokeWidth="2.4" strokeLinejoin="round" className="sweat" />
        <path d="M30 40l-8-6M28 54l-10 0M168 70l10-4" {...line} strokeWidth={3} />
      </g>
    )
  }
  if (mood === 'wave') {
    return <path className="waveLines" d="M168 112Q176 118 176 128M174 104Q186 112 186 128" {...line} strokeWidth={2.8} />
  }
  if (mood === 'cheer') {
    const bits: Array<[number, number, number, string, 'r' | 't']> = [
      [26, 54, 20, C.volt, 'r'],
      [172, 46, -24, C.pink, 't'],
      [36, 96, 50, C.door, 't'],
      [182, 92, 12, C.volt, 'r'],
      [56, 14, -30, C.hype, 'r'],
      [150, 10, 35, C.lav, 'r'],
    ]
    return (
      <g className="confetti">
        {bits.map(([x, y, r, fill, kind], i) =>
          (
            <g key={i} transform={`rotate(${r} ${x} ${y})`}>
              <g className="bit" style={{ ['--d' as string]: `${i * 0.18}s` }}>
                {kind === 'r' ? (
                  <rect x={x - 5} y={y - 3} width="10" height="6" fill={fill} stroke={C.ink} strokeWidth="1.6" />
                ) : (
                  <polygon points={`${x},${y - 6} ${x + 6},${y + 4} ${x - 6},${y + 4}`} fill={fill} stroke={C.ink} strokeWidth="1.6" strokeLinejoin="round" />
                )}
              </g>
            </g>
          ),
        )}
        {[
          [18, 120, 7],
          [184, 140, 6],
          [100, 4, 5],
        ].map(([x, y, s], i) => (
          <path key={`s${i}`} className="bit" d={`M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`} fill={C.volt} stroke={C.ink} strokeWidth="1.5" strokeLinejoin="round" style={{ ['--d' as string]: `${0.3 + i * 0.25}s` }} />
        ))}
      </g>
    )
  }
  void uid
  return null
}

function Headband(): ReactNode {
  return (
    <g>
      <path d="M47 52Q100 34 153 52" stroke={C.ink} strokeWidth="13" fill="none" strokeLinecap="round" />
      <path d="M47 52Q100 34 153 52" stroke="#fff" strokeWidth="8" fill="none" strokeLinecap="round" />
      <circle cx="100" cy="42.5" r="4.2" fill={C.hype} />
      <path d="M46 52C36 50 28 54 22 50M46 54C38 58 32 64 24 64" stroke={C.ink} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M46 52C36 50 28 54 22 50M46 54C38 58 32 64 24 64" stroke="#fff" strokeWidth="3.2" fill="none" strokeLinecap="round" />
    </g>
  )
}

function Clipboard(): ReactNode {
  return (
    <g>
      <rect x="77" y="146" width="46" height="40" rx="2" fill={C.paper} stroke={C.ink} strokeWidth="3" />
      <rect x="90" y="141" width="20" height="8" rx="1.5" fill={C.volt} stroke={C.ink} strokeWidth="2.2" />
      <path d="M83 158l2.5 2.5 4.5-5M83 170l2.5 2.5 4.5-5" stroke={C.door} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M94 158H116M94 170H112M83 180H108" stroke={C.ink} strokeWidth="2" strokeLinecap="round" opacity=".7" />
    </g>
  )
}

// ---------- CSS ----------
const css = (s: string) => `
.${s} .leaf{transform-box:view-box;transform-origin:${HINGE_X}px 80px;transform:scaleX(cos(calc(var(--kado-open,0) * 76deg)))}
.${s} .edge{transform-box:view-box;transform-origin:${HINGE_X}px 80px;transform:translateX(calc(cos(calc(var(--kado-open,0) * 76deg)) * ${LEAF_W}px)) scaleX(sin(calc(var(--kado-open,0) * 76deg)))}
.${s} .light{opacity:calc((var(--kado-open,0) - .4) * 2.4)}
.${s} .rays{opacity:calc((var(--kado-open,0) - .62) * 3)}
.${s} .glow{opacity:calc((var(--kado-open,0) - .22) * 4)}
.${s} [class~=blink],.${s} .wave,.${s} .cheerL,.${s} .cheerR,.${s} .tail,.${s} .bubble,.${s} .zz,.${s} .confetti .bit{transform-box:fill-box}
@media (prefers-reduced-motion:no-preference){
.${s}.anim .rig{animation:kado-bob 2.6s ease-in-out infinite}
.${s}.anim .gshadow{transform-box:fill-box;transform-origin:center;animation:kado-shadow 2.6s ease-in-out infinite}
.${s}.anim .blink{transform-origin:center;animation:kado-blink 4.2s infinite}
.${s}.anim .tail{transform-origin:0% 0%;animation:kado-tail 3.2s ease-in-out infinite}
.${s}.anim .wave{transform-box:view-box;animation:kado-wave .9s ease-in-out infinite}
.${s}.anim .cheerL,.${s}.anim .cheerR{transform-box:view-box;animation:kado-cheer .5s ease-in-out infinite alternate}
.${s}.anim .cheerR{animation-delay:.25s}
.${s}.anim .bubble{transform-origin:70% 20%;animation:kado-bubble 2.8s ease-in-out infinite}
.${s}.anim .zz{animation:kado-zz 2.8s ease-in-out infinite}
.${s}.anim .confetti .bit{transform-origin:center;animation:kado-pop 1.4s cubic-bezier(.34,1.56,.64,1) infinite;animation-delay:var(--d,0s)}
.${s}.anim .sweat{animation:kado-sweat 1.6s ease-in infinite}
.${s}.anim.m-shock .rig{animation:kado-tremble .18s steps(2) infinite}
.${s}.anim.m-cheer .rig{animation:kado-hop .5s cubic-bezier(.3,0,.4,1) infinite alternate}
.${s}.anim.m-sleepy .rig{animation-duration:4s}
}
@keyframes kado-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes kado-shadow{0%,100%{transform:scaleX(1);opacity:1}50%{transform:scaleX(.82);opacity:.6}}
@keyframes kado-blink{0%,91%,97%,100%{transform:scaleY(1)}94%{transform:scaleY(.08)}}
@keyframes kado-tail{0%,100%{transform:rotate(0)}50%{transform:rotate(-7deg)}}
@keyframes kado-wave{0%,100%{transform:rotate(0)}50%{transform:rotate(-22deg)}}
@keyframes kado-cheer{from{transform:rotate(0)}to{transform:rotate(-8deg)}}
@keyframes kado-bubble{0%,100%{transform:scale(.55)}55%{transform:scale(1.15)}}
@keyframes kado-zz{0%,100%{transform:translateY(0);opacity:1}50%{transform:translateY(-4px);opacity:.7}}
@keyframes kado-pop{0%{transform:scale(.6) rotate(0)}40%{transform:scale(1.15) rotate(20deg)}100%{transform:scale(1) rotate(0)}}
@keyframes kado-sweat{0%{transform:translateY(-3px);opacity:0}30%{opacity:1}100%{transform:translateY(6px);opacity:0}}
@keyframes kado-tremble{0%{transform:translateX(-1.2px)}100%{transform:translateX(1.2px)}}
@keyframes kado-hop{from{transform:translateY(0)}to{transform:translateY(-7px)}}
`

export function Mascot({ mood = 'idle', size, className, animate = false, open, sticker = true, shadow = true, title = 'Kado, the Escape Door mascot' }: MascotProps) {
  const uid = safeId(useId())
  const o = Math.max(0, Math.min(1, open ?? (mood === 'peek' ? 0.5 : mood === 'cheer' ? 0.12 : 0)))
  const a11y = title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const }
  const arms = ARMS[mood]
  const tilt = mood === 'sleepy' ? 'rotate(-6 100 136)' : mood === 'peek' ? 'rotate(-3 100 136)' : undefined
  const silhouette = (props: Record<string, string | number>) => (
    <g {...props}>
      <g transform={tilt}>
        <path d={FRAME} />
        <rect x="34" y="130" width="132" height="11" rx="2" />
      </g>
      <path d={BODY} />
      <g className="tail">
        <path d={TAIL} />
        <circle cx="180" cy="154" r="3.4" />
        <circle cx="185" cy="143" r="2" />
      </g>
      {arms.map((a, k) => (
        <g key={k} className={a.cls} style={a.origin ? { transformOrigin: a.origin } : undefined}>
          {armEl(a, k, {})}
        </g>
      ))}
            {mood === 'work' && <rect x="77" y="141" width="46" height="45" />}
    </g>
  )

  return (
    <svg
      viewBox="0 0 200 220"
      width={size}
      height={size ? Math.round(size * 1.1) : undefined}
      className={[uid, animate ? 'anim' : '', `m-${mood}`, className].filter(Boolean).join(' ')}
      style={{ ['--kado-open' as string]: o, overflow: 'visible' } as CSSProperties}
      {...a11y}
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>{css(uid)}</style>
      <defs>
        <clipPath id={`${uid}-hole`}>
          <path d={LEAF} />
        </clipPath>
      </defs>
      {shadow && <ellipse className="gshadow" cx="100" cy="212" rx="40" ry="5" fill={C.ink} opacity=".14" />}
      <g className="rig">
        {/* layer 1–2: die-cut paper sticker, then a uniform ink outline */}
        {sticker && silhouette({ fill: C.paper, stroke: C.paper, strokeWidth: 16, strokeLinejoin: 'round' })}
        {silhouette({ fill: C.ink, stroke: C.ink, strokeWidth: 6, strokeLinejoin: 'round' })}

        {/* body gloss */}
        <path d="M73 156Q76 146 87 142" stroke={C.paper} strokeWidth="3.2" strokeLinecap="round" fill="none" opacity=".85" />
        <circle cx="70" cy="164" r="1.8" fill={C.paper} opacity=".85" />
        {/* keyhole belly mark — the door's lock lives on Kado's tummy */}
        <g>
          <path d="M100 157.5a6 6 0 0 0-3.4 10.9l-2.1 9.6h11l-2.1-9.6a6 6 0 0 0-3.4-10.9Z" fill={C.door} stroke={C.lav} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M100 162a1.8 1.8 0 0 0-1 3.3l-.7 4.2h3.4l-.7-4.2a1.8 1.8 0 0 0-1-3.3Z" fill={C.volt} />
        </g>

        {/* head: door frame + leaf */}
        <g transform={tilt}>
          <path d={FRAME} fill={C.door} />
          <path d="M49.5 132V67C49.5 40 71 20.5 100 20.5" stroke={C.lav} strokeWidth="2.4" fill="none" strokeLinecap="round" opacity=".7" />
          <path d="M92 15.5h16l-2 9h-12z" fill={C.lav} stroke={C.ink} strokeWidth="2.4" strokeLinejoin="round" />
          {/* interior: dark room → light floods in as the door opens */}
          <g clipPath={`url(#${uid}-hole)`}>
            <rect x="50" y="20" width="100" height="120" fill={C.ink} />
            <g className="light">
              <rect x="50" y="20" width="100" height="120" fill={C.volt} />
              <path d="M100 136L60 20H76ZM100 136L92 20H108ZM100 136L124 20H140Z" fill="#FFF6C4" />
            </g>
            {mood === 'peek' && (
              <g className="glow">
                {[131, 141].map((x) => (
                  <g key={x}>
                    <ellipse cx={x} cy="78" rx="4.6" ry="7.4" fill={C.volt} />
                    <ellipse cx={x - 1.2} cy="75.5" rx="2" ry="2.8" fill="#fff" />
                  </g>
                ))}
              </g>
            )}
          </g>
          <path d={LEAF} fill="none" stroke={C.ink} strokeWidth="3" />
          {/* the leaf (with Kado's face) swings on its hinge */}
          <g className="leaf">
            <path d={LEAF} fill={C.lav} stroke={C.ink} strokeWidth="3" strokeLinejoin="round" />
            <rect x="70" y="110" width="60" height="17" rx="2" fill="none" stroke={C.lavDark} strokeWidth="2.2" opacity=".75" />
            <path d="M60 70C60 50 76 33 96 31" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity=".55" />
            <circle cx="137" cy="99" r="5.2" fill={C.volt} stroke={C.ink} strokeWidth="2.6" />
            <circle cx="135.4" cy="97.4" r="1.5" fill="#fff" />
            <Face mood={mood} />
            {mood === 'work' && <Headband />}
          </g>
          <rect className="edge" x={HINGE_X} y="27" width="6" height="109" fill={C.lavDark} stroke={C.ink} strokeWidth="1.5" />
          <g className="rays" stroke={C.volt} strokeWidth="4" strokeLinecap="round">
            <path d="M30 40L20 30M26 76H12M170 40L180 30M174 76H188M100 4V-6" />
          </g>
          <rect x="34" y="130" width="132" height="11" rx="2" fill={C.ink} />
          <path d="M40 133.5H160" stroke={C.door} strokeWidth="2" strokeLinecap="round" opacity=".7" />
        </g>

        {/* arms on top of the body, separated by a thin paper cut-line */}
        {/* arms over the head layer (raised arms cross the frame) */}
        {arms.map((a, k) => (
          <g key={k} className={a.cls} style={a.origin ? { transformOrigin: a.origin } : undefined}>
            {armEl(a, k, { fill: C.ink, stroke: C.paper, strokeWidth: 3.2, paintOrder: 'stroke', strokeLinejoin: 'round' })}
          </g>
        ))}
        {mood === 'peek' && <path d="M154 112q5-5 10 0" stroke={C.paper} strokeWidth="2" fill="none" strokeLinecap="round" />}
        {mood === 'work' && <Clipboard />}
        {mood === 'work' && (
          <g fill={C.ink} stroke={C.paper} strokeWidth="2">
            <circle cx="79" cy="171" r="7" />
            <circle cx="121" cy="171" r="7" />
          </g>
        )}
        <Extras mood={mood} uid={uid} />
      </g>
    </svg>
  )
}

export default Mascot
