/* eslint-disable no-console */
// Capture the multi-sample variant display, both layouts, a dense and a sparse
// cohort, on one rendering rung at one dpr: the instrument for "did the cells
// land on the device grid" after the display dropped to one sample.
//
//     pnpm --filter @jbrowse/web build
//     node browser-tests/probe-variant-device-grid.ts --backend=webgl --dpr=1.5 --out=/tmp/shots/after-webgl-1.5
//     node browser-tests/probe-variant-device-grid.ts --diff /tmp/shots/before-webgl-1.5 /tmp/shots/after-webgl-1.5
//
// Run the same file against another build by copying it into that checkout's
// browser-tests: the server serves the build beside the script.
//
// TRAPS
//
//  - **WebGPU needs Firefox Nightly, headed.** `?renderer=` pins the ladder, so
//    a fallback fails loudly; the "WebGPU device ready" line corroborates.
//    Chrome WebGPU on this box is blank or SwiftShader.
//  - **webgl takes `--use-gl=angle`.** Headless Chrome otherwise picks
//    SwiftShader, not the GPU.
//  - **`layout.css.devPixelsPerPx` is a STRING pref.** A number makes Firefox
//    exit 0 before any page loads.
//  - The capture is the display element's screenshot, so it holds the DOM
//    overlays (row separators, connector lines) drawn over the canvas.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { PNG } from 'pngjs'
import { launch } from 'puppeteer'

import {
  delay,
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'
import { snapshotConfig } from './snapshot.ts'

import type { Page } from 'puppeteer'

const FIREFOX = process.env.FIREFOX_NIGHTLY_PATH ?? '/usr/bin/firefox-nightly'
const arg = (name: string) => {
  const found = process.argv.find(a => a.startsWith(`--${name}=`))
  return found?.slice(name.length + 3)
}
const OUT = arg('out')
const DPR = Number(arg('dpr') ?? 1)
const BACKEND = (arg('backend') ?? 'webgl') as 'webgl' | 'webgpu' | 'canvas2d'
// One scene per run: a headed Firefox reused across navigations stalled on
// its second scene's waits here.
const ONLY = arg('scene')

const DENSE = {
  config: 'test_data/config_demo.json',
  assembly: 'hg19',
  loc: '1:155,000,000-155,050,000',
  trackId: '1000g_chr1_snpeff_consequence',
}
const SPARSE = {
  config: 'test_data/volvox/config.json',
  assembly: 'volvox',
  loc: 'ctgA:1-50,000',
  trackId: 'volvox multi-sample sv',
}
const SCENES = [
  { name: 'dense-genomic', ...DENSE, layout: 'genomic' },
  { name: 'dense-matrix', ...DENSE, layout: 'columns' },
  { name: 'sparse-genomic', ...SPARSE, layout: 'genomic' },
  { name: 'sparse-matrix', ...SPARSE, layout: 'columns' },
] as const

function readPng(buf: Uint8Array) {
  // @ts-expect-error pngjs accepts a Uint8Array at runtime
  return PNG.sync.read(buf)
}

// Nearest-neighbour, so a one-device-pixel seam stays one block wide.
function writeZoom(src: Uint8Array, out: string, x: number, y: number) {
  const p = readPng(src)
  const w = Math.min(160, p.width - x)
  const h = Math.min(100, p.height - y)
  const scale = 6
  const z = new PNG({ width: w * scale, height: h * scale })
  for (let dy = 0; dy < h * scale; dy++) {
    for (let dx = 0; dx < w * scale; dx++) {
      const si =
        ((y + Math.floor(dy / scale)) * p.width + x + Math.floor(dx / scale)) *
        4
      const di = (dy * z.width + dx) * 4
      for (let c = 0; c < 4; c++) {
        z.data[di + c] = p.data[si + c]!
      }
    }
  }
  writeFileSync(out, PNG.sync.write(z))
}

// Pixels whose color is neither of its left/right neighbours nor of its
// up/down ones: a seam or a blended edge between two flat cells. Counted per
// axis, since x and y snapped in separate changes.
function blendStats(buf: Uint8Array) {
  const p = readPng(buf)
  const at = (x: number, y: number) => {
    const i = (y * p.width + x) * 4
    return (p.data[i]! << 16) | (p.data[i + 1]! << 8) | p.data[i + 2]!
  }
  let xBlend = 0
  let yBlend = 0
  const colors = new Set<number>()
  for (let y = 1; y < p.height - 1; y++) {
    for (let x = 1; x < p.width - 1; x++) {
      const c = at(x, y)
      colors.add(c)
      const l = at(x - 1, y)
      const r = at(x + 1, y)
      const u = at(x, y - 1)
      const d = at(x, y + 1)
      if (l !== r && c !== l && c !== r && u === c && d === c) {
        xBlend++
      }
      if (u !== d && c !== u && c !== d && l === c && r === c) {
        yBlend++
      }
    }
  }
  return { xBlend, yBlend, colors: colors.size, w: p.width, h: p.height }
}

function runDiff(dirA: string, dirB: string) {
  for (const name of readdirSync(dirA)
    .filter(f => f.endsWith('.png') && !f.endsWith('.zoom.png'))
    .sort()) {
    const a = readPng(readFileSync(join(dirA, name)))
    const b = readPng(readFileSync(join(dirB, name)))
    if (a.width !== b.width || a.height !== b.height) {
      console.log(
        `${name}: size ${a.width}x${a.height} vs ${b.width}x${b.height}`,
      )
      continue
    }
    let differing = 0
    for (let i = 0; i < a.data.length; i += 4) {
      if (
        a.data[i] !== b.data[i] ||
        a.data[i + 1] !== b.data[i + 1] ||
        a.data[i + 2] !== b.data[i + 2]
      ) {
        differing++
      }
    }
    console.log(
      `${name.padEnd(22)} differing ${differing} of ${a.width * a.height} (${((100 * differing) / (a.width * a.height)).toFixed(2)}%)`,
    )
  }
}

async function captureScene(page: Page, scene: (typeof SCENES)[number]) {
  await navigateWithSessionSpec(
    page,
    {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: scene.assembly,
          loc: scene.loc,
          tracks: [
            {
              trackId: scene.trackId,
              displaySnapshot: {
                type: 'LinearMultiSampleVariantDisplay',
                height: 360,
              },
            },
          ],
        },
      ],
    },
    scene.config,
  )
  await waitForDataLoaded(page, 120000)
  const selector = `[data-display-id^="${scene.trackId}"]`
  await page.waitForSelector(`${selector}[data-display-drawn="true"]`, {
    timeout: 120000,
  })
  await page.evaluate(layout => {
    const display = (window as any).JBrowseSession.views[0].tracks[0]
      .displays[0]
    display.setShowRowSeparators(true)
    if (layout !== 'genomic') {
      display.setVariantLayout(layout)
    }
  }, scene.layout)
  await waitForDataLoaded(page, 120000)
  await delay(3000)
  const info = await page.evaluate(sel => {
    const canvases = [
      ...(document.querySelector(sel)?.querySelectorAll('canvas') ?? []),
    ]
    const canvas = canvases.sort(
      (a, b) => b.width * b.height - a.width * a.height,
    )[0]
    // a canvas holding a 2d or webgpu context answers null here
    const gl = canvas?.getContext('webgl2')
    return {
      dpr: window.devicePixelRatio,
      backing: canvas ? `${canvas.width}x${canvas.height}` : '-',
      antialias: gl ? String(gl.getContextAttributes()?.antialias) : 'n/a',
      rows: (window as any).JBrowseSession.views[0].tracks[0].displays[0]
        .sources.length,
    }
  }, selector)
  // A one-color capture is the screenshot racing the paint, not the render:
  // retake it rather than record a blank.
  let shot = new Uint8Array()
  let s = { xBlend: 0, yBlend: 0, colors: 0, w: 0, h: 0 }
  for (let attempt = 0; attempt < 5 && s.colors <= 1; attempt++) {
    if (attempt > 0) {
      await delay(3000)
    }
    const el = await page.waitForSelector(
      `${selector}[data-display-drawn="true"]`,
    )
    shot = await el!.screenshot({ type: 'png' })
    s = blendStats(shot)
  }
  writeFileSync(join(OUT!, `${scene.name}.png`), shot)
  console.log(
    `${scene.name.padEnd(16)} rows ${info.rows} dpr ${info.dpr} backing ${info.backing} webgl2 antialias ${info.antialias} capture ${s.w}x${s.h} colors ${s.colors} x-blend ${s.xBlend} y-blend ${s.yBlend}`,
  )
  writeZoom(
    shot,
    join(OUT!, `${scene.name}.zoom.png`),
    Math.floor(s.w * 0.45),
    Math.floor(s.h * 0.3),
  )
}

async function main() {
  if (process.argv.includes('--diff')) {
    const i = process.argv.indexOf('--diff')
    runDiff(process.argv[i + 1]!, process.argv[i + 2]!)
    return
  }
  if (!OUT) {
    throw new Error('pass --out=<dir>')
  }
  mkdirSync(OUT, { recursive: true })
  snapshotConfig.backend = BACKEND
  const { port, server } = await startServerOnFreePort(3571)
  setPort(port)
  const browser =
    BACKEND === 'webgpu'
      ? await launch({
          browser: 'firefox',
          executablePath: FIREFOX,
          headless: false,
          timeout: 60000,
          extraPrefsFirefox: {
            'layout.css.devPixelsPerPx': DPR.toFixed(2),
            'dom.webgpu.enabled': true,
            'gfx.webrender.all': true,
            'gfx.webgpu.ignore-blocklist': true,
          },
          defaultViewport: { width: 1280, height: 700 },
        })
      : await launch({
          headless: true,
          args: [
            ...BASE_CHROME_ARGS,
            BACKEND === 'canvas2d' ? '--disable-gpu' : '--use-gl=angle',
          ],
          defaultViewport: {
            width: 1280,
            height: 700,
            deviceScaleFactor: DPR,
          },
        })
  const page = await browser.newPage()
  const consoleLines: string[] = []
  page.on('console', m => {
    consoleLines.push(m.text())
  })
  try {
    for (const scene of SCENES.filter(s => !ONLY || s.name === ONLY)) {
      await captureScene(page, scene)
    }
    if (
      BACKEND === 'webgpu' &&
      !consoleLines.some(t => t.includes('WebGPU device ready'))
    ) {
      throw new Error('no "WebGPU device ready" line: not WebGPU')
    }
  } finally {
    await browser.close()
    server.close()
  }
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
