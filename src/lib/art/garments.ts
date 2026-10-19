// Garment builders: oversized black tee + hoodie, front/back, in a 1000 x 1100 box.
import { artSpec } from './arcs'
import { backPrint, chestMark } from './prints'
import { INK, PAPER, dotPattern, text } from './svg'
import type { ArtMotif, ArtSide, ArtSpec } from './types'

export const GARMENT_W = 1000
export const GARMENT_H = 1100

const FABRIC = '#17171C'
const FABRIC_DARK = '#0E0E12'
const FABRIC_LIGHT = '#26262E'
const RIB = '#202027'
const STITCH = '#3A3A44'

export interface Subject {
  defs: string
  body: string
}

// ---------- T-shirt ----------
const TEE_PATH =
  'M405,92 Q500,116 595,92 L815,134 C872,152 928,262 980,420 L822,490 C809,472 796,454 787,434 C793,640 793,860 793,1058 Q500,1074 207,1058 C207,860 207,640 213,434 C204,454 191,472 178,490 L20,420 C72,262 128,152 185,134 Z'
const TEE_FRONT_NECK = 'M405,92 C420,150 470,168 500,168 C530,168 580,150 595,92'
const TEE_BACK_NECK = 'M405,92 Q500,116 595,92'

function teeShading(uid: string, side: ArtSide): string {
  // screentone shading that follows the body sides + under-sleeves (clipped to the silhouette)
  const tone = [
    `<path d="M213,434 C232,600 232,850 208,1060 L262,1060 C276,850 272,610 244,452 Z" fill="url(#${uid}-tone)" opacity=".85"/>`,
    `<path d="M787,434 C768,600 768,850 792,1060 L738,1060 C724,850 728,610 756,452 Z" fill="url(#${uid}-tone)" opacity=".85"/>`,
    `<path d="M178,488 L213,434 C176,380 150,330 120,300 L96,420 Z" fill="url(#${uid}-tone)" opacity=".7"/>`,
    `<path d="M822,488 L787,434 C824,380 850,330 880,300 L904,420 Z" fill="url(#${uid}-tone)" opacity=".7"/>`,
    // lit panel (lighter dots) falling diagonally across the body
    `<path d="M330,170 C430,240 500,560 470,1062 L360,1062 C390,700 380,330 330,170 Z" fill="url(#${uid}-lite)" opacity=".45"/>`,
    `<path d="M70,392 C110,280 150,200 190,150 C198,240 204,330 210,420 Z" fill="url(#${uid}-lite)" opacity=".4"/>`,
  ]
  // soft drape folds: light ridge + dark valley, tapered by width
  const folds = side === 'front'
    ? ['M760,470 C700,560 640,640 610,760', 'M300,1050 C330,990 370,950 430,930', 'M640,1056 C640,1010 620,980 590,960']
    : ['M240,470 C300,560 350,640 380,760', 'M700,1052 C670,992 630,955 570,935', 'M360,1056 C360,1010 380,980 410,960']
  const ridge = folds.map((d) => `<path d="${d}" stroke="${FABRIC_LIGHT}" stroke-width="9" opacity=".55"/><path d="${d}" stroke="#30303A" stroke-width="2.5" opacity=".8"/>`).join('')
  const valley = folds.map((d) => `<path d="${d}" stroke="#000" stroke-width="10" opacity=".22" transform="translate(9,6)"/>`).join('')
  return `${tone.join('')}<g fill="none" stroke-linecap="round">${valley}${ridge}</g>`
}

function teeSeams(side: ArtSide): string {
  const dash = `stroke="${STITCH}" stroke-width="2.4" stroke-dasharray="7 6" fill="none"`
  return [
    // drop-shoulder armhole seams
    `<path d="M187,136 C203,232 210,330 213,434" stroke="${FABRIC_DARK}" stroke-width="4" fill="none"/><path d="M197,140 C212,234 219,330 222,430" ${dash}/>`,
    `<path d="M813,136 C797,232 790,330 787,434" stroke="${FABRIC_DARK}" stroke-width="4" fill="none"/><path d="M803,140 C788,234 781,330 778,430" ${dash}/>`,
    // sleeve hems
    `<path d="M31,398 L187,468" ${dash}/><path d="M969,398 L813,468" ${dash}/>`,
    `<path d="M24,412 L180,482" stroke="${FABRIC_DARK}" stroke-width="3"/><path d="M976,412 L820,482" stroke="${FABRIC_DARK}" stroke-width="3"/>`,
    // bottom hem
    `<path d="M209,1030 Q500,1046 791,1030" ${dash}/><path d="M208,1044 Q500,1060 792,1044" stroke="${FABRIC_DARK}" stroke-width="3" fill="none"/>`,
    // shoulder seam (front shows a hint)
    side === 'front' ? '' : `<path d="M405,92 L815,134" stroke="none"/>`,
  ].join('')
}

function teeCollar(side: ArtSide, uid: string, spec: ArtSpec): string {
  if (side === 'front') {
    return `<path d="${TEE_FRONT_NECK} Q500,112 405,92 Z" fill="${FABRIC_DARK}"/><path d="M470,104 h60 v24 h-60 z" fill="${PAPER}"/><path d="M470,104 h60 v6 h-60 z" fill="${spec.colorA}"/>${text('TED', { x: 500, y: 125, size: 13, fill: INK, anchor: 'middle', tracking: 0.12 })}<path d="${TEE_BACK_NECK}" stroke="${RIB}" stroke-width="12" fill="none"/><path d="${TEE_FRONT_NECK}" stroke="${RIB}" stroke-width="22" fill="none" stroke-linecap="round"/><path d="${TEE_FRONT_NECK}" stroke="url(#${uid}-rib)" stroke-width="22" fill="none"/><path d="M412,108 C428,160 474,180 500,180 C526,180 572,160 588,108" stroke="${STITCH}" stroke-width="2.2" stroke-dasharray="6 5" fill="none"/>`
  }
  return `<path d="${TEE_BACK_NECK}" stroke="${RIB}" stroke-width="22" fill="none" stroke-linecap="round"/><path d="${TEE_BACK_NECK}" stroke="url(#${uid}-rib)" stroke-width="22" fill="none"/><path d="M410,108 Q500,132 590,108" stroke="${STITCH}" stroke-width="2.2" stroke-dasharray="6 5" fill="none"/>`
}

function fabricDefs(uid: string): string {
  return `${dotPattern(`${uid}-tone`, '#000000', 7, 1.9, 45)}${dotPattern(`${uid}-lite`, FABRIC_LIGHT, 7, 1.7, 45)}<pattern id="${uid}-rib" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="2" height="5" fill="#2E2E37"/></pattern><pattern id="${uid}-ribh" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(90)"><rect width="2" height="5" fill="#2E2E37"/></pattern>`
}

/** Tee subject (1000 x 1100). */
export function teeSubject(spec: ArtSpec, side: ArtSide): Subject {
  const uid = `${spec.uid}-${side}`
  let defs = fabricDefs(uid) + `<clipPath id="${uid}-clip"><path d="${TEE_PATH}"/></clipPath>`
  let print = ''
  if (side === 'back') {
    const pw = 476
    const ph = 600
    print = `<g transform="translate(${500 - pw / 2},196)">${backPrint(spec, pw, ph)}</g>`
  } else {
    print = chestMark(600, 232, 0.9, PAPER, spec.colorA)
  }
  const body = `<g><path d="${TEE_PATH}" fill="${FABRIC}"/><g clip-path="url(#${uid}-clip)">${teeShading(uid, side)}</g>${teeSeams(side)}${teeCollar(side, uid, spec)}<g opacity=".97">${print}</g><path d="${TEE_PATH}" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/></g>`
  defs += ''
  return { defs, body }
}

// ---------- Hoodie ----------
const HOOD_PATH =
  'M398,118 Q500,142 602,118 L808,156 C884,196 934,430 970,722 L978,800 L878,814 L866,742 C845,610 814,508 792,456 C797,700 797,860 799,990 L801,1070 Q500,1084 199,1070 L201,990 C203,860 203,700 208,456 C186,508 155,610 134,742 L122,814 L22,800 L30,722 C66,430 116,196 192,156 Z'

export function hoodieSubject(spec: ArtSpec, side: ArtSide): Subject {
  const uid = `${spec.uid}-h${side}`
  const defs = fabricDefs(uid) + `<clipPath id="${uid}-clip"><path d="${HOOD_PATH}"/></clipPath>`
  const dash = `stroke="${STITCH}" stroke-width="2.4" stroke-dasharray="7 6" fill="none"`
  const shade = `<g clip-path="url(#${uid}-clip)"><ellipse cx="230" cy="560" rx="60" ry="170" fill="url(#${uid}-tone)"/><ellipse cx="770" cy="580" rx="60" ry="170" fill="url(#${uid}-tone)"/><path d="M290,200 C420,260 500,620 460,990 L330,990 C380,700 330,320 290,200 Z" fill="url(#${uid}-lite)" opacity=".5"/><path d="M60,700 C80,480 130,260 190,170 C200,300 205,400 208,456 L134,742 Z" fill="url(#${uid}-lite)" opacity=".45"/></g>`
  const cuffs = `<path d="M30,722 L134,742 L122,814 L22,800 Z" fill="${RIB}"/><path d="M30,722 L134,742 L122,814 L22,800 Z" fill="url(#${uid}-rib)"/><path d="M970,722 L866,742 L878,814 L978,800 Z" fill="${RIB}"/><path d="M970,722 L866,742 L878,814 L978,800 Z" fill="url(#${uid}-rib)"/><path d="M201,990 Q500,1004 799,990 L801,1070 Q500,1084 199,1070 Z" fill="${RIB}"/><path d="M201,990 Q500,1004 799,990 L801,1070 Q500,1084 199,1070 Z" fill="url(#${uid}-rib)"/><path d="M30,722 L134,742 M970,722 L866,742 M201,990 Q500,1004 799,990" stroke="${FABRIC_DARK}" stroke-width="4" fill="none"/>`
  const seams = `<path d="M194,158 C204,260 207,360 208,456" stroke="${FABRIC_DARK}" stroke-width="4" fill="none"/><path d="M806,158 C796,260 793,360 792,456" stroke="${FABRIC_DARK}" stroke-width="4" fill="none"/><path d="M204,162 C213,262 216,360 217,452" ${dash}/><path d="M796,162 C787,262 784,360 783,452" ${dash}/><path d="M38,712 L138,732 M962,712 L862,732 M210,980 Q500,994 790,980" ${dash}/>`
  let extra = ''
  if (side === 'front') {
    // hood lying behind the neck: outer shell, lining, neck shadow, ribbed opening edge
    extra += `<path d="M318,186 C292,96 360,20 500,16 C640,20 708,96 682,186 C640,170 360,170 318,186 Z" fill="${FABRIC}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M362,182 C350,104 414,56 500,54 C586,56 650,104 638,182 C606,226 546,246 500,250 C454,246 394,226 362,182 Z" fill="#202027"/><path d="M362,182 C350,104 414,56 500,54 C586,56 650,104 638,182" fill="none" stroke="url(#${uid}-tone)" stroke-width="40" opacity=".6"/><path d="M404,176 C402,122 446,94 500,94 C554,94 598,122 596,176 C568,208 530,220 500,222 C470,220 432,208 404,176 Z" fill="${FABRIC_DARK}"/><path d="M362,182 C350,104 414,56 500,54 C586,56 650,104 638,182 C606,226 546,246 500,250 C454,246 394,226 362,182 Z" fill="none" stroke="${RIB}" stroke-width="16"/><path d="M362,182 C350,104 414,56 500,54 C586,56 650,104 638,182 C606,226 546,246 500,250 C454,246 394,226 362,182 Z" fill="none" stroke="${STITCH}" stroke-width="2.2" stroke-dasharray="6 5"/><path d="M470,252 C486,236 514,236 530,252" stroke="${INK}" stroke-width="4" fill="none"/>`
    extra += `<path d="M456,232 C450,300 442,360 436,420" stroke="${PAPER}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M544,232 C552,300 560,360 566,428" stroke="${PAPER}" stroke-width="9" fill="none" stroke-linecap="round"/><rect x="429" y="418" width="14" height="30" rx="3" fill="#8D8A84" stroke="${INK}" stroke-width="2"/><rect x="559" y="426" width="14" height="30" rx="3" fill="#8D8A84" stroke="${INK}" stroke-width="2"/><circle cx="456" cy="232" r="8" fill="#8D8A84" stroke="${INK}" stroke-width="2"/><circle cx="544" cy="232" r="8" fill="#8D8A84" stroke="${INK}" stroke-width="2"/>`
    const pocket = 'M336,700 L664,700 C680,770 716,830 752,868 L752,968 L248,968 L248,868 C284,830 320,770 336,700 Z'
    extra += `<path d="${pocket}" fill="${FABRIC}" stroke="${FABRIC_DARK}" stroke-width="4"/><path d="M336,700 C320,770 284,830 248,868" stroke="${INK}" stroke-width="6" fill="none"/><path d="M664,700 C680,770 716,830 752,868" stroke="${INK}" stroke-width="6" fill="none"/><path d="M342,714 L658,714 M262,954 L738,954" ${dash}/><path d="M300,860 C340,890 420,900 500,900" stroke="${FABRIC_LIGHT}" stroke-width="4" fill="none" stroke-linecap="round"/>`
    extra += chestMark(590, 300, 0.85, PAPER, spec.colorA)
  } else {
    const pw = 400
    const ph = 510
    extra += `<g transform="translate(${500 - pw / 2},420)">${backPrint(spec, pw, ph)}</g>`
    extra += `<path d="M344,136 C330,52 670,52 656,136 C690,262 606,398 500,416 C394,398 310,262 344,136 Z" fill="${FABRIC}" stroke="${INK}" stroke-width="5"/><path d="M500,64 L500,414" stroke="${FABRIC_DARK}" stroke-width="4"/><path d="M490,70 L490,404 M510,70 L510,404" ${dash}/><path d="M380,150 C380,250 430,340 480,380" stroke="${FABRIC_LIGHT}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M344,136 C330,52 670,52 656,136" stroke="${RIB}" stroke-width="10" fill="none"/>`
  }
  const body = `<g><path d="${HOOD_PATH}" fill="${FABRIC}"/>${shade}${cuffs}${seams}${extra}<path d="${HOOD_PATH}" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/></g>`
  return { defs, body }
}

// ---------- standalone SVG builders (task API) ----------
export interface GarmentInput {
  side: ArtSide
  designTitle: string
  jpTitle?: string
  motif: ArtMotif
  colorA: string
  colorB: string
  colorBlock?: string
  /** seeds layout/variation; defaults to the title */
  seed?: string
  collectionName?: string
  uid?: string
}

function specFromInput(i: GarmentInput, type: string): ArtSpec {
  const seed = i.seed ?? i.designTitle.toLowerCase().replace(/\W+/g, '-')
  const s = artSpec({ slug: seed, type, collection: '__custom', designTitle: i.designTitle, jpTitle: i.jpTitle, colorBlock: i.colorBlock }, {
    motif: i.motif,
    accentA: i.colorA,
    accentB: i.colorB,
    name: i.collectionName ?? 'The Escape Door',
    jp: i.jpTitle,
  })
  return i.uid ? { ...s, uid: i.uid } : s
}

const wrap = (s: Subject, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GARMENT_W} ${GARMENT_H}" role="img" aria-label="${label.replace(/"/g, '')}"><defs>${s.defs}</defs>${s.body}</svg>`

export function teeSvg(i: GarmentInput): string {
  return wrap(teeSubject(specFromInput(i, 'tshirt'), i.side), `${i.designTitle} oversized tee, ${i.side}`)
}
export function hoodieSvg(i: GarmentInput): string {
  return wrap(hoodieSubject(specFromInput(i, 'hoodie'), i.side), `${i.designTitle} hoodie, ${i.side}`)
}
