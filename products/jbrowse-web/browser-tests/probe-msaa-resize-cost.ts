/* eslint-disable no-console */
// What a track-height drag costs on WebGPU, where every frame of the gesture
// destroys and rebuilds the HAL's 4x MSAA color attachment.
//
// `GpuPerRegionRenderingBackend.renderBlocks` calls `hal.resize(canvasWidth,
// canvasHeight)` every frame; `WebGPUHal.resize` rebuilds the MSAA texture
// whenever `syncCanvasSize` reports a changed backing store; and `useResizeDrag`
// commits one height per animation frame. So a drag reallocates a tens-of-MB
// multisample texture per frame. That was arithmetic; this measures it, and the
// answer is in ARCHITECTURAL_LIMITS.md §"The MSAA target is the largest
// per-display allocation, and nothing counts it".
//
// **The mechanism is exactly as described and it costs nothing.** 250 drag
// frames give 250 rebuilds against 0 for a pan of the same length, and those
// 250 rebuilds of a texture growing to 79 MiB total 1.9 ms of JS — ~8 µs a
// call, flat in texture size — with the median frame interval identical to the
// pan arm's. Re-run it before reopening the question; these are the numbers a
// change has to beat.
//
// Two arms over the same track, same backend, same frame count:
//
//   resize — resizeHeight() per frame, so the canvas grows and the MSAA target
//            is rebuilt each time
//   pan    — horizontalScroll() per frame, so the canvas redraws at a CONSTANT
//            size and no MSAA texture is built at all
//
// The pan arm is the control that makes the resize number mean something: both
// repaint the whole canvas every frame through the same renderer, and only one
// of them resizes. A difference is the resize path; no difference is the entry
// retiring.
//
// It drives `resizeHeight` / `horizontalScroll` directly rather than
// synthesizing a pointer stream. That is the same model write `useResizeDrag`
// and `useWheelScroll` commit — both coalesce to one per animation frame — and
// it removes the handle's selector and the pointer plumbing from a measurement
// that is about what happens downstream of the write.
//
// TRAPS
//
//  - **WebGPU needs Firefox Nightly, headed.** Chrome + puppeteer does not
//    render a WebGPU canvas at all, which is why runner.ts routes
//    `--backend=webgpu` here. A headless run measures nothing.
//  - **`createTexture` returning fast is not the allocation being cheap.**
//    WebGPU is free to defer the real commit to first use or to the GPU
//    process, so the JS-visible time is a floor, not the cost. That is what the
//    frame-interval columns are for: they see a stall wherever it lands, as
//    long as it lands on this thread's frame loop.
//  - The first frame of either arm builds pipelines and warms caches; both arms
//    discard it, and both run the same number of frames.
//
//     node browser-tests/probe-msaa-resize-cost.ts [frames] [pxPerFrame]
import { launch } from 'puppeteer'

import {
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

import type { Page } from 'puppeteer'

const FRAMES = Number(process.argv[2] ?? 60)
const PX_PER_FRAME = Number(process.argv[3] ?? 4)
const FIREFOX = process.env.FIREFOX_NIGHTLY_PATH ?? '/usr/bin/firefox-nightly'

interface TextureEvent {
  ms: number
  width: number
  height: number
  sampleCount: number
}

interface ArmResult {
  frames: number
  frameIntervals: number[]
  creates: TextureEvent[]
  destroyMs: number[]
  canvas: { width: number; height: number } | null
}

// Patch GPUDevice.createTexture / GPUTexture.destroy in the page so the shipped
// HAL is measured as it runs. Installed after first paint, so the HAL's initial
// MSAA build is excluded and only the gesture's rebuilds are counted.
async function instrument(page: Page) {
  await page.evaluate(() => {
    const w = window as any
    if (w.__msaaProbe) {
      w.__msaaProbe.creates.length = 0
      w.__msaaProbe.destroyMs.length = 0
      return
    }
    w.__msaaProbe = { creates: [], destroyMs: [] }
    const devProto = w.GPUDevice?.prototype
    const texProto = w.GPUTexture?.prototype
    if (!devProto || !texProto) {
      w.__msaaProbe.unavailable = true
      return
    }
    const origCreate = devProto.createTexture
    devProto.createTexture = function (desc: any) {
      const t0 = performance.now()
      const tex = origCreate.call(this, desc)
      const ms = performance.now() - t0
      const size = desc?.size
      const [width, height] = Array.isArray(size)
        ? size
        : [size?.width ?? 0, size?.height ?? 0]
      if ((desc?.sampleCount ?? 1) > 1) {
        w.__msaaProbe.creates.push({
          ms,
          width,
          height,
          sampleCount: desc.sampleCount,
        })
      }
      return tex
    }
    const origDestroy = texProto.destroy
    texProto.destroy = function () {
      const t0 = performance.now()
      const r = origDestroy.call(this)
      w.__msaaProbe.destroyMs.push(performance.now() - t0)
      return r
    }
  })
}

// Run `frames` animation frames, committing one model write per frame, and
// record the interval between frames. `kind` picks which write.
async function runArm(
  page: Page,
  kind: 'resize' | 'pan',
  frames: number,
  px: number,
): Promise<ArmResult> {
  await instrument(page)
  return page.evaluate(
    async (kind, frames, px) => {
      const w = window as any
      const view = w.JBrowseSession.views[0]
      const display = view.tracks[0].displays[0]
      const nextFrame = () =>
        new Promise<number>(resolve => requestAnimationFrame(resolve))

      // discard one frame so pipeline warmup lands outside the measurement
      await nextFrame()
      const intervals: number[] = []
      let prev = performance.now()
      for (let i = 0; i < frames; i++) {
        if (kind === 'resize') {
          display.resizeHeight(px)
        } else {
          view.horizontalScroll(px)
        }
        await nextFrame()
        const now = performance.now()
        intervals.push(now - prev)
        prev = now
      }
      const canvas = document.querySelector('canvas')
      return {
        frames,
        frameIntervals: intervals,
        creates: w.__msaaProbe.creates.slice(),
        destroyMs: w.__msaaProbe.destroyMs.slice(),
        canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
      }
    },
    kind,
    frames,
    px,
  )
}

function median(xs: number[]) {
  if (xs.length === 0) {
    return 0
  }
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]!
}

function sum(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0)
}

const mib = (t: TextureEvent) =>
  (t.width * t.height * 4 * t.sampleCount) / (1024 * 1024)

function report(label: string, r: ArmResult) {
  const last = r.creates.at(-1)
  const bytes = last ? mib(last) : 0
  console.log(
    label.padEnd(8),
    String(r.frames).padStart(7),
    String(r.creates.length).padStart(8),
    sum(r.creates.map(c => c.ms))
      .toFixed(1)
      .padStart(10),
    median(r.creates.map(c => c.ms))
      .toFixed(3)
      .padStart(10),
    median(r.destroyMs).toFixed(3).padStart(10),
    median(r.frameIntervals).toFixed(2).padStart(10),
    Math.max(...r.frameIntervals)
      .toFixed(1)
      .padStart(9),
    bytes.toFixed(1).padStart(9),
    (r.canvas ? `${r.canvas.width}x${r.canvas.height}` : '-').padStart(11),
  )
}

async function main() {
  const { port, server } = await startServerOnFreePort(3557)
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
      // Firefox clamps performance.now() for fingerprinting resistance, and the
      // clamp is coarser than the thing being timed — without this every
      // per-call column reads 0.000 whatever the truth is, which looks like a
      // measurement and is not one. The runner does NOT set this: it is wrong
      // for a test that should see what a user's browser does, and right for a
      // probe whose whole output is sub-millisecond durations.
      'privacy.reduceTimerPrecision': false,
    },
    defaultViewport: { width: 1280, height: 800 },
  })
  const page = await browser.newPage()
  // Collected rather than reduced to a flag as they arrive: a `let seen = false`
  // written only inside this callback is narrowed to `false` by the checker, so
  // the guard below reads as a constant and lints as one.
  const consoleLines: string[] = []
  page.on('console', m => {
    consoleLines.push(m.text())
  })
  try {
    await navigateWithSessionSpec(page, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50,000',
          tracks: [{ trackId: 'volvox_alignments' }],
        },
      ],
    })
    await waitForDataLoaded(page)
    await new Promise(r => setTimeout(r, 2000))

    // NOT `currentRenderingBackend.constructor.name` — the production bundle
    // this loads is minified, so every backend answers to a two-letter name and
    // the check silently reported the GPU path as absent. The app's own startup
    // line is the honest signal, and `creates` below is the corroboration: an
    // MSAA texture is something only WebGPUHal builds.
    if (!consoleLines.some(t => t.includes('WebGPU device ready'))) {
      console.log(
        'no "[GPU] WebGPU device ready" line — the ladder fell through to WebGL2 or Canvas2D, so there is nothing to measure here.',
      )
      return
    }
    console.log('backend: WebGPU (device-ready line seen)')

    console.log(
      '\narm'.padEnd(9),
      'frames'.padStart(7),
      'msaaNew'.padStart(8),
      'createTot'.padStart(10),
      'createMed'.padStart(10),
      'destroyMed'.padStart(10),
      'frameMed'.padStart(10),
      'frameMax'.padStart(9),
      'MiB/tex'.padStart(9),
      'canvasPx'.padStart(11),
    )
    // pan first: it leaves the canvas height where it is, so the resize arm
    // starts from the same geometry it would have anyway
    report('pan', await runArm(page, 'pan', FRAMES, PX_PER_FRAME))
    report('resize', await runArm(page, 'resize', FRAMES, PX_PER_FRAME))
  } finally {
    await browser.close()
    server.close()
  }
}

await main()
