// How often does a targeted capture come back blank, per capture path?
//
// The blank-capture thread (agent-docs/reference/CROSS_BACKEND_GATE.md, "The
// blank captures are the CAPTURE, not the render") established that the canvas
// holds content while the screenshot does not, and that no amount of additional
// app-level waiting fixes it. This is the missing half: the wait that does.
//
// `el.screenshot()` calls `scrollIntoViewIfNeeded` first, which asks an
// IntersectionObserver whether the element is fully visible. The spec queues an
// observer's callback inside update-the-rendering, so awaiting one guarantees a
// frame has been produced — and puppeteer was paying for that barrier without
// meaning to. `captureElementPng` drops the scroll (see snapshot.ts) and so has
// to ask for the barrier on purpose.
//
// Three paths, alternating on one settled page so nothing about the app differs
// between them, counting blanks by the predicate `assertNonBlank` uses.
// Measured 2026-08-26 on canvas2d, N=15 then N=25:
//
//   el.screenshot (puppeteer's own barrier)   3/15, 0/25 blank
//   clip, no barrier                          5/15, 6/25 blank
//   clip, IntersectionObserver barrier        0/15, 0/25 blank
//
//     node browser-tests/probe-capture-barrier.ts
//     N=40 node browser-tests/probe-capture-barrier.ts
import { Buffer } from 'node:buffer'

import { displayPainted } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { analyzeCanvasPng } from './canvasContent.ts'
import {
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
  waitForDisplayPaint,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'
import { waitForRenderedFrame } from './snapshot.ts'

import type { Page } from 'puppeteer'

const SELECTOR = `${displayPainted('pileup-display')} canvas`
const N = Number(process.env.N ?? 15)

const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1000-2000',
      tracks: [
        {
          trackId: 'volvox_alignments',
          displaySnapshot: { colorBy: { type: 'strand' } },
        },
      ],
    },
  ],
}

const clipOf = (page: Page) =>
  page.evaluate(sel => {
    const r = document.querySelector(sel)!.getBoundingClientRect()
    const vv = window.visualViewport
    return {
      x: r.x + (vv?.pageLeft ?? window.scrollX),
      y: r.y + (vv?.pageTop ?? window.scrollY),
      width: r.width,
      height: r.height,
    }
  }, SELECTOR)

const paths: Record<string, (page: Page) => Promise<Uint8Array>> = {
  'el.screenshot (puppeteer barrier)': async page => {
    const el = (await page.$(SELECTOR))!
    return el.screenshot({ type: 'png' })
  },
  'clip, no barrier': async page =>
    page.screenshot({ type: 'png', clip: await clipOf(page) }),
  'clip, IntersectionObserver barrier': async page => {
    const clip = await clipOf(page)
    await waitForRenderedFrame(page, SELECTOR)
    return page.screenshot({ type: 'png', clip })
  },
}

const { server, port } = await startServerOnFreePort(3000)
setPort(port)
const browser = await launch({
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1280, height: 800 },
})
try {
  const page = await browser.newPage()
  await navigateWithSessionSpec(page, spec)
  await waitForDisplayPaint(page, SELECTOR, 60000)
  await waitForDataLoaded(page, 60000)

  const blanks = Object.fromEntries(Object.keys(paths).map(k => [k, 0]))
  for (let i = 0; i < N; i++) {
    for (const [name, take] of Object.entries(paths)) {
      const analysis = analyzeCanvasPng(Buffer.from(await take(page)))
      if (analysis.distinctColors < 3 || analysis.nonBgFraction < 0.0005) {
        blanks[name]!++
      }
    }
  }
  for (const [name, n] of Object.entries(blanks)) {
    console.log(`${name}: ${n}/${N} blank`)
  }
} finally {
  await browser.close()
  server.close()
}
