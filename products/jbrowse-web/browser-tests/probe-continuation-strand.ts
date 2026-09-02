/* eslint-disable no-console */
// The headed check for the shared rect/continuation instance buffer: render one
// feature-track view on every backend, prove which backend actually drew each
// frame, and diff the GPU frames against Canvas2D's.
//
// Continuation reads RECT's vertex buffer (`drawPass(continuation, region,
// bufferPassId=rect)`), and `strand` is the last field of `RectInstance`. A
// wrong attribute offset on a HAL cannot be seen from a unit test (the Canvas2D
// path never binds one) and shows up only as garbled geometry — so the view is
// chosen so several features run past BOTH viewport edges on BOTH strands, and
// the »/« markers pinned at each edge must agree with the strand arrows drawn
// on the same glyph. Read the PNGs; the diff numbers are the second oracle
// (GPU_RENDERING.md §"Which backend disagreement is evidence").
//
// The proof that a backend ran is the display canvas's own committed context
// kind, read back with `getContext` — never the URL, which `?renderer=` pins
// but which a canvas whose HAL failed to build would not honour (it would show
// a renderError banner, and the phase census here would say so).
//
//   node products/jbrowse-web/browser-tests/probe-continuation-strand.ts --out=<dir>
//   node products/jbrowse-web/browser-tests/probe-continuation-strand.ts --backend=webgpu --headed
//
// WebGPU is tried headless first and re-launched headed when the display did
// not come up on a WebGPU canvas.
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

import {
  BASE_CHROME_ARGS,
  encodeSessionSpec,
  isBrowserConsoleNoise,
  waitForJBrowseReady,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { comparePngBuffers } from './pngDiff.ts'
import { startServerOnFreePort } from './server.ts'
import { captureElementPng } from './snapshot.ts'

import type { Page } from 'puppeteer'

const BACKENDS = ['canvas2d', 'webgl', 'webgpu'] as const
type Backend = (typeof BACKENDS)[number]

const { values } = parseArgs({
  options: {
    backend: { type: 'string', default: 'all' },
    headed: { type: 'boolean', default: false },
    out: { type: 'string', default: process.cwd() },
    loc: { type: 'string', default: 'ctgA:5500..5900' },
  },
})
const outDir = path.resolve(values.out)
fs.mkdirSync(outDir, { recursive: true })

const TRACK = 'gff3tabix_genes'
// Tall enough that the − strand features of the default loc (remark f05,
// EST_match agt830.3) reach the screen under the + strand ones.
const DISPLAY_HEIGHT = 700

interface SessionShape {
  views: { tracks: { displays: { setHeight: (h: number) => void }[] }[] }[]
}
const DISPLAY = '[data-testid="feature-display"]'

const spec = encodeSessionSpec({
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: values.loc,
      tracks: [TRACK],
    },
  ],
})

function chromeArgs(backend: Backend) {
  return [
    ...BASE_CHROME_ARGS,
    '--use-gl=angle',
    '--ignore-gpu-blocklist',
    ...(backend === 'webgpu' ? ['--enable-unsafe-webgpu'] : []),
  ]
}

interface Evidence {
  browser?: string
  adapter: Record<string, string> | null
  webgl2Renderer: string
  displayCanvases: string[]
  displayPhases: string[]
}

function readEvidence(page: Page) {
  return page.evaluate(async (display: string): Promise<Evidence> => {
    const requestAdapter = async () => {
      try {
        return await navigator.gpu.requestAdapter()
      } catch {
        return null
      }
    }
    const info = (await requestAdapter())?.info
    const gl = document.createElement('canvas').getContext('webgl2')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    const webgl2Renderer =
      gl && ext
        ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string)
        : 'no webgl2'
    const kindOf = (c: HTMLCanvasElement) => {
      const tryKind = (k: string) => {
        try {
          return c.getContext(k) !== null
        } catch {
          return false
        }
      }
      return tryKind('webgpu')
        ? 'webgpu'
        : tryKind('webgl2')
          ? 'webgl2'
          : tryKind('2d')
            ? '2d'
            : 'none'
    }
    const displayCanvases = [
      ...document.querySelectorAll<HTMLCanvasElement>(`${display} canvas`),
    ].map(c => `${kindOf(c)} ${c.width}x${c.height}`)
    const displayPhases = [
      ...document.querySelectorAll<HTMLElement>(display),
    ].map(el => el.dataset.displayPhase ?? 'no phase')
    return {
      adapter: info
        ? {
            vendor: info.vendor,
            architecture: info.architecture,
            device: info.device,
            description: info.description,
          }
        : null,
      webgl2Renderer,
      displayCanvases,
      displayPhases,
    }
  }, DISPLAY)
}

const EXPECTED_KIND: Record<Backend, string> = {
  canvas2d: '2d',
  webgl: 'webgl2',
  webgpu: 'webgpu',
}

async function renderOn(backend: Backend, port: number, headless: boolean) {
  const browser = await launch({
    headless,
    args: chromeArgs(backend),
    defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 2 },
  })
  const gpuConsole: string[] = []
  try {
    const page = await browser.newPage()
    page.on('console', msg => {
      const text = msg.text()
      if (!isBrowserConsoleNoise(text) && /gpu|webgl|hal/i.test(text)) {
        gpuConsole.push(`${msg.type()}: ${text}`)
      }
    })
    page.on('pageerror', e =>
      gpuConsole.push(
        `pageerror: ${e instanceof Error ? e.message : String(e)}`,
      ),
    )
    await page.goto(
      `http://localhost:${port}/?config=test_data/volvox/config.json&session=${spec}&renderer=${backend}`,
      { timeout: 60000 },
    )
    await waitForJBrowseReady(page, {
      assembly: 'volvox',
      trackIds: [TRACK],
      allowUnsettled: true,
    })
    await page.evaluate((height: number) => {
      const session = (window as unknown as { JBrowseSession: SessionShape })
        .JBrowseSession
      session.views[0]!.tracks[0]!.displays[0]!.setHeight(height)
    }, DISPLAY_HEIGHT)
    const ready = await waitForJBrowseReady(page, {
      assembly: 'volvox',
      trackIds: [TRACK],
      settleMs: 2000,
      allowUnsettled: true,
    })
    const evidence = await readEvidence(page)
    evidence.browser = await browser.version()
    const rendered = evidence.displayCanvases.some(k =>
      k.startsWith(EXPECTED_KIND[backend]),
    )
    const display = await captureElementPng(page, DISPLAY, backend)
    const fullPage = await page.screenshot({ type: 'png' })
    return { evidence, rendered, display, fullPage, gpuConsole, ready }
  } finally {
    await browser.close()
  }
}

const { server, port } = await startServerOnFreePort(3300)
const frames = new Map<Backend, Uint8Array>()
try {
  const wanted =
    values.backend === 'all' ? BACKENDS : [values.backend as Backend]
  for (const backend of wanted) {
    let result = await renderOn(backend, port, !values.headed)
    if (!result.rendered && !values.headed) {
      console.log(
        `  ${backend}: not on a ${EXPECTED_KIND[backend]} canvas headless — relaunching headed`,
      )
      result = await renderOn(backend, port, false)
    }
    const { evidence, rendered, display, fullPage, gpuConsole, ready } = result
    fs.writeFileSync(path.join(outDir, `continuation-${backend}.png`), display)
    fs.writeFileSync(
      path.join(outDir, `continuation-${backend}-page.png`),
      fullPage,
    )
    frames.set(backend, display)
    console.log(
      `\n=== ${backend} ${rendered ? 'RENDERED' : 'DID NOT RENDER'} on ${EXPECTED_KIND[backend]}`,
    )
    console.log(`  browser:          ${evidence.browser}`)
    console.log(`  display canvases: ${evidence.displayCanvases.join(' | ')}`)
    console.log(`  display phases:   ${evidence.displayPhases.join(' | ')}`)
    console.log(
      `  webgpu adapter:   ${evidence.adapter ? JSON.stringify(evidence.adapter) : 'null'}`,
    )
    console.log(`  webgl2 renderer:  ${evidence.webgl2Renderer}`)
    console.log(
      `  ready: unsettled=[${ready.unsettled.join(',')}] pending=[${ready.pending.join(',')}] paintContract=${ready.paintContract}`,
    )
    for (const line of gpuConsole) {
      console.log(`  console ${line}`)
    }
    if (!rendered) {
      process.exitCode = 1
    }
  }

  const pairs: [Backend, Backend][] = [
    ['webgl', 'canvas2d'],
    ['webgpu', 'canvas2d'],
    ['webgl', 'webgpu'],
  ]
  console.log('')
  for (const [a, b] of pairs) {
    const fa = frames.get(a)
    const fb = frames.get(b)
    if (fa && fb) {
      const diff = comparePngBuffers(fa, fb)
      const pct = (diff.diffFraction * 100).toFixed(2)
      console.log(
        diff.sameSize
          ? `  ${a} vs ${b}: ${pct}% pixels differ`
          : `  ${a} vs ${b}: size differs ${diff.widthA}x${diff.heightA} vs ${diff.widthB}x${diff.heightB}`,
      )
      fs.writeFileSync(
        path.join(outDir, `continuation-${a}-vs-${b}.diff.png`),
        diff.diffImage,
      )
    }
  }
} finally {
  server.close()
}
