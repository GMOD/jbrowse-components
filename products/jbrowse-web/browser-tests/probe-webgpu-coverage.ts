// Why the alignments coverage strip is missing from the webgpu capture while
// every read below it is pixel-identical. The attribution is settled and
// written up in agent-docs/reference/SCREENSHOT_CAPTURE_RACE.md, "The third
// one"; this file is the instrument that settled it and the one that now checks
// the fix.
//
// The pixel evidence cannot tell a render bug from a capture bug: a strip that
// was never drawn and a strip that was drawn but did not composite look the
// same in a screenshot. So this asks the page instead of the picture. For each
// backend it reports the display's geometry and writes PNGs of the same canvas
// — the BACKING STORE (toDataURL, what was drawn), the capture the suite takes
// (captureElementPng, a clip at the measured rect) and the capture puppeteer
// takes on its own (el.screenshot, which scrolls first) — then prints where they
// disagree, row by row. The disagreement is the verdict:
//
//   backing store has the band, screenshot does not -> capture/compositing side
//   neither has it                                  -> the pass drew nothing
//
// With the fix in place the two capture lines separate: the harness capture
// agrees with the backing store and the unfixed one carries the 37px band.
//
// Same instrument and same caveat as the blank-capture work: "drew nothing" is
// conclusive on canvas2d and only consistent on a GPU backend, because a
// cleared drawing buffer reads back identically. canvas2d and webgl are run
// too, as the control that says the band is readable this way at all.
//
// The backend is chosen by the browser, exactly as the runner does it: Chrome
// with --disable-gpu has no WebGL so the app falls back to Canvas2D, Chrome
// with swiftshader gets WebGL, and WebGPU needs Firefox Nightly.
//
//     node browser-tests/probe-webgpu-coverage.ts
//     OUT=/tmp/probe FIREFOX=/path/to/firefox node browser-tests/probe-webgpu-coverage.ts

import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { displayPainted } from '@jbrowse/browser-test-utils'
import { PNG } from 'pngjs'
import { launch } from 'puppeteer'

import {
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
  waitForDisplayPaint,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'
import { captureElementPng } from './snapshot.ts'

import type { Browser, Page } from 'puppeteer'

const FIREFOX = process.env.FIREFOX ?? '/usr/bin/firefox-nightly'
const OUT = process.env.OUT ?? path.join(os.tmpdir(), 'webgpu-coverage-probe')
const HOST = displayPainted('pileup-display')
const SELECTOR = `${HOST} canvas`

// color-by-strand: one of the four failures, at a locus that reproduces it.
const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1000-2000',
      tracks: [
        {
          trackId: 'volvox_alignments',
          displaySnapshot: {
            colorBy: { type: 'strand' },
            ...(process.env.COVERAGE_HEIGHT
              ? { coverageHeight: Number(process.env.COVERAGE_HEIGHT) }
              : {}),
          },
        },
      ],
    },
  ],
}

// What the page can tell us that a screenshot cannot: where the canvas sits,
// what else is layered near its top edge (if the ruler shows through under one
// backend, it is one of these), and what the backing store holds.
// `host` arrives as a selector string rather than being built in here.
// `displayPainted` is a node-side import and `page.evaluate` ships the function
// body to the browser, so calling it in there threw `displayPainted is not
// defined` on the first read — which is every run of this probe since
// b7f076fe04 swept the literal into the helper.
async function readPage(page: Page) {
  return page.evaluate(
    ([selector, host]: [string, string]) => {
      const canvas = document.querySelector(selector)
      if (!(canvas instanceof HTMLCanvasElement)) {
        return { error: `no canvas for ${selector}` }
      }
      const hostEl = canvas.closest(host)
      const rect = canvas.getBoundingClientRect()
      const hostRect = hostEl?.getBoundingClientRect()
      const near = [...document.querySelectorAll<HTMLElement>('[data-testid]')]
        // An ancestor always "overlaps" the canvas and always by most of its
        // height, which is noise on every backend. Only siblings layered over it
        // can bleed into the capture.
        .filter(el => !el.contains(canvas))
        .map(el => {
          const r = el.getBoundingClientRect()
          return {
            testid: el.dataset.testid,
            top: Math.round(r.top),
            height: Math.round(r.height),
          }
        })
        .filter(e => e.top >= rect.top - 120 && e.top <= rect.top + 60)
        .sort((a, b) => a.top - b.top)
      // Per-row attribution: what is painted OVER the canvas at each row of the
      // band. `near` can only find elements carrying a data-testid, and the rows
      // it fails to account for are exactly the question. Sampled at three x
      // positions because the chrome over the band is not full-width.
      // `Element`, not `HTMLElement`: the callers include `elementsFromPoint`,
      // which is typed to the former — so `.dataset` is not available here.
      const describe = (el: Element) => {
        // eslint-disable-next-line unicorn/dom-node-dataset
        const testid = el.getAttribute('data-testid')
        const cls = el.className
        return testid
          ? `[${testid}]`
          : `${el.tagName.toLowerCase()}${typeof cls === 'string' && cls ? `.${cls.split(' ')[0]}` : ''}`
      }
      const rows: { row: number; over: string[] }[] = []
      for (let k = 0; k < 44; k++) {
        const found = new Set<string>()
        for (const fx of [0.1, 0.5, 0.9]) {
          const stack = document.elementsFromPoint(
            rect.left + rect.width * fx,
            rect.top + k + 0.5,
          )
          const at = stack.indexOf(canvas)
          for (const el of at < 0 ? stack : stack.slice(0, at)) {
            if (!el.contains(canvas)) {
              found.add(describe(el))
            }
          }
        }
        rows.push({ row: k, over: [...found] })
      }
      return {
        canvas: {
          cssTop: Math.round(rect.top),
          cssLeft: Math.round(rect.left),
          cssWidth: Math.round(rect.width),
          cssHeight: Math.round(rect.height),
          attrWidth: canvas.width,
          attrHeight: canvas.height,
          dpr: window.devicePixelRatio,
        },
        rows,
        scrollY: Math.round(window.scrollY),
        hostTop: hostRect ? Math.round(hostRect.top) : null,
        hostHeight: hostRect ? Math.round(hostRect.height) : null,
        near,
        dataUrl: (() => {
          try {
            return canvas.toDataURL('image/png')
          } catch (e) {
            return `error: ${String(e)}`
          }
        })(),
      }
    },
    [SELECTOR, HOST] as [string, string],
  )
}

// One channel of a pixel, composited over white. The backing store keeps its
// alpha and the screenshot arrives already flattened by the compositor, so
// comparing them raw reports 100% differing on every backend, because the
// canvas is transparent almost everywhere and transparent-black is not white.
// Flattening is what makes the two comparable at all.
function overWhite(data: Buffer, i: number, ch: number) {
  const a = data[i + 3]! / 255
  return Math.round(data[i + ch]! * a + 255 * (1 - a))
}

// Contiguous runs of rows where more than 20% of the row differs. The whole
// finding this probe exists to explain is one such run, rows 0-36.
function hotRows(a: Buffer | Uint8Array, b: Buffer | Uint8Array) {
  const x = PNG.sync.read(Buffer.from(a))
  const y = PNG.sync.read(Buffer.from(b))
  if (x.width !== y.width || x.height !== y.height) {
    return `sizes differ: ${x.width}x${x.height} vs ${y.width}x${y.height}`
  }
  const runs: string[] = []
  let start = -1
  let total = 0
  for (let r = 0; r <= x.height; r++) {
    let n = 0
    if (r < x.height) {
      for (let c = 0; c < x.width; c++) {
        const i = (r * x.width + c) * 4
        if (
          Math.abs(overWhite(x.data, i, 0) - overWhite(y.data, i, 0)) > 8 ||
          Math.abs(overWhite(x.data, i, 1) - overWhite(y.data, i, 1)) > 8 ||
          Math.abs(overWhite(x.data, i, 2) - overWhite(y.data, i, 2)) > 8
        ) {
          n++
        }
      }
    }
    total += n
    const hot = r < x.height && n / x.width > 0.2
    if (hot && start < 0) {
      start = r
    }
    if (!hot && start >= 0) {
      runs.push(`rows ${start}-${r - 1} (${r - start}px)`)
      start = -1
    }
  }
  const pct = ((total / (x.width * x.height)) * 100).toFixed(2)
  return runs.length > 0
    ? `${pct}% overall, hot: ${runs.join(', ')}`
    : `${pct}% overall, no hot rows`
}

// Where in the page did the band come from? Slide the element capture's first
// `bandPx` rows over the viewport capture and report the offset that matches
// best. This attributes the bleed by CONTENT, with no reasoning about the DOM:
// if the band is page rows N..N+bandPx composited into the canvas rectangle,
// this finds N and the residual says how exactly.
function bestSourceOffset(
  elementShot: Buffer,
  pageShot: Buffer,
  left: number,
  bandPx: number,
) {
  const e = PNG.sync.read(elementShot)
  const p = PNG.sync.read(pageShot)
  let best = { offset: -1, diff: 1 }
  for (let off = 0; off + bandPx <= p.height; off++) {
    let n = 0
    let cmp = 0
    for (let r = 0; r < bandPx; r++) {
      for (let c = 0; c < e.width && left + c < p.width; c += 2) {
        const i = (r * e.width + c) * 4
        const j = ((off + r) * p.width + left + c) * 4
        cmp++
        if (
          Math.abs(e.data[i]! - p.data[j]!) > 8 ||
          Math.abs(e.data[i + 1]! - p.data[j + 1]!) > 8 ||
          Math.abs(e.data[i + 2]! - p.data[j + 2]!) > 8
        ) {
          n++
        }
      }
    }
    if (n / cmp < best.diff) {
      best = { offset: off, diff: n / cmp }
    }
  }
  return best
}

// Collapse the per-row attribution into runs, so 37 rows print as a couple of
// lines naming what covers them.
function attributionRuns(rows: { row: number; over: string[] }[]) {
  const out: string[] = []
  let start = 0
  for (let i = 1; i <= rows.length; i++) {
    const key = (r?: { over: string[] }) => (r ? r.over.join('+') : ' ')
    if (key(rows[i]) !== key(rows[start])) {
      const over = rows[start]!.over
      out.push(
        `    rows ${start}-${i - 1} (${i - start}px): ${over.length > 0 ? over.join(', ') : 'nothing over the canvas'}`,
      )
      start = i
    }
  }
  return out
}

async function probe(
  name: string,
  slug: string,
  launchBrowser: () => Promise<Browser>,
) {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await navigateWithSessionSpec(page, spec)
    await waitForDisplayPaint(page, SELECTOR, 60000)
    await waitForDataLoaded(page, 60000)
    const info = await readPage(page)
    console.log(`\n=== ${name} ===`)
    if ('error' in info) {
      console.log(`  ${info.error}`)
      return
    }
    const el = await page.$(SELECTOR)
    // The harness path first, because the scroll the other one performs is
    // sticky and would contaminate everything read after it. `captureElementPng`
    // clips to the rect it measured and asserts the rect did not move, so this
    // line throwing IS the regression report for the fix.
    const fixed = Buffer.from(await captureElementPng(page, SELECTOR, slug))
    fs.writeFileSync(path.join(OUT, `${slug}.screenshot.png`), fixed)
    const afterFixed = await readPage(page)
    if (!('error' in afterFixed)) {
      console.log(
        `  harness capture: canvas cssTop ${info.canvas.cssTop} -> ` +
          `${afterFixed.canvas.cssTop} (${
            afterFixed.canvas.cssTop === info.canvas.cssTop
              ? 'UNCHANGED, which is the invariant'
              : 'MOVED — the fix is not holding'
          })`,
      )
    }

    // Now the unfixed path, kept so the probe still reproduces the artifact it
    // was written to attribute: puppeteer scrolls the element into view before
    // capturing, so the geometry that produced THIS capture is the one read
    // after it, not the one read above. A sticky header that only overlaps the
    // canvas once the page has scrolled is invisible to a before-reading.
    const shot = Buffer.from(await el!.screenshot())
    fs.writeFileSync(path.join(OUT, `${slug}.unfixed.png`), shot)
    const after = await readPage(page)

    console.log(`  canvas    ${JSON.stringify(info.canvas)}`)
    if (!('error' in after)) {
      console.log(
        `  after capture: canvas cssTop=${after.canvas.cssTop} scrollY=${after.scrollY}`,
      )
      for (const e of after.near) {
        const overlap = e.top + e.height - after.canvas.cssTop
        if (overlap > 0 && e.top < after.canvas.cssTop) {
          console.log(
            `    OVERLAPS the canvas by ${overlap}px: ${e.testid} (top=${e.top} h=${e.height})`,
          )
        }
      }
    }
    if (!('error' in after)) {
      console.log(`  what is painted over the canvas, per row:`)
      for (const line of attributionRuns(after.rows)) {
        console.log(line)
      }
      // Viewport only. Never fullPage: puppeteer resizes the viewport to
      // implement it, which invalidates the raster (jbrowse-web/CLAUDE.md).
      const pageShot = Buffer.from(await page.screenshot())
      fs.writeFileSync(path.join(OUT, `${slug}.viewport.png`), pageShot)
      const src = bestSourceOffset(shot, pageShot, after.canvas.cssLeft, 37)
      console.log(
        `  band rows 0-36 match viewport rows ${src.offset}-${src.offset + 36} ` +
          `at ${(src.diff * 100).toFixed(2)}% residual ` +
          `(canvas top is ${after.canvas.cssTop}, so the band is ` +
          `${after.canvas.cssTop - src.offset}px above where it belongs)`,
      )
    }
    if (info.dataUrl.startsWith('data:')) {
      const backing = Buffer.from(info.dataUrl.split(',')[1]!, 'base64')
      fs.writeFileSync(path.join(OUT, `${slug}.backing.png`), backing)
      console.log(
        `  backing store vs UNFIXED capture: ${hotRows(backing, shot)}`,
      )
      // The same comparison against the capture the suite now takes. The band
      // is the difference between these two lines.
      console.log(
        `  backing store vs harness capture: ${hotRows(backing, fixed)}`,
      )
    } else {
      console.log(`  backing store unreadable: ${info.dataUrl.slice(0, 100)}`)
    }
  } finally {
    await browser.close()
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const { server, port } = await startServerOnFreePort(3000)
  setPort(port)
  const chrome = (extra: string[]) => () =>
    launch({
      headless: true,
      args: ['--no-sandbox', ...extra],
      defaultViewport: { width: 1280, height: 800 },
    })
  try {
    await probe(
      'canvas2d (chrome, no gpu)',
      'canvas2d',
      chrome(['--disable-gpu']),
    )
    await probe(
      'webgl (chrome, swiftshader)',
      'webgl',
      chrome(['--use-gl=swiftshader', '--enable-unsafe-swiftshader']),
    )
    await probe('webgpu (firefox nightly)', 'webgpu', () =>
      launch({
        browser: 'firefox',
        executablePath: FIREFOX,
        headless: false,
        timeout: 60000,
        extraPrefsFirefox: {
          'dom.webgpu.enabled': true,
          'gfx.webrender.all': true,
          'gfx.webgpu.ignore-blocklist': true,
        },
        defaultViewport: { width: 1280, height: 800 },
      }),
    )
    console.log(`\nPNGs in ${OUT}`)
  } finally {
    server.close()
  }
}

await main()
