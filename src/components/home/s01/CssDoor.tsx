// S01 — the CSS-3D door (everyone without the WebGL gate, and the first paint for everyone).
// Owner: S01. Server-safe markup; HeroMotion drives the [data-*] hooks with the same ScrollTrigger as the R3F door.
// Reduced motion: the leaf is drawn already open (static open-door illustration), light spill on.
import { Halftone } from '@/components/fx/Halftone'
import { SpeedLines } from '@/components/fx/SpeedLines'

const WOOD = '#9A6440'
const WOOD_DARK = '#2A1A12'

const grain = {
  backgroundColor: WOOD,
  backgroundImage: [
    'repeating-linear-gradient(91deg, rgba(11,11,15,.16) 0 1.5px, transparent 1.5px 13px)',
    'repeating-linear-gradient(89deg, rgba(255,225,77,.07) 0 1px, transparent 1px 29px)',
    'linear-gradient(90deg, rgba(11,11,15,.22), transparent 18%, transparent 82%, rgba(11,11,15,.28))',
  ].join(','),
}

/** The door: frame + doorway light + hinged wooden leaf + halftone light spill. Sized by --door-h on its scene. */
export function CssDoor() {
  return (
    <div data-door-wrap className="relative" style={{ height: 'var(--door-h, 78%)', aspectRatio: '0.6' }}>
      {/* halftone light spill on the floor (#58) */}
      <div
        data-spill
        aria-hidden="true"
        className="absolute left-1/2 top-[99%] h-[46%] w-[260%] -translate-x-1/2 origin-top opacity-[0.12] motion-reduce:opacity-100"
        style={{
          clipPath: 'polygon(40.5% 0, 59.5% 0, 100% 100%, 0 100%)',
          backgroundImage: 'radial-gradient(circle, var(--color-volt) 0 38%, transparent 41%)',
          backgroundSize: '9px 9px',
          WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, rgba(0,0,0,.65) 45%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, #000 0%, rgba(0,0,0,.65) 45%, transparent 100%)',
        }}
      />

      {/* light-leak rays from the crack (idle pulse) */}
      <svg
        data-rays
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute left-[86%] top-[10%] h-[86%] w-[70%] opacity-60 motion-reduce:opacity-0"
      >
        {[
          [4, 2, 96, -26, 2.2],
          [8, 22, 100, 6, 1.6],
          [6, 48, 92, 46, 2.6],
          [8, 70, 98, 92, 1.4],
          [4, 94, 90, 128, 2],
        ].map(([x1, y1, x2, y2, w], i) => (
          <polygon key={i} points={`0,${y1} ${x2},${y2 - w * 3} ${x2},${y2 + w * 3} 0,${y1 + w * 0.6}`} fill="var(--color-volt)" opacity={x1 > 6 ? 0.85 : 1} />
        ))}
      </svg>

      {/* purple frame */}
      <div className="absolute inset-0 border-[3px] border-ink bg-door shadow-[7px_7px_0_0_var(--color-ink)]">
        <div className="absolute inset-[5%_7%_0] border-[3px] border-b-0 border-ink/80" />
        <div
          className="absolute inset-y-0 right-0 w-[12%] text-ink/45"
          style={{ WebkitMaskImage: 'var(--tone-mid)', maskImage: 'var(--tone-mid)', background: 'currentColor' }}
        />
        {/* lintel plate: 扉 = door */}
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-[0.6%] -translate-x-1/2 border-2 border-ink bg-paper px-[0.45em] font-jp text-[clamp(9px,1.1vh,13px)] font-black leading-[1.35] text-ink"
        >
          扉
        </span>
      </div>

      {/* doorway: the light behind the leaf */}
      <div data-doorway className="absolute bottom-0 left-[12%] right-[12%] top-[8%] overflow-hidden border-[3px] border-ink bg-volt">
        <Halftone shape="radial" invert color="var(--color-ink)" dotSize={7} className="absolute inset-0 opacity-70" />
        <div data-interior-lines className="absolute inset-0 opacity-0 motion-reduce:opacity-100">
          <SpeedLines color="var(--color-ink)" intensity={0.55} inner={0.2} count={70} seed={11} className="absolute inset-0" />
        </div>

        <div className="absolute inset-0" style={{ perspective: '900px', perspectiveOrigin: '50% 50%' }}>
          <div
            data-leaf
            className="absolute inset-y-0 left-0 right-[3%] origin-left [transform-style:preserve-3d] motion-reduce:[transform:rotateY(74deg)]"
          >
            {/* front */}
            <div className="absolute inset-0 border-r-[3px] border-ink [backface-visibility:hidden]" style={grain}>
              <div className="absolute inset-[7%_14%_52%] border-[3px] border-ink shadow-[inset_5px_5px_0_rgba(11,11,15,.28)]" />
              <div className="absolute inset-[54%_14%_8%] border-[3px] border-ink shadow-[inset_5px_5px_0_rgba(11,11,15,.28)]" />
              <span data-knob className="absolute right-[9%] top-[50%] aspect-square w-[13%] rounded-full border-[3px] border-ink bg-volt shadow-[2px_2px_0_0_var(--color-ink)]" />
              <span className="absolute right-[12.5%] top-[57.5%] h-[5%] w-[6%] border-2 border-ink bg-ink/80" />
              <div data-leaf-shade className="absolute inset-0 bg-ink opacity-0 motion-reduce:opacity-40" />
            </div>
            {/* back (seen once it swings past 90°) — silhouette against the light */}
            <div
              className="absolute inset-0 border-[3px] border-ink [backface-visibility:hidden] [transform:rotateY(180deg)]"
              style={{ backgroundColor: WOOD_DARK }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default CssDoor
