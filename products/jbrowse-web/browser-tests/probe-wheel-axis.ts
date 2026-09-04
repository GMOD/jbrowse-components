// Each wheel handler takes the gesture whose dominant axis is its own. jsdom
// pins both halves of that rule (`wheelZoom.test.ts`,
// `useVirtualScrollWheel.test.tsx`), but not the composition it exists for:
// that the pileup's panel really is a descendant of the element the view binds
// to, and that what it consumes really does reach the view marked
// `defaultPrevented`. Two listeners, one event, real layout — this is what only
// a browser answers.
//
// Wheels a diagonal over a pileup and prints what moved. What it printed on
// 2026-09-04, against a pileup shrunk until its reads overflow:
//
//     pileup scrollable by 229px
//     vertical swipe (noisy)   dx=  6 dy= 60  →  view panned   0px, reads scrolled 189px
//     sideways swipe (noisy)   dx= 60 dy=  6  →  view panned 360px, reads scrolled   0px
//
// Both zeros are the point, and each comes from a different half of the rule:
// the view declining what the panel consumed, and the panel declining a swipe
// that is the view's. A build without either scrolls the reads AND pans the
// genome on the same swipe.
//
// A probe, not a suite: nothing runs it.
//
//     node browser-tests/probe-wheel-axis.ts
//     PORT=3001 HEADLESS=0 node browser-tests/probe-wheel-axis.ts

import puppeteer from 'puppeteer'

import { findDisplayPainted, setPort } from './helpers.ts'

const PORT = Number(process.env.PORT || 3000)
setPort(PORT)
const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_alignments'],
    },
  ],
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

// deltas one wheel event of each gesture carries: a trackpad puts noise on the
// axis it is not swiping along, which is the whole subject here
const GESTURES = [
  { name: 'vertical swipe (noisy)', deltaY: 60, deltaX: 6 },
  { name: 'sideways swipe (noisy)', deltaY: 6, deltaX: 60 },
]

async function main() {
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS !== '0',
    args: ['--no-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  })
  const page = await browser.newPage()
  const url = `http://localhost:${PORT}/?config=test_data/volvox/config.json&session=${encodeURIComponent(`spec-${JSON.stringify(spec)}`)}&sessionName=WheelAxis`
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 })
  await findDisplayPainted(page, 'pileup-display', 90000)
  await delay(3000)

  // The rule only means anything over a panel that can actually scroll, and a
  // full-height volvox pileup fits its track — so shrink the display until the
  // reads overflow it, which is the state a real alignments track is in.
  const scrollableHeight = await page.evaluate(() => {
    const display = (window as any).JBrowseRootModel.session.views[0].tracks[0]
      .displays[0]
    display.setHeight(120)
    return display.scrollableHeight
  })
  await delay(2000)
  console.log(`pileup scrollable by ${scrollableHeight}px`)

  for (const gesture of GESTURES) {
    const result = await page.evaluate(async g => {
      const root = (window as any).JBrowseRootModel
      const view = root.session.views[0]
      const display = view.tracks[0].displays[0]
      // reset between gestures, and past the latch's gesture-continuity window
      // so each one is measured as a fresh gesture rather than a continuation
      display.setScrollTop(40)
      await new Promise(r => setTimeout(r, 400))
      const before = { offsetPx: view.offsetPx, scrollTop: display.scrollTop }

      const canvas = document.querySelector(
        '[data-testid="pileup-display"] canvas',
      )!
      const box = canvas.getBoundingClientRect()
      const target = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      )!
      // one gesture is a burst of events, and both handlers coalesce their
      // writes to one per frame, so a single event would measure a frame's
      // rounding rather than the rule
      for (let i = 0; i < 6; i++) {
        target.dispatchEvent(
          new WheelEvent('wheel', {
            deltaX: g.deltaX,
            deltaY: g.deltaY,
            bubbles: true,
            cancelable: true,
          }),
        )
        await new Promise(r =>
          requestAnimationFrame(() => {
            r(undefined)
          }),
        )
      }
      await new Promise(r => setTimeout(r, 300))
      return {
        panned: view.offsetPx - before.offsetPx,
        scrolled: display.scrollTop - before.scrollTop,
      }
    }, gesture)
    console.log(
      `${gesture.name.padEnd(24)} dx=${String(gesture.deltaX).padStart(3)} dy=${String(gesture.deltaY).padStart(3)}  →  view panned ${result.panned}px, reads scrolled ${result.scrolled}px`,
    )
  }

  await browser.close()
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
