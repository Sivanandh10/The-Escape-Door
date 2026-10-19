// Downloads the site's Google Fonts (OFL, free) into reel/assets/fonts so renders are offline + deterministic.
// JP faces are subset to exactly the characters used in reel/index.html (Google Fonts `text=` param).
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const reel = path.resolve(here, '..')
const outDir = path.join(reel, 'assets', 'fonts')
await mkdir(outDir, { recursive: true })
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const html = await readFile(path.join(reel, 'index.html'), 'utf8')
const nonAscii = [...new Set([...html].filter((c) => c.charCodeAt(0) > 0x2000))].join('')

const requests = [
  'family=Anton&family=Bangers&family=DM+Sans:wght@500;700&family=JetBrains+Mono:wght@700',
  `family=Dela+Gothic+One&family=Noto+Sans+JP:wght@900&text=${encodeURIComponent(nonAscii + '!?×')}`,
]
let css = ''
for (const q of requests) {
  const res = await fetch(`https://fonts.googleapis.com/css2?${q}&display=block`, { headers: { 'user-agent': UA } })
  let text = await res.text()
  const urls = [...text.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1])
  for (const u of urls) {
    const name = createHash('sha1').update(u).digest('hex').slice(0, 12) + '.woff2'
    const buf = Buffer.from(await (await fetch(u, { headers: { 'user-agent': UA } })).arrayBuffer())
    await writeFile(path.join(outDir, name), buf)
    text = text.split(u).join(`fonts/${name}`)
  }
  css += text + '\n'
}
await writeFile(path.join(reel, 'assets', 'fonts.css'), css)
console.log('fonts ok; jp chars:', nonAscii.length)
