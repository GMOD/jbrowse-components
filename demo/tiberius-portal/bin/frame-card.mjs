#!/usr/bin/env node
// Frame one card off a built portal — the picture a PR or an issue links to.
//
// The portal itself is the page a reviewer works in, so the shot that
// represents it is the page: the summary strip, the class filter narrowed to
// the card's class, and the card whole underneath. Filtering is what puts the
// chosen card first; the alternative is a scroll offset, which moves the moment
// any count changes.
import fs from 'node:fs'
import path from 'node:path'

import puppeteer from 'puppeteer'

import { serveStatic } from '../lib/serve.mjs'

const CLASS_LABELS = {
  merge: 'Merged model',
  'structure-conflict': 'Structure conflict',
  'novel-locus': 'Novel locus',
  'novel-coding': 'Novel coding',
}

function usage() {
  console.log(`
frame-card — screenshot one card of a built portal

  node bin/frame-card.mjs --portal <dir> --card <model id> --out <file.png>

  --portal <dir>   a directory make-portal.mjs wrote (needs its index.html)
  --card <id>      the model to frame, e.g. g13516.t1
  --out <file>     PNG to write
  --width <px>     page width (default 1240, which renders a 1400px capture
                   inside the card at very close to its natural size)
`)
}

const opts = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  const next = () => argv[++i]
  const a = argv[i]
  if (a === '--portal') {
    opts.portal = next()
  } else if (a === '--card') {
    opts.card = next()
  } else if (a === '--out') {
    opts.out = next()
  } else if (a === '--width') {
    opts.width = +next()
  } else if (a === '--help' || a === '-h') {
    opts.help = true
  } else {
    throw new Error(`unknown flag ${a}`)
  }
}
if (opts.help || !opts.portal || !opts.card || !opts.out) {
  usage()
  process.exit(opts.help ? 0 : 1)
}

const width = opts.width || 1240
const index = path.join(opts.portal, 'index.html')
if (!fs.existsSync(index)) {
  console.error(`no index.html in ${opts.portal} — run make-portal.mjs first`)
  process.exit(1)
}

const server = await serveStatic(opts.portal)
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width, height: 1400, deviceScaleFactor: 2 })
  await page.goto(`${server.url}/index.html`, { waitUntil: 'networkidle0' })

  const cls = await page.evaluate(
    id =>
      [...document.querySelectorAll('.card')].find(c =>
        c.textContent.includes(id),
      )?.dataset.cls,
    opts.card,
  )
  if (!cls) {
    throw new Error(`no card for ${opts.card} in ${opts.portal}`)
  }
  await page.evaluate(label => {
    ;[...document.querySelectorAll('button')]
      .find(b => b.textContent.trim().startsWith(label))
      ?.click()
  }, CLASS_LABELS[cls] || 'All')

  // The captures are inline data: URIs, so re-rendering the list decodes them
  // again rather than fetching anything a load event would cover.
  await page.waitForFunction(
    id => document.querySelector('.card')?.textContent.includes(id),
    { timeout: 20000 },
    opts.card,
  )
  await page.evaluate(
    () =>
      new Promise(resolve => {
        const shot = document.querySelector('.card .shot')
        if (!shot || shot.complete) {
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        } else {
          shot.addEventListener('load', () => requestAnimationFrame(resolve))
        }
      }),
  )

  const bottom = await page.evaluate(() => {
    const r = document.querySelector('.card').getBoundingClientRect()
    return r.bottom + window.scrollY
  })
  await page.screenshot({
    path: path.resolve(opts.out),
    clip: { x: 0, y: 0, width, height: Math.ceil(bottom) + 14 },
  })
  console.log(`${opts.out} — ${opts.card} (${cls})`)
} finally {
  await browser.close()
  await server.close()
}
