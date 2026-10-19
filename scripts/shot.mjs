#!/usr/bin/env node
// Visual QA helper used by every build agent (each run gets its own Chromium).
//
//   node scripts/shot.mjs <url> [--out=qa/<name>] [--widths=390,768,1440]
//        [--scrolls=0,0.25,0.5,0.75,1] [--wait=1200] [--reduced] [--full]
//        [--click=<css>] [--hover=<css>]
//
// --scrolls: fractions of the scrollable height, or absolute px with a "px" suffix (e.g. 0,800px,1600px).
// Saves <out>/<width>-<i>.png and prints a JSON report: console errors, page errors,
// failed requests, horizontal overflow (offending elements), and the files written.
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const args = Object.fromEntries(
  process.argv.slice(3).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.length ? v.join('=') : true]
  }),
)
const url = process.argv[2]
if (!url) {
  console.error('usage: node scripts/shot.mjs <url> [--out=dir] [--widths=390,768,1440] [--scrolls=0,0.5,1]')
  process.exit(1)
}
const out = args.out || `qa/${new URL(url).pathname.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home'}`
const widths = String(args.widths || '390,768,1440').split(',').map(Number)
const scrolls = String(args.scrolls || '0').split(',')
const wait = Number(args.wait || 1200)
fs.mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const report = { url, files: [], consoleErrors: [], pageErrors: [], failedRequests: [], overflow: {} }

for (const width of widths) {
  const height = width <= 480 ? 844 : width <= 900 ? 1024 : 900
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: args.reduced ? 'reduce' : 'no-preference',
    hasTouch: width <= 900,
    isMobile: width <= 480,
  })
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && report.consoleErrors.push(`[${width}] ${m.text()}`.slice(0, 400)))
  page.on('pageerror', (e) => report.pageErrors.push(`[${width}] ${e.message}`.slice(0, 400)))
  page.on('requestfailed', (r) => report.failedRequests.push(`[${width}] ${r.url()} ${r.failure()?.errorText}`))
  page.on('response', (r) => r.status() >= 400 && report.failedRequests.push(`[${width}] ${r.status()} ${r.url()}`))
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }).catch((e) => report.pageErrors.push(`goto: ${e.message}`))
  await page.waitForTimeout(wait)
  if (args.hover) await page.hover(String(args.hover)).catch(() => {})
  if (args.click) await page.click(String(args.click)).catch(() => {})

  for (let i = 0; i < scrolls.length; i++) {
    const s = scrolls[i]
    await page.evaluate((s) => {
      const max = document.documentElement.scrollHeight - innerHeight
      const y = s.endsWith('px') ? parseFloat(s) : parseFloat(s) * max
      // Lenis listens to native scroll when we jump; fire both for safety.
      window.__lenis?.scrollTo?.(y, { immediate: true, force: true })
      window.scrollTo(0, y)
    }, s)
    await page.waitForTimeout(Math.max(500, wait / 2))
    const file = path.join(out, `${width}-${i}.png`)
    await page.screenshot({ path: file, fullPage: !!args.full })
    report.files.push(file)
  }

  report.overflow[width] = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const bad = []
    if (document.documentElement.scrollWidth > vw + 1) {
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect()
        if (r.right > vw + 1 && r.width > 0 && getComputedStyle(el).position !== 'fixed') {
          bad.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className).slice(0, 60)} right=${Math.round(r.right)}`)
          if (bad.length > 8) break
        }
      }
    }
    return { scrollWidth: document.documentElement.scrollWidth, viewport: vw, offenders: bad }
  })
  await ctx.close()
}
await browser.close()
console.log(JSON.stringify(report, null, 2))
