/* eslint-disable no-console */
// A tall track on a wide hi-dpi view, where a canvas's backing store passes
// Chrome's 7680x4320 px WebGL drawing-buffer cap unless `backingSize` keeps it
// under. Reports, per height, the canvas the display got, the drawing buffer
// WebGL2 allocated for it, and any GPU error on the console, and saves the
// track's top 600 CSS px so a short track and a capped one can be compared.
//
//   node browser-tests/probe-canvas-area-cap.ts webgl     # headless Chrome
//   node browser-tests/probe-canvas-area-cap.ts webgpu    # headed Firefox Nightly
//
// The WebGL2 arm wants a real GPU: CHROME_ARGS defaults to ANGLE over GL.
//
// Measured 2026-10-11 on volvox_alignments, 2586 CSS px wide at dpr 2: at 4000
// and 6000 px tall the store holds at 5172x6414 in Chrome 155 (WebGL2, Intel
// ANGLE-GL), with the drawing buffer the same size, and at 5148x6444 in
// Firefox Nightly 157 (WebGPU). No GPU error in either, and each capped crop
// places every read where the 1000 px track does; the 4-7% of pixels that
// differ are the vertical resampling and, in Firefox, a page scrollbar.
import { encodeSessionSpec } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { waitForDataLoaded } from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

import type { Browser, Page } from 'puppeteer'

const BACKEND = process.argv[2] === 'webgpu' ? 'webgpu' : 'webgl'
const OUT = process.env.OUT ?? '.'
const WIDTH = 2600
const HEIGHTS = [1000, 3000, 4000, 6000]
const FIREFOX = process.env.FIREFOX_NIGHTLY_PATH ?? '/usr/bin/firefox-nightly'

function launchBrowser(): Promise<Browser> {
  return BACKEND === 'webgpu'
    ? launch({
        browser: 'firefox',
        executablePath: FIREFOX,
        headless: false,
        timeout: 60000,
        extraPrefsFirefox: {
          'layout.css.devPixelsPerPx': '2.0',
          'dom.webgpu.enabled': true,
          'gfx.webrender.all': true,
          'gfx.webgpu.ignore-blocklist': true,
        },
        defaultViewport: { width: WIDTH, height: 1400 },
      })
    : launch({
        headless: true,
        args: (
          process.env.CHROME_ARGS ??
          '--no-sandbox --use-gl=angle --use-angle=gl --ignore-gpu-blocklist'
        ).split(/\s+/),
        defaultViewport: { width: WIDTH, height: 1400, deviceScaleFactor: 2 },
      })
}

async function measure(page: Page, port: number, height: number) {
  const spec = {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgA:1-6000',
        tracks: [{ trackId: 'volvox_alignments', height }],
      },
    ],
  }
  const errors: string[] = []
  const onConsole = (m: { text: () => string }) => {
    const t = m.text()
    if (/webgpu|webgl|validation|scissor|viewport|GPU/i.test(t)) {
      errors.push(t.slice(0, 200))
    }
  }
  page.on('console', onConsole)
  await page.goto(
    `http://localhost:${port}/?config=test_data/volvox/config.json&session=${encodeSessionSpec(spec)}&sessionName=probe&renderer=${BACKEND}`,
  )
  await waitForDataLoaded(page, 90000)
  await new Promise(r => setTimeout(r, 1500))
  const info = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')]
    const c = canvases.toSorted(
      (a, b) => b.width * b.height - a.width * a.height,
    )[0]!
    const gl = c.getContext('webgl2')
    const r = c.getBoundingClientRect()
    return {
      dpr: devicePixelRatio,
      css: `${Math.round(r.width)}x${Math.round(r.height)}`,
      canvas: `${c.width}x${c.height}`,
      area: c.width * c.height,
      drawingBuffer: gl
        ? `${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`
        : 'not webgl2',
      top: r.top,
      left: r.left,
    }
  })
  await page.screenshot({
    path: `${OUT}/area-cap-${BACKEND}-${height}.png`,
    clip: { x: info.left, y: info.top, width: 1200, height: 600 },
    // A page past ~8192 device px tall screenshots blank in headless Chrome
    // when it captures beyond the viewport; the crop is inside it anyway.
    captureBeyondViewport: false,
  })
  page.off('console', onConsole)
  return { height, ...info, errors: errors.slice(0, 3) }
}

async function main() {
  const { port, server } = await startServerOnFreePort(3561)
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    for (const height of HEIGHTS) {
      console.log(JSON.stringify(await measure(page, port, height)))
    }
  } finally {
    await browser.close()
    server.close()
  }
}

await main()
