// Deterministic renderer: static server -> Playwright Chromium -> seek(t) per frame -> PNG -> FFmpeg.
// node reel/render.mjs [--fps 30] [--dur 15] [--stills 0.6,2.8] [--from 0 --to 15] [--no-encode]
import http from 'node:http'
import { readFile, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => { if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a }, []))
const fps = +(args.fps || 30), dur = +(args.dur || 15)
const W = +(args.w || 1080), H = +(args.h || 1920)
const page_ = args.page || 'index.html'
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png', '.js': 'text/javascript' }
const server = http.createServer(async (req, res) => {
  try {
    const p = path.join(here, decodeURIComponent(new URL(req.url, 'http://x').pathname))
    if (!p.startsWith(here)) throw 0
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' })
    res.end(await readFile(p))
  } catch { res.writeHead(404); res.end() }
}).listen(0)
const port = server.address().port
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
page.on('pageerror', e => console.error('pageerror', e.message))
await page.goto(`http://127.0.0.1:${port}/${page_}`)
await page.evaluate(() => window.ready)

if (args.stills) {
  const out = path.join(here, 'out', 'stills'); await mkdir(out, { recursive: true })
  for (const t of String(args.stills).split(',').map(Number)) {
    await page.evaluate(t => window.seek(t), t)
    await page.screenshot({ path: path.join(out, `t${t.toFixed(2)}.png`) })
  }
  console.log('stills ->', out)
} else {
  const frames = path.join(here, 'frames'); await rm(frames, { recursive: true, force: true }); await mkdir(frames, { recursive: true })
  const n = Math.round(dur * fps), t0 = Date.now()
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => window.seek(t), i / fps)
    await page.screenshot({ path: path.join(frames, `f_${String(i).padStart(5, '0')}.png`) })
    if (i % 60 === 0) console.log(`frame ${i}/${n} ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  }
  if (!args['no-encode']) {
    const out = path.join(here, 'out'); await mkdir(out, { recursive: true })
    const name = args.name || 'escape-door-reel-9x16'
    const silent = path.join(out, `${name}-silent.mp4`)
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(frames, 'f_%05d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf || 16), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent], { stdio: 'inherit' })
    if (r.status !== 0) throw new Error('ffmpeg failed')
    const wav = path.join(out, 'sfx.wav')
    const s = spawnSync('node', [path.join(here, 'sfx.mjs'), wav, String(dur)], { stdio: 'inherit' })
    const final = path.join(out, `${name}.mp4`)
    if (s.status === 0) spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', final], { stdio: 'inherit' })
    console.log('video ->', final)
  }
}
await browser.close(); server.close()
