/* eslint-disable no-console */
// Measures how much of a point mark's glyph reaches the canvas, for the report
// that one at the autoscaled domain's maximum draws half-clipped.
//
// It reads the canvas back rather than looking at a picture: the same data with
// the max pinned above it is the control, so the two numbers answer "is the
// glyph cut" without a golden. Against the shipping build it printed 2 ink rows
// of a 4 px glyph autoscaled and 4 with the max pinned to 2000.
//
//     pnpm --filter @jbrowse/web build
//     node browser-tests/probe-mark-clip.ts
//
// Canvas2D only — `getImageData` is what does the measuring, so it reads the
// fallback painter, which is the path the cross-backend gate holds the shader
// against.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { launch } from 'puppeteer'

import {
  delay,
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

const OUT = process.env.OUT ?? '/tmp/shots'
mkdirSync(OUT, { recursive: true })

async function inkRows(page: any) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-display-id^="marks_points"]')!
    const canvas = root.querySelector('canvas')!
    const w = canvas.width
    const h = canvas.height
    const dpr = h / Number.parseFloat(canvas.style.height)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    let data: Uint8ClampedArray | undefined
    try {
      data = ctx!.getImageData(0, 0, w, h).data
    } catch {
      return { error: 'no 2d context' }
    }
    const rows: number[] = []
    for (let y = 0; y < h; y++) {
      let n = 0
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3]! > 0) n++
      }
      if (n > 0) rows.push(y)
    }
    return {
      cssHeight: canvas.style.height,
      deviceHeight: h,
      dpr,
      firstInkRow: rows[0],
      lastInkRow: rows.at(-1),
      inkRowCount: rows.length,
    }
  })
}

async function main() {
  const { server, port } = await startServerOnFreePort(3333)
  setPort(port)
  const browser = await launch({
    headless: true,
    args: ['--no-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  })
  const page = await browser.newPage()
  await navigateWithSessionSpec(
    page,
    {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['marks_points'],
        },
      ],
    },
    'test_data/volvox/config_marks.json',
  )
  await waitForDataLoaded(page, 120000)
  await delay(2500)
  console.log(
    'autoscaled (data max == domain max):',
    JSON.stringify(await inkRows(page)),
  )
  const el = await page.$('[data-display-id^="marks_points"]')
  await el!.screenshot({ path: join(OUT, 'points-autoscale.png') })

  await page.evaluate(() => {
    const d = (window as any).JBrowseSession.views[0].tracks[0].displays[0]
    d.setMaxScore(2000)
  })
  await delay(2500)
  console.log(
    'max pinned to 2000 (mark well inside):',
    JSON.stringify(await inkRows(page)),
  )
  await el!.screenshot({ path: join(OUT, 'points-max2000.png') })

  await browser.close()
  server.close()
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
