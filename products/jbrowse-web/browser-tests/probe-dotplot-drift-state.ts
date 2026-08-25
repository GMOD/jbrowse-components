/* eslint-disable no-console */
import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { comparePngBuffers } from './pngDiff.ts'
import { startServerOnFreePort } from './server.ts'

import type { Browser } from 'puppeteer'

// Ties the cross-backend dotplot drift to model state, in the run where it
// happens.
//
// The gate reports a FIXED 4.26% canvas2d-vs-webgl drift on `dotplot-default`
// about one run in thirty, identical on CI and locally, and the diff is every
// vertical gridline moved 5px with no row displaced at all. Layout is ruled out:
// `probe-dotplot-border-bistable.ts` reads borderX/borderY/bpPerPx/viewWidth
// identical to the last digit over 14 loads, so the box the canvas draws into
// does not move. That leaves the drawing's own x mapping.
//
// So capture BOTH backends per iteration, diff the canvas, and dump the model
// state from each side of the SAME iteration. Then:
//
//   pixels differ, state matches  -> a stale/pre-final frame reached the capture
//   pixels differ, state differs  -> the named field is the bistable one
//
// Reads offsetPx alongside bpPerPx, which the border probe omitted and which is
// the remaining input to the x mapping.
//
// WHAT IT FOUND, and the caveat that matters if you re-run it: it catches a
// 23.4% event where the webgl canvas reports 0x0@0,0 with a full backing store,
// state identical on both sides. That is a REAL hole — see the layout-box guard
// in snapshot.ts — but it is NOT the gate's 4.26% drift, because this probe
// waits on the attribute alone where the suite also waits on
// waitForDisplayPaint + waitForDataLoaded. Catching the 4.26% event with state
// attached needs those same waits here; the drift survives phase=ready, and the
// suite's own self-report puts it on the capture/compositing side ("canvas
// 1210x542 HAS content (58634b) while the screenshot is blank").
//
//     node browser-tests/probe-dotplot-drift-state.ts [iterations]

const ITERATIONS = Number(process.argv[2] ?? 30)
const { server, port } = await startServerOnFreePort(3333)
const browser = await launch({
  headless: true,
  protocolTimeout: 900000,
  args: [...BASE_CHROME_ARGS, '--window-size=1400,900'],
})

function readState() {
  interface Axis {
    bpPerPx?: number
    offsetPx?: number
    displayedRegions?: { refName: string; start: number; end: number }[]
    dynamicBlocks?: { totalWidthPx?: number }
  }
  interface V {
    type?: string
    borderX?: number
    borderY?: number
    viewWidth?: number
    viewHeight?: number
    hview?: Axis
    vview?: Axis
  }
  const d = (
    window as unknown as { JBrowseSession?: { views?: V[] } }
  ).JBrowseSession?.views?.find(v => v.type === 'DotplotView')
  if (!d) {
    return undefined
  }
  const axis = (a?: Axis) => ({
    bpPerPx: a?.bpPerPx,
    offsetPx: a?.offsetPx,
    nRegions: a?.displayedRegions?.length,
    totalBp: a?.displayedRegions?.reduce((s, r) => s + (r.end - r.start), 0),
  })
  return {
    borderX: d.borderX,
    borderY: d.borderY,
    viewWidth: d.viewWidth,
    viewHeight: d.viewHeight,
    h: axis(d.hview),
    v: axis(d.vview),
  }
}

async function capture(browser: Browser, backend: string) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(
    `http://localhost:${port}/?config=test_data/config_dotplot.json` +
      `&sessionName=Test%20Session&renderer=${backend}`,
    { waitUntil: 'networkidle2', timeout: 60000 },
  )
  // The dotplot's painted element IS the canvas — no child canvas — so the
  // suffix every LGV display needs would match nothing here.
  const el = await page.waitForSelector(
    '[data-testid="dotplot_webgl_canvas"][data-display-drawn="true"]',
    { timeout: 90000 },
  )
  const png = await el!.screenshot()
  const state = await page.evaluate(readState)
  const cssSize = await el!.evaluate(n => {
    const r = n.getBoundingClientRect()
    const c = n as HTMLCanvasElement
    return {
      rect: `${r.width}x${r.height}@${r.x},${r.y}`,
      attr: `${c.width}x${c.height}`,
    }
  })
  await page.close()
  return { png, state, cssSize }
}

let drifted = 0
try {
  for (let i = 0; i < ITERATIONS; i++) {
    const a = await capture(browser, 'canvas2d')
    const b = await capture(browser, 'webgl')
    const d = comparePngBuffers(a.png, b.png)
    const pct = (d.diffFraction * 100).toFixed(2)
    const same = JSON.stringify(a.state) === JSON.stringify(b.state)
    const flag = d.diffFraction > 0.015 ? 'DRIFT' : 'ok   '
    console.log(
      `iter ${String(i + 1).padStart(2)} ${flag} ${pct}%  state ${same ? 'MATCH' : 'DIFFER'}` +
        `  canvas2d ${a.cssSize.rect} attr ${a.cssSize.attr}` +
        `  webgl ${b.cssSize.rect} attr ${b.cssSize.attr}`,
    )
    if (d.diffFraction > 0.015) {
      drifted++
      console.log('  canvas2d state:', JSON.stringify(a.state))
      console.log('  webgl    state:', JSON.stringify(b.state))
      if (!same) {
        console.log('  >>> model state differs — that is the bistable input')
      } else {
        console.log(
          '  >>> model state identical, so the pixels came from a frame the model had already left',
        )
      }
      break
    }
  }
} finally {
  await browser.close()
  server.close()
}
console.log(`\n${drifted} drifting iteration(s)`)
