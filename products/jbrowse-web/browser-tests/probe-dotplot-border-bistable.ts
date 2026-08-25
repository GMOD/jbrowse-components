/* eslint-disable no-console */
import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { setPort } from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

// Does the dotplot settle to ONE layout, or two?
//
// `axisBorderPx`'s docstring argues the margins cannot feed back into layout
// because neither border reads its own axis's viewport dimension. That closes
// the direct path and leaves the CROSSED one open: `borderX` reads
// `vview.bpPerPx`, a fit-to-view vertical zoom comes off
// `viewHeight = height - borderY`, and `borderY` reads `hview.bpPerPx` which
// comes off `viewWidth = width - borderX`. If that loop is real it is also
// DISCRETE — `LABEL_PX = 12` decides whether a marginal region's label counts
// toward the margin at all — so it settles on one of two layouts rather than
// oscillating visibly.
//
// That is the shape the cross-backend gate reports on `dotplot-default`: a
// FIXED 4.26% drift (the distance between the two layouts, ~5px on every
// vertical gridline) about one run in thirty, identical on CI and locally.
//
// Reads the four numbers the loop is made of, once per fresh page load. Two
// distinct borderX/borderY values across N loads is the bug. One value N times
// is not proof of absence — only that the race is rarer than N.
//
//     node browser-tests/probe-dotplot-border-bistable.ts [loads]

const LOADS = Number(process.argv[2] ?? 12)

interface Reading {
  borderX: number
  borderY: number
  hBpPerPx: number
  vBpPerPx: number
  viewWidth: number
  viewHeight: number
}

const { server, port } = await startServerOnFreePort(3333)
setPort(port)

const browser = await launch({
  headless: true,
  protocolTimeout: 900000,
  args: [...BASE_CHROME_ARGS, '--window-size=1400,900'],
})

const readings: Reading[] = []
try {
  for (let i = 0; i < LOADS; i++) {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })
    await page.goto(
      `http://localhost:${port}/?config=test_data/config_dotplot.json&sessionName=Test%20Session`,
      { waitUntil: 'networkidle2', timeout: 60000 },
    )
    // Same signal the snapshot test waits on, so a reading always comes from a
    // view that has actually laid out and painted.
    await page
      .waitForSelector('[data-display-drawn="true"] canvas', { timeout: 60000 })
      .catch(() => {})
    const r = (await page.evaluate(() => {
      interface V {
        type?: string
        borderX?: number
        borderY?: number
        viewWidth?: number
        viewHeight?: number
        hview?: { bpPerPx?: number }
        vview?: { bpPerPx?: number }
      }
      const views = (window as unknown as { JBrowseSession?: { views?: V[] } })
        .JBrowseSession?.views
      const d = views?.find(v => v.type === 'DotplotView')
      return d
        ? {
            borderX: d.borderX,
            borderY: d.borderY,
            hBpPerPx: d.hview?.bpPerPx,
            vBpPerPx: d.vview?.bpPerPx,
            viewWidth: d.viewWidth,
            viewHeight: d.viewHeight,
          }
        : undefined
    })) as Reading | undefined
    await page.close()
    if (r) {
      readings.push(r)
      console.log(
        `load ${i + 1}: borderX=${r.borderX} borderY=${r.borderY} ` +
          `hBpPerPx=${r.hBpPerPx} vBpPerPx=${r.vBpPerPx} ` +
          `viewWidth=${r.viewWidth} viewHeight=${r.viewHeight}`,
      )
    } else {
      console.log(`load ${i + 1}: no DotplotView on the page`)
    }
  }
} finally {
  await browser.close()
  server.close()
}

console.log('')
for (const k of [
  'borderX',
  'borderY',
  'hBpPerPx',
  'vBpPerPx',
  'viewWidth',
  'viewHeight',
] as const) {
  const vals = [...new Set(readings.map(r => r[k]))]
  console.log(
    `${k}: ${vals.length} distinct value(s) over ${readings.length} load(s) — ${vals.join(' | ')}`,
  )
}
