#!/usr/bin/env node
/**
 * probe-review-layout.ts — does the review page hold still, and are its figures
 * the right shape?
 *
 *   node scripts/review-screenshots-web.ts &     # the page under test
 *   node scripts/probe-review-layout.ts [--port=3335] [--q=alignments]
 *
 * Two invariants, both invisible to the eye and both broken in one afternoon:
 *
 * 1. A card's images are sized from figures.lock before their bytes arrive, so
 *    the document does not grow as they load. Without it, scrolling the list is
 *    a procession of cards growing under the pointer — 52,192px of growth over
 *    326 cards, and 794px of it above the sixth.
 * 2. That reservation must not distort the picture. The width/height attributes
 *    doing the reserving are also presentational hints, so `height: auto` is
 *    what leaves the aspect ratio intact; without it every figure past the
 *    400px cap draws stretched, which nothing about the page looks wrong.
 *
 * Read-only: it never files a verdict, so it cannot touch screenshot-review.json.
 * The header's own invariant — that a verdict never resizes it — does need a
 * click, so it is checked by hand rather than here.
 */
import { parseArgs } from 'node:util'

import { launch } from 'puppeteer'

import type { HTTPRequest } from 'puppeteer'

const { values } = parseArgs({
  options: { port: { type: 'string' }, q: { type: 'string' } },
})
const port = values.port ?? '3335'
const q = values.q ?? ''

const browser = await launch({ args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 900 })
// Figures are local and decode instantly, which is the one condition under
// which the growth is invisible. Hold them back so first paint is genuinely a
// page with no pictures in it.
await page.setCacheEnabled(false)
await page.setRequestInterception(true)
page.on('request', (req: HTTPRequest) => {
  const go = () => void req.continue().catch(() => {})
  if (req.resourceType() === 'image') {
    setTimeout(go, 1500)
  } else {
    go()
  }
})
await page.goto(`http://localhost:${port}/?status=all&q=${q}`, {
  waitUntil: 'domcontentloaded',
})
await page.waitForSelector('.card')

const height = () =>
  page.evaluate(() => Math.round(document.documentElement.scrollHeight))
const before = await height()
await new Promise(r => setTimeout(r, 8000))
const after = await height()

// Every column that has decoded: is its reserved size the size that arrived,
// and is it drawn at the size the CSS box demands?
const bad = await page.evaluate(() =>
  [...document.querySelectorAll<HTMLImageElement>('.card-images img')]
    .filter(i => i.complete && i.naturalHeight)
    .map(i => {
      const avail = i.parentElement!.getBoundingClientRect().width
      const scale = Math.min(1, avail / i.naturalWidth, 400 / i.naturalHeight)
      return {
        name: i.getAttribute('alt') || i.src,
        reserved: `${i.getAttribute('width')}x${i.getAttribute('height')}`,
        decoded: `${i.naturalWidth}x${i.naturalHeight}`,
        drawn: Math.round(i.getBoundingClientRect().height),
        wants: Math.round(i.naturalHeight * scale),
      }
    })
    .filter(r => r.reserved !== r.decoded || Math.abs(r.drawn - r.wants) > 1),
)

const grew = after - before
console.log(`document grew ${grew}px while the figures loaded`)
console.log(`${bad.length} column(s) reserved or drawn at the wrong size`)
for (const r of bad.slice(0, 10)) {
  console.log(
    `  ${r.name}: reserved ${r.reserved}, decoded ${r.decoded}, drawn ${r.drawn} where geometry says ${r.wants}`,
  )
}
await browser.close()
process.exit(grew === 0 && bad.length === 0 ? 0 : 1)
