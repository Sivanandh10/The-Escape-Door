// Blank garment (no print) + print-zone geometry, drawn to scale. Owner: P3 forge. Server-safe.
// Silhouettes match the shop's garment art (src/lib/art/garments.ts, same 1000×1100 box) so the
// forge preview reads as the same black tee/hoodie. Zones: 24 units per inch on that box.
import type { Side } from './model'

export const GARMENT_BOX = { w: 1000, h: 1100 }
const U = 24 // viewBox units per inch

const TEE_PATH =
  'M405,92 Q500,116 595,92 L815,134 C872,152 928,262 980,420 L822,490 C809,472 796,454 787,434 C793,640 793,860 793,1058 Q500,1074 207,1058 C207,860 207,640 213,434 C204,454 191,472 178,490 L20,420 C72,262 128,152 185,134 Z'
const HOOD_PATH =
  'M398,118 Q500,142 602,118 L808,156 C884,196 934,430 970,722 L978,800 L878,814 L866,742 C845,610 814,508 792,456 C797,700 797,860 799,990 L801,1070 Q500,1084 199,1070 L201,990 C203,860 203,700 208,456 C186,508 155,610 134,742 L122,814 L22,800 L30,722 C66,430 116,196 192,156 Z'

export type GarmentKind = 'tshirt' | 'hoodie'

/** Print zone rectangle in the 1000×1100 viewBox (x,y = top-left). */
export function zoneRect(kind: GarmentKind, side: Side, inches: { w: number; h: number }) {
  const w = inches.w * U
  const h = inches.h * U
  if (side === 'front') {
    // wearer's left chest
    const cx = kind === 'hoodie' ? 640 : 622
    const cy = kind === 'hoodie' ? 338 : 300
    return { x: cx - w / 2, y: cy - h / 2, w, h }
  }
  const top = kind === 'hoodie' ? 432 : 196
  return { x: 500 - w / 2, y: top, w, h }
}

/** zone rect → CSS percentages of the garment box */
export function zoneStyle(r: { x: number; y: number; w: number; h: number }) {
  return {
    left: `${(r.x / GARMENT_BOX.w) * 100}%`,
    top: `${(r.y / GARMENT_BOX.h) * 100}%`,
    width: `${(r.w / GARMENT_BOX.w) * 100}%`,
    height: `${(r.h / GARMENT_BOX.h) * 100}%`,
  }
}

const FABRIC = '#17171C'
const DARK = '#0E0E12'
const RIB = '#202027'
const STITCH = '#3A3A44'

export function BlankGarment({
  kind,
  side,
  id,
  className,
  title = '',
}: {
  kind: GarmentKind
  side: Side
  /** unique id for SVG defs */
  id: string
  className?: string
  title?: string
}) {
  const path = kind === 'hoodie' ? HOOD_PATH : TEE_PATH
  const tone = `${id}-tone`
  const clip = `${id}-clip`
  const dash = { stroke: STITCH, strokeWidth: 2.4, strokeDasharray: '7 6', fill: 'none' }
  return (
    <svg
      viewBox={`0 0 ${GARMENT_BOX.w} ${GARMENT_BOX.h}`}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      style={{ display: 'block', width: '100%', height: 'auto' }}
    >
      <defs>
        <pattern id={tone} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <circle cx="3.5" cy="3.5" r="1.9" fill="#000" />
        </pattern>
        <clipPath id={clip}>
          <path d={path} />
        </clipPath>
      </defs>
      <path d={path} fill={FABRIC} />
      <g clipPath={`url(#${clip})`}>
        <rect x="0" y="0" width="270" height="1100" fill={`url(#${tone})`} opacity=".75" />
        <rect x="730" y="0" width="270" height="1100" fill={`url(#${tone})`} opacity=".75" />
        <path d="M330,170 C430,240 500,560 470,1080 L360,1080 C390,700 380,330 330,170 Z" fill="#26262E" opacity=".55" />
      </g>
      {kind === 'tshirt' ? (
        <g>
          <path d="M197,140 C212,234 219,330 222,430" {...dash} />
          <path d="M803,140 C788,234 781,330 778,430" {...dash} />
          <path d="M31,398 L187,468 M969,398 L813,468" {...dash} />
          <path d="M209,1030 Q500,1046 791,1030" {...dash} />
          {side === 'front' ? (
            <>
              <path d="M405,92 C420,150 470,168 500,168 C530,168 580,150 595,92 Q500,112 405,92 Z" fill={DARK} />
              <path d="M405,92 C420,150 470,168 500,168 C530,168 580,150 595,92" stroke={RIB} strokeWidth="22" fill="none" strokeLinecap="round" />
            </>
          ) : (
            <path d="M405,92 Q500,116 595,92" stroke={RIB} strokeWidth="22" fill="none" strokeLinecap="round" />
          )}
        </g>
      ) : (
        <g>
          <path d="M204,162 C213,262 216,360 217,452 M796,162 C787,262 784,360 783,452" {...dash} />
          <path d="M201,990 Q500,1004 799,990 L801,1070 Q500,1084 199,1070 Z" fill={RIB} />
          <path d="M30,722 L134,742 L122,814 L22,800 Z M970,722 L866,742 L878,814 L978,800 Z" fill={RIB} />
          {side === 'front' ? (
            <>
              <path d="M318,186 C292,96 360,20 500,16 C640,20 708,96 682,186 C640,170 360,170 318,186 Z" fill={FABRIC} stroke="#0B0B0F" strokeWidth="5" />
              <path d="M404,176 C402,122 446,94 500,94 C554,94 598,122 596,176 C568,208 530,220 500,222 C470,220 432,208 404,176 Z" fill={DARK} />
              <path d="M456,232 C450,300 442,360 436,420 M544,232 C552,300 560,360 566,428" stroke="#F4EFE6" strokeWidth="9" fill="none" strokeLinecap="round" />
              <path d="M336,700 L664,700 C680,770 716,830 752,868 L752,968 L248,968 L248,868 C284,830 320,770 336,700 Z" fill={FABRIC} stroke={DARK} strokeWidth="4" />
              <path d="M336,700 C320,770 284,830 248,868 M664,700 C680,770 716,830 752,868" stroke="#0B0B0F" strokeWidth="6" fill="none" />
            </>
          ) : (
            <>
              <path d="M344,136 C330,52 670,52 656,136 C690,262 606,398 500,416 C394,398 310,262 344,136 Z" fill={FABRIC} stroke="#0B0B0F" strokeWidth="5" />
              <path d="M500,64 L500,414" stroke={DARK} strokeWidth="4" />
            </>
          )}
        </g>
      )}
      <path d={path} fill="none" stroke="#0B0B0F" strokeWidth="5" strokeLinejoin="round" />
    </svg>
  )
}

export default BlankGarment
