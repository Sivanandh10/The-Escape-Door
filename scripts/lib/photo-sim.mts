// Photo-like test images for scripts/calibrate-image-search.mts (owner: SEARCH). Deterministic (seeded), sharp only.
//   onPhoto(fg, bg, frac, skew)   an RGBA image laid on a surface and photographed: perspective (keystone + jitter),
//                                 ±7° rotation, drop shadow, brightness / saturation / white-balance shift, blur, JPEG q72
//   cutGarment(bytes)             the dark garment of a tee / hoodie mockup, cut out of the poster frame (RGBA)
//   cutToPng(cut, region?)        that cut-out (or a region of it, e.g. the print) as a PNG
//   foreignTee(cut, art, fabric)  the same garment silhouette with OUR print replaced (another shop's tee)
//   backgrounds(web)              wood / bedsheet / grey floor (+ 2 blurred real rooms from picsum.photos with web)
//   foreignArts(web)              prints that are not ours (text, sunburst + kanji, skull band logo, halftone hero…)
// Originally the reviewer's QA harness (qa/visual-search-acc/adversarial.mts); per-channel .linear() white balance.
import sharp from 'sharp'

export const W = 900
export const H = 1200

export function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Cut { rgba: Buffer; mask: Uint8Array; w: number; h: number; bbox: { x0: number; y0: number; x1: number; y1: number } }

export function createPhotoSim(seed = 1234) {
  const rnd = mulberry32(seed)
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, rnd()))) * Math.cos(2 * Math.PI * rnd())

  async function noisy(w: number, h: number, base: [number, number, number], sigma: number, streak = 0): Promise<Buffer> {
    const buf = Buffer.alloc(w * h * 3)
    for (let y = 0; y < h; y++) {
      const s = streak ? Math.sin(y / streak + Math.sin(y / 37) * 2) * 18 : 0
      const shade = 1 - 0.25 * Math.hypot((y - h / 2) / h, 0)
      for (let x = 0; x < w; x++) {
        const v = (1 - 0.3 * Math.hypot((x - w / 2) / w, (y - h / 2) / h)) * shade
        for (let c = 0; c < 3; c++) buf[(y * w + x) * 3 + c] = Math.max(0, Math.min(255, Math.round((base[c] + s) * v + gauss() * sigma)))
      }
    }
    return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).blur(0.8).png().toBuffer()
  }

  async function backgrounds(web: boolean): Promise<Array<{ name: string; bytes: Buffer }>> {
    const out = [
      { name: 'wood', bytes: await noisy(W, H, [150, 105, 70], 10, 6) },
      { name: 'bedsheet', bytes: await noisy(W, H, [225, 222, 215], 7) },
      { name: 'grey-floor', bytes: await noisy(W, H, [120, 122, 125], 14) },
    ]
    if (web) {
      for (const s of ['ted-bg-room', 'ted-bg-desk']) {
        try {
          const r = await fetch(`https://picsum.photos/seed/${s}/${W}/${H}`)
          if (r.ok) out.push({ name: `picsum:${s}`, bytes: await sharp(Buffer.from(await r.arrayBuffer())).blur(6).modulate({ brightness: 0.95 }).png().toBuffer() })
        } catch {
          /* offline: synthetic backgrounds only */
        }
      }
    }
    return out
  }

  // perspective warp: inverse homography + bilinear sampling
  function homography(src: number[][], dst: number[][]): number[] {
    const A: number[][] = []
    const b: number[] = []
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i]
      const [u, v] = dst[i]
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
      b.push(u)
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y])
      b.push(v)
    }
    for (let c = 0; c < 8; c++) {
      let p = c
      for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
      ;[A[c], A[p]] = [A[p], A[c]]
      ;[b[c], b[p]] = [b[p], b[c]]
      for (let r = 0; r < 8; r++) {
        if (r === c) continue
        const f = A[r][c] / A[c][c]
        for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]
        b[r] -= f * b[c]
      }
    }
    return [...b.map((v, i) => v / A[i][i]), 1]
  }
  async function warp(png: Buffer, quad: number[][], ow: number, oh: number): Promise<Buffer> {
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const w = info.width
    const h = info.height
    const Hm = homography(quad, [[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]]) // dst → src
    const out = Buffer.alloc(ow * oh * 4)
    for (let y = 0; y < oh; y++) {
      for (let x = 0; x < ow; x++) {
        const d = Hm[6] * x + Hm[7] * y + Hm[8]
        const sx = (Hm[0] * x + Hm[1] * y + Hm[2]) / d
        const sy = (Hm[3] * x + Hm[4] * y + Hm[5]) / d
        if (sx < 0 || sy < 0 || sx > w - 1 || sy > h - 1) continue
        const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1)
        const fx = sx - x0, fy = sy - y0
        for (let c = 0; c < 4; c++) {
          const v = data[(y0 * w + x0) * 4 + c] * (1 - fx) * (1 - fy) + data[(y0 * w + x1) * 4 + c] * fx * (1 - fy) + data[(y1 * w + x0) * 4 + c] * (1 - fx) * fy + data[(y1 * w + x1) * 4 + c] * fx * fy
          out[(y * ow + x) * 4 + c] = Math.round(v)
        }
      }
    }
    return sharp(out, { raw: { width: ow, height: oh, channels: 4 } }).png().toBuffer()
  }

  async function onPhoto(fg: Buffer, bg: Buffer, frac: number, skew = 0.08): Promise<Buffer> {
    const m = await sharp(fg).metadata()
    const s = (H * frac) / (m.height ?? 1)
    const fw = (m.width ?? 1) * s
    const fh = (m.height ?? 1) * s
    const cx = W / 2 + (rnd() - 0.5) * 60
    const cy = H / 2 + (rnd() - 0.5) * 60
    const ang = (rnd() - 0.5) * 0.25 // ±7°
    const jit = () => (rnd() - 0.5) * 2 * skew
    const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([u, v], i) => {
      const k = i < 2 ? 1 - skew : 1 + skew * 0.3 // keystone: camera tilted, top edge narrower
      const x = u * fw * k + jit() * fw
      const y = v * fh + jit() * fh
      return [cx + x * Math.cos(ang) - y * Math.sin(ang), cy + x * Math.sin(ang) + y * Math.cos(ang)]
    })
    const warped = await warp(fg, corners, W, H)
    const shadow = await sharp(warped).extractChannel(3).blur(14).toBuffer()
    const sh = await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).joinChannel(await sharp(shadow).linear(0.45, 0).toBuffer()).png().toBuffer()
    const comp = await sharp(bg).resize(W, H).composite([{ input: sh, left: 12, top: 18 }, { input: warped }]).png().toBuffer()
    const bright = 0.85 + rnd() * 0.3
    return sharp(comp)
      .modulate({ brightness: bright, saturation: 0.85 + rnd() * 0.25 })
      .linear([1, (240 + Math.round(rnd() * 15)) / 255, (215 + Math.round(rnd() * 30)) / 255], [0, 0, 0])
      .blur(0.6)
      .jpeg({ quality: 72 })
      .toBuffer()
  }

  /** the dark garment (largest dark 4-connected blob, rows filled) of a tee / hoodie mockup */
  async function cutGarment(bytes: Buffer): Promise<Cut | null> {
    const w = 600
    const { data, info } = await sharp(bytes).resize({ width: w }).flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const h = info.height
    const dark = new Uint8Array(w * h)
    for (let y = Math.round(h * 0.12); y < Math.round(h * 0.88); y++) {
      for (let x = Math.round(w * 0.03); x < Math.round(w * 0.97); x++) {
        const i = (y * w + x) * 3
        if (Math.max(data[i], data[i + 1], data[i + 2]) < 48) dark[y * w + x] = 1
      }
    }
    const lab = new Int32Array(w * h)
    let best = 0, bestN = 0, id = 0
    const stack: number[] = []
    for (let p = 0; p < w * h; p++) {
      if (!dark[p] || lab[p]) continue
      id++
      let n = 0
      stack.push(p)
      lab[p] = id
      while (stack.length) {
        const q = stack.pop()!
        n++
        const x = q % w, y = (q / w) | 0
        for (const r of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, y > 0 ? q - w : -1, y < h - 1 ? q + w : -1]) {
          if (r >= 0 && dark[r] && !lab[r]) {
            lab[r] = id
            stack.push(r)
          }
        }
      }
      if (n > bestN) {
        bestN = n
        best = id
      }
    }
    if (bestN < w * h * 0.08) return null
    const mask = new Uint8Array(w * h)
    let x0 = w, y0 = h, x1 = 0, y1 = 0
    for (let y = 0; y < h; y++) {
      let a = -1, b = -1
      for (let x = 0; x < w; x++) {
        if (lab[y * w + x] === best) {
          if (a < 0) a = x
          b = x
        }
      }
      if (a < 0) continue
      for (let x = a; x <= b; x++) mask[y * w + x] = 255
      x0 = Math.min(x0, a); x1 = Math.max(x1, b); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
    }
    const rgba = Buffer.alloc(w * h * 4)
    for (let p = 0; p < w * h; p++) {
      rgba[p * 4] = data[p * 3]
      rgba[p * 4 + 1] = data[p * 3 + 1]
      rgba[p * 4 + 2] = data[p * 3 + 2]
      rgba[p * 4 + 3] = mask[p]
    }
    return { rgba, mask, w, h, bbox: { x0, y0, x1, y1 } }
  }

  async function cutToPng(c: Cut, region?: { x0: number; y0: number; x1: number; y1: number }): Promise<Buffer> {
    const r = region ?? c.bbox
    return sharp(c.rgba, { raw: { width: c.w, height: c.h, channels: 4 } }).extract({ left: r.x0, top: r.y0, width: r.x1 - r.x0 + 1, height: r.y1 - r.y0 + 1 }).png().toBuffer()
  }

  /** the print area of a cut-out garment (what a close-up of the print shows) */
  function printRegion(c: Cut) {
    const { x0, y0, x1, y1 } = c.bbox
    const bw = x1 - x0, bh = y1 - y0
    return { x0: Math.round(x0 + bw * 0.22), y0: Math.round(y0 + bh * 0.12), x1: Math.round(x0 + bw * 0.78), y1: Math.round(y0 + bh * 0.75) }
  }

  async function foreignTee(c: Cut, art: Buffer | null, fabric: [number, number, number] = [20, 20, 22]): Promise<Buffer> {
    const { w, h, mask, bbox } = c
    const rgba = Buffer.alloc(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x
        const fold = Math.sin(x / 23 + y / 41) * 4 + Math.sin(y / 17) * 3
        for (let k = 0; k < 3; k++) rgba[p * 4 + k] = Math.max(0, Math.min(255, Math.round(fabric[k] + fold + gauss() * 2)))
        rgba[p * 4 + 3] = mask[p]
      }
    }
    let png = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer()
    if (art) {
      const bw = bbox.x1 - bbox.x0, bh = bbox.y1 - bbox.y0
      const aw = Math.round(bw * 0.46), ah = Math.round(bh * 0.5)
      const a = await sharp(art).resize(aw, ah, { fit: 'cover' }).png().toBuffer()
      png = await sharp(png).composite([{ input: a, left: Math.round(bbox.x0 + (bw - aw) / 2), top: Math.round(bbox.y0 + bh * 0.22) }]).png().toBuffer()
    }
    return cutToPng({ ...c, rgba: await sharp(png).raw().toBuffer() })
  }

  async function foreignArts(web: boolean): Promise<Array<{ name: string; bytes: Buffer | null }>> {
    const svgArt = (body: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="650" viewBox="0 0 600 650">${body}</svg>`)
    const arts: Array<{ name: string; bytes: Buffer | null }> = [
      { name: 'plain (no print)', bytes: null },
      { name: 'text NEO TOKYO', bytes: svgArt('<text x="300" y="300" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="110" fill="#f4efe6">NEO</text><text x="300" y="430" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="110" fill="#ff3d3d">TOKYO</text>') },
      { name: 'sunburst + kanji', bytes: svgArt('<circle cx="300" cy="300" r="230" fill="#e33"/>' + Array.from({ length: 24 }, (_, i) => `<line x1="300" y1="300" x2="${300 + 300 * Math.cos((i * Math.PI) / 12)}" y2="${300 + 300 * Math.sin((i * Math.PI) / 12)}" stroke="#fff" stroke-width="10"/>`).join('') + '<text x="300" y="360" text-anchor="middle" font-size="160" font-family="MS Gothic,Arial" fill="#111">侍</text><text x="300" y="610" text-anchor="middle" font-family="Arial" font-weight="700" font-size="56" fill="#fff">SAMURAI SPIRIT</text>') },
      { name: 'skull band logo', bytes: svgArt('<ellipse cx="300" cy="260" rx="170" ry="190" fill="#eee"/><circle cx="235" cy="250" r="45" fill="#111"/><circle cx="365" cy="250" r="45" fill="#111"/><rect x="230" y="380" width="140" height="70" fill="#eee"/><text x="300" y="560" text-anchor="middle" font-family="Georgia" font-style="italic" font-size="80" fill="#c9a24d">Iron Hearts</text>') },
      { name: 'halftone circle anime-ish', bytes: svgArt('<defs><pattern id="d" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="7" cy="7" r="4" fill="#ffd34d"/></pattern></defs><circle cx="300" cy="300" r="250" fill="url(#d)"/><path d="M180 420 Q300 120 420 420 Z" fill="#6d3bff"/><circle cx="300" cy="260" r="70" fill="#f4c7a1"/><text x="300" y="600" text-anchor="middle" font-family="Arial Black,Arial" font-size="62" fill="#fff">STAR HERO</text>') },
    ]
    if (web) {
      for (let i = 1; i <= 3; i++) {
        try {
          const r = await fetch(`https://picsum.photos/seed/ted-print-${i}/600/650`)
          if (r.ok) arts.push({ name: `photo print picsum ${i}`, bytes: Buffer.from(await r.arrayBuffer()) })
        } catch {
          /* offline */
        }
      }
    }
    return arts
  }

  return { rnd, backgrounds, onPhoto, cutGarment, cutToPng, printRegion, foreignTee, foreignArts }
}
