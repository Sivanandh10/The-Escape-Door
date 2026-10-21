// Visual search — read an image's pixel size from its header, without decoding it (owner: SEARCH). Pure, no DOM.
// Used by the worker to refuse decompression bombs (a 770 kB PNG can be 16 000 × 16 000 px = 1 GB of RGBA) and to
// decode big camera photos straight to a small size. Knows PNG, JPEG, WebP, GIF and BMP; anything else → null
// (the caller then decodes normally). JPEG size is the stored size: EXIF rotation may swap width and height, which
// doesn't matter for a pixel count.

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1]
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8)
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3])
const i32le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n))

export function imageDims(b: Uint8Array): { w: number; h: number } | null {
  if (b.length < 26) return null
  // PNG: signature, then IHDR width / height (big-endian)
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return { w: u32be(b, 16), h: u32be(b, 20) }
  // GIF87a / GIF89a: logical screen size (little-endian)
  if (ascii(b, 0, 4) === 'GIF8') return { w: u16le(b, 6), h: u16le(b, 8) }
  // BMP: BITMAPINFOHEADER width / height (height may be negative = top-down)
  if (b[0] === 0x42 && b[1] === 0x4d) return { w: Math.abs(i32le(b, 18)), h: Math.abs(i32le(b, 22)) }
  // WebP: RIFF....WEBP + VP8 / VP8L / VP8X chunk
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP' && b.length >= 30) {
    const fourcc = ascii(b, 12, 4)
    if (fourcc === 'VP8X') return { w: u24le(b, 24) + 1, h: u24le(b, 27) + 1 }
    if (fourcc === 'VP8L') {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)
      return { w: (bits & 0x3fff) + 1, h: ((bits >>> 14) & 0x3fff) + 1 }
    }
    if (fourcc === 'VP8 ') return { w: u16le(b, 26) & 0x3fff, h: u16le(b, 28) & 0x3fff }
    return null
  }
  // JPEG: walk the markers to the first SOFn frame header
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++
        continue
      }
      const m = b[i + 1]
      if (m === 0xff) {
        i++
        continue
      }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
        i += 2
        continue
      }
      const len = u16be(b, i + 2)
      // SOF0–SOF15 except DHT (C4), JPG (C8), DAC (CC)
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: u16be(b, i + 7), h: u16be(b, i + 5) }
      if (m === 0xda || m === 0xd9 || len < 2) return null
      i += 2 + len
    }
    return null
  }
  return null
}

/** Bytes worth reading for imageDims(): JPEG frame headers can sit behind ~64 kB of EXIF / thumbnails. */
export const DIMS_HEAD_BYTES = 256 * 1024
