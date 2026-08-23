/* eslint-disable no-console */
// One-off probe (not a suite): read the MAF coverage band's depth-bar heights
// off the real app on BOTH backends, so the band's move onto render-core's
// shared GPU coverage passes can be checked against the Canvas2D painters it
// used to be the only user of.
//
// The two runs are separate browsers, because which backend a page uses is
// decided by Chrome's flags (`--disable-gpu` for canvas2d) and not by anything
// the page can be told afterwards.
//
//   node products/jbrowse-web/browser-tests/maf-coverage-probe.ts [outdir]
import fs from 'node:fs'
import path from 'node:path'

import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { PNG } from 'pngjs'
import { launch } from 'puppeteer'

import {
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
  waitForDisplayDrawn,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

const outDir = process.argv[2] ?? '/tmp/maf-coverage-probe'

// The shipped default height, so the band is the one the user gets: 45px of
// coverage above fitted rows.
const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-4000',
      tracks: [{ trackId: 'volvox_maf' }],
    },
  ],
}

const { server, port } = await startServerOnFreePort(3000)
setPort(port)
fs.mkdirSync(outDir, { recursive: true })

// Any pixel that is not the transparent/near-white page ground. The depth bars
// are the theme's grey and the SNP slices are the base colours, so "is there
// ink" is the question a first check wants, ahead of which colour it is.
function isInk(r: number, g: number, b: number, a: number) {
  return a > 32 && !(r > 245 && g > 245 && b > 245)
}

// Per screen column, the topmost inked row inside the band — i.e. the drawn bar
// height, measured from the band's top. `band` rows, so a column with no ink
// reports `band`.
function barTops(png: PNG, band: number) {
  const tops: number[] = []
  for (let x = 0; x < png.width; x++) {
    let top = band
    for (let y = 0; y < Math.min(band, png.height); y++) {
      const i = (png.width * y + x) * 4
      if (
        isInk(
          png.data[i]!,
          png.data[i + 1]!,
          png.data[i + 2]!,
          png.data[i + 3]!,
        )
      ) {
        top = y
        break
      }
    }
    tops.push(top)
  }
  return tops
}

async function run(backend: 'webgl' | 'canvas2d') {
  const browser = await launch({
    headless: true,
    args: [
      ...BASE_CHROME_ARGS,
      '--window-size=1400,900',
      ...(backend === 'canvas2d'
        ? ['--disable-gpu']
        : ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']),
    ],
    defaultViewport: { width: 1400, height: 900, deviceScaleFactor: 1 },
  })
  const page = await browser.newPage()
  await navigateWithSessionSpec(page, spec)
  await waitForDisplayDrawn(page, 'volvox_maf-LinearMafDisplay')
  await waitForDataLoaded(page)

  const geom = await page.evaluate(() => {
    const display = (
      window as unknown as {
        JBrowseSession: {
          views: { tracks: { displays: Record<string, unknown>[] }[] }[]
        }
      }
    ).JBrowseSession.views[0]!.tracks[0]!.displays[0]!
    return {
      coverageHeight: display.coverageHeight as number,
      rowsTopOffset: display.rowsTopOffset as number,
      rowsHeight: display.rowsHeight as number,
      hasBand: display.coverageBandState !== undefined,
      domainMax: (display.coverageDomain as number[] | undefined)?.[1],
    }
  })

  const box = (await (await page.$(
    '[data-display-id^="volvox_maf-LinearMafDisplay"]',
  ))!.boundingBox())!
  const file = path.join(outDir, `${backend}.png`)
  // A plain viewport screenshot, then crop. Neither of the two shortcuts works
  // here, and both fail by returning a confident blank rather than an error:
  // `clip` comes back entirely blank under `--disable-gpu` (display chrome and
  // all) while `getImageData` on the same canvas shows a quarter of a million
  // painted pixels, and `fullPage` resizes the viewport to do its job, so the
  // capture can return before the content re-rasters — it read the two backends
  // the wrong way round on consecutive runs. See the package CLAUDE.md.
  const full = PNG.sync.read(Buffer.from(await page.screenshot()))
  const png = new PNG({
    width: Math.round(box.width),
    height: Math.round(box.height),
  })
  PNG.bitblt(
    full,
    png,
    Math.round(box.x),
    Math.round(box.y),
    png.width,
    png.height,
    0,
    0,
  )
  fs.writeFileSync(file, PNG.sync.write(png))
  await browser.close()

  return { geom, tops: barTops(png, geom.coverageHeight), file }
}

const webgl = await run('webgl')
const canvas2d = await run('canvas2d')
await new Promise<void>(r => {
  server.close(() => {
    r()
  })
})

console.log('geometry:', JSON.stringify(webgl.geom))
for (const [name, r] of [
  ['webgl', webgl],
  ['canvas2d', canvas2d],
] as const) {
  const inked = r.tops.filter(t => t < r.geom.coverageHeight).length
  const shortest = Math.min(...r.tops)
  console.log(
    `${name}: ${inked}/${r.tops.length} columns inked, tallest bar top row ${shortest} of ${r.geom.coverageHeight} -> ${r.file}`,
  )
}

// The two backends' bar tops, column by column. They will not be identical —
// the Canvas2D painter carries a seam fudge the shader deliberately omits, and
// the two rasterize a sub-pixel edge differently — so this reports the spread
// rather than asserting equality.
const n = Math.min(webgl.tops.length, canvas2d.tops.length)
let worst = 0
let disagree = 0
for (let i = 0; i < n; i++) {
  const d = Math.abs(webgl.tops[i]! - canvas2d.tops[i]!)
  if (d > 0) {
    disagree++
  }
  worst = Math.max(worst, d)
}
console.log(
  `bar-top agreement over ${n} columns: ${n - disagree} exact, worst |delta| ${worst}px`,
)
