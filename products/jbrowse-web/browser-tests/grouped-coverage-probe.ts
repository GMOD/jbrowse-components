/* eslint-disable no-console */
// One-off probe (not a suite): group volvox-simple-inv.bam by split read and
// read each lane's drawn coverage bar height off the real app beside that
// lane's own depth array. A grouped lane drawing another lane's depth is the
// bug the shared coverage marks had when they keyed their draw off the block
// rather than the section (sectionCoverageDraw.test.ts is the unit-level twin).
//
//   node products/jbrowse-web/browser-tests/grouped-coverage-probe.ts <outdir> [port]
//   BACKEND=canvas2d ... to compare the Canvas2D painter
//
// `drawnBarPx` counts non-white pixels, so a gridline column reads as a full
// bar; read the per-column color dump for the truth when a value looks off.
import fs from 'node:fs'
import path from 'node:path'

import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { PNG } from 'pngjs'
import { launch } from 'puppeteer'

import {
  findByTestId,
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
} from './helpers.ts'
import { snapshotConfig } from './snapshot.ts'

if (process.env.BACKEND) {
  snapshotConfig.backend = process.env.BACKEND
}

const outDir = process.argv[2] ?? '/tmp/groupby-pixels'
setPort(Number(process.argv[3] ?? 3123))
fs.mkdirSync(outDir, { recursive: true })
const browser = await launch({
  headless: true,
  args: [...BASE_CHROME_ARGS, '--window-size=1400,1000'],
  defaultViewport: { width: 1400, height: 1000 },
})
try {
  const page = await browser.newPage()
  page.on('console', m => {
    if (/GPU|backend|renderer/i.test(m.text())) {
      console.log('[browser]', m.text().slice(0, 160))
    }
  })
  await navigateWithSessionSpec(page, {
    views: [
      {
        type: 'LinearGenomeView',
        loc: 'ctgA:18000..22000',
        assembly: 'volvox',
        tracks: ['volvox-simple-inv.bam'],
      },
    ],
  })
  await findByTestId(page, 'pileup-display', 120000)
  await waitForDataLoaded(page, 120000)
  await page.evaluate(() => {
    const display = (window as any).JBrowseSession.views[0].tracks[0]
      .displays[0]
    display.setGroupBy({ type: 'splitRead' })
  })
  await page.waitForFunction(
    () =>
      (window as any).JBrowseSession.views[0].tracks[0].displays[0].groupOrder
        .length === 2,
    { timeout: 60000, polling: 250 },
  )
  await waitForDataLoaded(page, 120000)
  await new Promise(r => setTimeout(r, 4000))

  const bps = [18200, 18800, 19200, 19500, 19800, 20300, 21000, 21500, 22500]
  const info = await page.evaluate(bps => {
    const view = (window as any).JBrowseSession.views[0]
    const display = view.tracks[0].displays[0]
    const canvas = document.querySelector(
      '[data-testid="pileup-display"] canvas',
    ) as HTMLCanvasElement
    const rect = canvas.getBoundingClientRect()
    const cols = bps.map(bp => {
      const px = view.bpToPx({ refName: 'ctgA', coord: bp })
      return { bp, x: Math.round(px.offsetPx - view.offsetPx) }
    })
    const lanes = display.sections.sections.map((s: any) => {
      const data = display.laidOutByGroup.get(s.groupKey).get(0)
      return {
        groupKey: s.groupKey,
        coverageTop: s.coverageTop,
        coverageHeight: s.coverageHeight,
        pileupTop: s.pileupTop,
        depths: bps.map(bp => {
          const i = bp - data.coverageStartPos
          return i >= 0 && i < data.coverageDepths.length
            ? data.coverageDepths[i]
            : null
        }),
      }
    })
    return {
      canvasRect: { w: rect.width, h: rect.height, top: rect.top },
      canvasSize: { w: canvas.width, h: canvas.height },
      coverageDomain: display.coverageDomain,
      cols,
      lanes,
    }
  }, bps)
  const el = await page.$('[data-testid="pileup-display"] canvas')
  const shot = (await el!.screenshot()) as Buffer
  fs.writeFileSync(path.join(outDir, 'canvas.png'), shot)
  const png = PNG.sync.read(shot)
  const scale = png.width / info.canvasRect.w
  const nonWhite = (x: number, y: number) => {
    const i = (png.width * y + x) * 4
    const r = png.data[i]!
    const g = png.data[i + 1]!
    const b = png.data[i + 2]!
    return r < 245 || g < 245 || b < 245
  }
  console.log(JSON.stringify({ ...info, scale }, null, 1))
  for (const lane of info.lanes) {
    const y0 = Math.round(lane.coverageTop * scale)
    const y1 = Math.round((lane.coverageTop + lane.coverageHeight) * scale)
    const rows: string[] = []
    info.cols.forEach((c: any, k: number) => {
      const x = Math.round(c.x * scale)
      let count = 0
      for (let y = y0; y < y1; y++) {
        if (nonWhite(x, y)) {
          count++
        }
      }
      rows.push(
        `bp=${c.bp} x=${c.x} drawnBarPx=${(count / scale).toFixed(1)} ownDepth=${lane.depths[k]}`,
      )
    })
    console.log(
      `lane ${lane.groupKey} band y=${lane.coverageTop}..${lane.coverageTop + lane.coverageHeight}`,
    )
    console.log(rows.join('\n'))
  }
} finally {
  await browser.close()
}
