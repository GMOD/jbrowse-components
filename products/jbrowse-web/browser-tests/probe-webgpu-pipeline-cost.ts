/* eslint-disable no-console */
// What resolving a display's whole pass list costs on WebGPU, and what the
// per-device pipeline cache saves.
//
// The two HALs build pipelines at opposite times. `WebGL2Hal.getPass` links a
// program on its first DRAW, because linking is main-thread driver time and a
// three-track LGV declares 29 programs and draws with 14. `WebGPUHal.create`
// awaits its whole declared list — alignments declares 23 — before it returns,
// so a track's first paint waits on every pass it could ever draw, including
// the ones behind a colorBy nobody selected.
//
// Whether that costs anything was never measured; `createRenderPipelineAsync`
// is supposed to keep the work off the main thread. This asks.
//
// It answers two questions in one run, by loading the same session with a
// growing number of alignments tracks:
//
//   pipelines   how many GPURenderPipelines the page builds in total. Before
//               `hal/deviceGpuCache.ts` this was 23 x tracks; the cache keys on
//               the descriptor object, which is a module const shared by every
//               display of a type, so it should stay flat at 23.
//   readyMs     navigation to every display reporting data-display-drawn, which
//               is the number a user feels.
//
// A flat pipeline count across the track column is the cache working. A ready
// time that grows with tracks anyway says the pipelines were never the cost.
//
// TRAPS
//
//  - **The instrumentation must be installed before the app runs**, since the
//    HAL builds its pipelines during the first display's mount.
//    `evaluateOnNewDocument` is what gets in front of that; installing after
//    navigation measures nothing and reports zero, which reads like a result.
//  - **Time the promise, not the call.** `createRenderPipelineAsync` returns
//    immediately by design, so the interesting duration is call-to-resolve.
//  - **Firefox clamps `performance.now()`** unless
//    `privacy.reduceTimerPrecision` is off, and the clamp is coarser than a
//    single pipeline build.
//  - WebGPU needs Firefox Nightly, headed — Chrome + puppeteer renders no
//    WebGPU canvas at all. See runner.ts.
//
//     node browser-tests/probe-webgpu-pipeline-cost.ts [maxTracks]
import { launch } from 'puppeteer'

import { navigateWithSessionSpec, setPort } from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

import type { Page } from 'puppeteer'

const MAX_TRACKS = Number(process.argv[2] ?? 4)
const FIREFOX = process.env.FIREFOX_NIGHTLY_PATH ?? '/usr/bin/firefox-nightly'

// volvox ships several alignments tracks; repeating one trackId in a session
// would collide on display ids, so cycle real ones and fall back to repeating
// the list, which still exercises one pass list per display.
const TRACK_POOL = [
  'volvox_alignments',
  'volvox_cram_alignments',
  'volvox-long-reads-sv-bam',
  'volvox-long-reads-cram',
]

interface PipelineStats {
  pipelines: number
  shaderModules: number
  bindGroupLayouts: number
  totalResolveMs: number
  maxResolveMs: number
}

async function install(page: Page) {
  await page.evaluateOnNewDocument(() => {
    const w = window as any
    w.__pipeProbe = {
      pipelines: 0,
      shaderModules: 0,
      bindGroupLayouts: 0,
      totalResolveMs: 0,
      maxResolveMs: 0,
    }
    // GPUDevice does not exist until the page's own scripts touch navigator.gpu
    // in some builds, so patch lazily off the prototype the first time it is
    // there. A rAF poll is enough: the HAL is built after React mounts.
    const patch = () => {
      const proto = w.GPUDevice?.prototype
      if (!proto || proto.__patched) {
        return !!proto
      }
      proto.__patched = true
      const origPipeline = proto.createRenderPipelineAsync
      proto.createRenderPipelineAsync = function (desc: any) {
        const t0 = performance.now()
        w.__pipeProbe.pipelines++
        return origPipeline.call(this, desc).then((p: unknown) => {
          const ms = performance.now() - t0
          w.__pipeProbe.totalResolveMs += ms
          w.__pipeProbe.maxResolveMs = Math.max(w.__pipeProbe.maxResolveMs, ms)
          return p
        })
      }
      const origModule = proto.createShaderModule
      proto.createShaderModule = function (desc: any) {
        w.__pipeProbe.shaderModules++
        return origModule.call(this, desc)
      }
      const origLayout = proto.createBindGroupLayout
      proto.createBindGroupLayout = function (desc: any) {
        w.__pipeProbe.bindGroupLayouts++
        return origLayout.call(this, desc)
      }
      return true
    }
    if (!patch()) {
      const tick = () => {
        if (!patch()) {
          requestAnimationFrame(tick)
        }
      }
      requestAnimationFrame(tick)
    }
  })
}

async function run(page: Page, tracks: number) {
  const trackIds = Array.from(
    { length: tracks },
    (_, i) => TRACK_POOL[i % TRACK_POOL.length]!,
  )
  const t0 = Date.now()
  await navigateWithSessionSpec(page, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgA:1-50,000',
        tracks: trackIds.map(trackId => ({ trackId })),
      },
    ],
  })
  let readyMs = -1
  try {
    await page.waitForFunction(
      (n: number) =>
        document.querySelectorAll('[data-display-drawn="true"]').length >= n,
      { timeout: 90000 },
      trackIds.length,
    )
    readyMs = Date.now() - t0
  } catch {
    // leave -1; the pipeline counts are still the point
  }
  const stats: PipelineStats = await page.evaluate(
    () => (window as any).__pipeProbe,
  )
  return { readyMs, ...stats }
}

async function main() {
  const { port, server } = await startServerOnFreePort(3559)
  setPort(port)
  const browser = await launch({
    browser: 'firefox',
    executablePath: FIREFOX,
    headless: false,
    timeout: 60000,
    extraPrefsFirefox: {
      'dom.webgpu.enabled': true,
      'gfx.webrender.all': true,
      'gfx.webgpu.ignore-blocklist': true,
      'privacy.reduceTimerPrecision': false,
    },
    defaultViewport: { width: 1280, height: 800 },
  })
  const page = await browser.newPage()
  await install(page)
  const consoleLines: string[] = []
  page.on('console', m => {
    consoleLines.push(m.text())
  })
  try {
    console.log(
      'tracks'.padStart(7),
      'pipelines'.padStart(10),
      'modules'.padStart(8),
      'bgLayouts'.padStart(10),
      'resolveTot'.padStart(11),
      'resolveMax'.padStart(11),
      'readyMs'.padStart(8),
    )
    for (let n = 1; n <= MAX_TRACKS; n++) {
      const r = await run(page, n)
      console.log(
        String(n).padStart(7),
        String(r.pipelines).padStart(10),
        String(r.shaderModules).padStart(8),
        String(r.bindGroupLayouts).padStart(10),
        r.totalResolveMs.toFixed(1).padStart(11),
        r.maxResolveMs.toFixed(1).padStart(11),
        String(r.readyMs).padStart(8),
      )
    }
    if (!consoleLines.some(t => t.includes('WebGPU device ready'))) {
      console.log(
        '\nNO "[GPU] WebGPU device ready" line — the ladder fell through, so the counts above are not WebGPU.',
      )
    }
  } finally {
    await browser.close()
    server.close()
  }
}

await main()
