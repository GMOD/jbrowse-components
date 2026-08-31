/* eslint-disable no-console */
// Does MAF's GPU path still paint the honest amount of ink when every cell is
// sub-pixel? Backs `agent-docs/measurements/maf-subpixel-floor.json`.
//
// The trick that makes "honest" a number rather than an argument: shoot the
// SAME renderer at deviceScaleFactor 4, where a 1-bp cell is over a device
// pixel and nothing is lost to the rasteriser, and box-downsample by 4. That is
// the base-weighted mix a dpr-1 pixel should hold, computed by the renderer
// under test instead of assumed from the Canvas2D fallback — which turns out to
// over-paint (`agent-docs/ideas/maf-canvas2d-overpaints-the-match-tone.md`).
//
// A min-width floor shows up here as ink the truth does not have: cells widened
// to a whole pixel overwrite their neighbours instead of blending with them.
//
//   node products/jbrowse-web/browser-tests/probe-maf-subpixel.ts <outdir>
import fs from 'node:fs'
import path from 'node:path'

import {
  BASE_CHROME_ARGS,
  encodeSessionSpec,
} from '@jbrowse/browser-test-utils'
import { PNG } from 'pngjs'
import { launch } from 'puppeteer'

import {
  delay,
  navigateToUrl,
  setPort,
  waitForDataLoaded,
  waitForDisplayDrawn,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

import type { Page } from 'puppeteer'

const outDir = process.argv[2] ?? 'maf-subpixel-out'
fs.mkdirSync(outDir, { recursive: true })

const DISPLAY_ID = 'volvox_maf-LinearMafDisplay'
const DISPLAY = `[data-display-id^="${DISPLAY_ID}"]`
const TRUTH_DPR = 4

// The MAF suite's own locus and track, pinned tall enough that all ten species
// are on screen. ~3.25 bp/px, where subPixelBinBp is 1, so both backends walk
// every base and a 1-bp cell is 0.31 CSS px.
const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-4000',
      tracks: [
        {
          trackId: 'volvox_maf',
          displaySnapshot: {
            type: 'LinearMafDisplay',
            rowHeight: 15,
            height: 200,
          },
        },
      ],
    },
  ],
}

interface Geometry {
  rowsTopOffset: number
  rowsHeight: number
  canvasOffsetInShot: number
  glRenderer: string
  dpr: number
}

function readGeometry(page: Page) {
  return page.evaluate((sel: string): Geometry => {
    const display = (
      window as unknown as {
        JBrowseSession: {
          views: { tracks: { displays: Record<string, number>[] }[] }[]
        }
      }
    ).JBrowseSession.views[0]!.tracks[0]!.displays[0]!
    const el = document.querySelector(sel)!
    const canvas = el.querySelector('canvas')!
    const probe = document.createElement('canvas')
    const gl = probe.getContext('webgl2')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    return {
      rowsTopOffset: display.rowsTopOffset!,
      rowsHeight: display.rowsHeight!,
      canvasOffsetInShot:
        canvas.getBoundingClientRect().top - el.getBoundingClientRect().top,
      glRenderer:
        gl && ext
          ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
          : 'unknown',
      dpr: window.devicePixelRatio,
    }
  }, DISPLAY)
}

const { server, port } = await startServerOnFreePort(3000)
setPort(port)

const shots = [
  { name: 'webgl-dpr1', renderer: 'webgl', dpr: 1 },
  { name: 'webgl-dpr2', renderer: 'webgl', dpr: 2 },
  { name: 'webgl-dpr4', renderer: 'webgl', dpr: TRUTH_DPR },
  { name: 'canvas2d-dpr1', renderer: 'canvas2d', dpr: 1 },
]

const meta: Record<string, Geometry & { file: string }> = {}

for (const shot of shots) {
  const browser = await launch({
    headless: true,
    args: [...BASE_CHROME_ARGS, '--use-gl=angle', '--window-size=1400,900'],
    defaultViewport: {
      width: 1400,
      height: 900,
      deviceScaleFactor: shot.dpr,
    },
  })
  const page = await browser.newPage()
  const params = [
    'config=test_data/volvox/config.json',
    `session=${encodeSessionSpec(spec)}`,
    'sessionName=Maf%20Subpixel',
    `renderer=${shot.renderer}`,
  ].join('&')
  console.log(`capturing ${shot.name}`)
  await navigateToUrl(page, params)
  await waitForDisplayDrawn(page, DISPLAY_ID, 180000)
  await waitForDataLoaded(page, 180000)
  await delay(4000)
  const el = await page.waitForSelector(DISPLAY)
  const file = path.join(outDir, `${shot.name}.png`)
  await el!.screenshot({ path: file })
  meta[shot.name] = { ...(await readGeometry(page)), file }
  await browser.close()
}

await new Promise<void>(resolve => {
  server.close(() => {
    resolve()
  })
})

// The rows band only — the coverage strip above it is not what is under test.
function rowsBand(key: string) {
  const m = meta[key]!
  const png = PNG.sync.read(fs.readFileSync(m.file))
  const rowsTop = m.canvasOffsetInShot + m.rowsTopOffset
  const top = Math.round(rowsTop * m.dpr)
  const bottom = Math.min(
    png.height,
    Math.round((rowsTop + m.rowsHeight) * m.dpr),
  )
  const out = new PNG({ width: png.width, height: bottom - top })
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < png.width; x++) {
      for (let c = 0; c < 4; c++) {
        out.data[(out.width * y + x) * 4 + c] =
          png.data[(png.width * (y + top) + x) * 4 + c]!
      }
    }
  }
  return out
}

function boxDownsample(png: PNG, factor: number) {
  const w = Math.floor(png.width / factor)
  const h = Math.floor(png.height / factor)
  const out = new PNG({ width: w, height: h })
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0
        for (let dy = 0; dy < factor; dy++) {
          for (let dx = 0; dx < factor; dx++) {
            sum +=
              png.data[
                (png.width * (y * factor + dy) + x * factor + dx) * 4 + c
              ]!
          }
        }
        out.data[(w * y + x) * 4 + c] = Math.round(sum / (factor * factor))
      }
    }
  }
  return out
}

// Chroma is max(r,g,b) - min(r,g,b). The match tone is neutral grey and the gap
// tone near-neutral, so this reads how much MISMATCH ink the band carries —
// which is what a floor inflates.
function meanChroma(png: PNG) {
  let total = 0
  const n = png.width * png.height
  for (let i = 0; i < n; i++) {
    const r = png.data[i * 4]!
    const g = png.data[i * 4 + 1]!
    const b = png.data[i * 4 + 2]!
    total += Math.max(r, g, b) - Math.min(r, g, b)
  }
  return total / n
}

function compare(a: PNG, b: PNG) {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`,
    )
  }
  let sum = 0
  let differing = 0
  const n = a.width * a.height
  for (let i = 0; i < n; i++) {
    const d =
      Math.abs(a.data[i * 4]! - b.data[i * 4]!) +
      Math.abs(a.data[i * 4 + 1]! - b.data[i * 4 + 1]!) +
      Math.abs(a.data[i * 4 + 2]! - b.data[i * 4 + 2]!)
    sum += d / 3
    if (d > 30) {
      differing++
    }
  }
  return {
    meanAbsDiff: +(sum / n).toFixed(2),
    pctDiffering: +((differing / n) * 100).toFixed(1),
  }
}

const truth = boxDownsample(rowsBand('webgl-dpr4'), TRUTH_DPR)
fs.writeFileSync(
  path.join(outDir, 'truth-downsampled-to-dpr1.png'),
  PNG.sync.write(truth),
)

const gpu1 = rowsBand('webgl-dpr1')
const canvas1 = rowsBand('canvas2d-dpr1')
const gpu2 = boxDownsample(rowsBand('webgl-dpr2'), 2)

const report = {
  glRenderer: meta['webgl-dpr1']!.glRenderer,
  truthChroma: +meanChroma(truth).toFixed(2),
  gpu: {
    ...compare(gpu1, truth),
    chroma: +meanChroma(gpu1).toFixed(2),
    dprDrift: compare(gpu1, gpu2).meanAbsDiff,
  },
  canvas2d: {
    ...compare(canvas1, truth),
    chroma: +meanChroma(canvas1).toFixed(2),
  },
}

fs.writeFileSync(
  path.join(outDir, 'report.json'),
  JSON.stringify({ report, meta }, null, 2),
)
console.log(JSON.stringify(report, null, 2))
