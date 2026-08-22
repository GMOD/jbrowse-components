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
// **Measured again 2026-08-22 on a retina panel (MacBook Pro 16" 2019, Firefox
// Nightly 156.0a1), and the dpr² term is real.** `--dpr` pins
// `layout.css.devPixelsPerPx`, so both arms are the same window, the same track
// and the same driver with only the backing store moved:
//
//     scenario                              dpr 1     dpr 2   retina cost
//     one track, 1266x840 css            16.2 MiB  64.9 MiB          4.0x
//     eight GPU tracks, default heights  27.4 MiB  109.7 MiB         4.0x
//     one track at the canvas clamp     154.5 MiB  316.5 MiB         2.0x
//
// The last row is short of 4x because the clamp truncates it, which is the
// finding this trip actually turned up. `MAX_CANVAS_DIM_PX` (8192) holds the
// backing store below `maxTextureDimension2D` (8192 on this device), so
// `recreateMsaaTexture`'s legible "too large for this GPU" refusal — which
// GPU_PORTABILITY.md promised was the failure mode up here — never fires. What
// happens instead is the clamp regime: past ~4096 CSS px of track height at
// dpr 2 the whole track paints **blank**, with no banner, no console error and
// no `display.error`, and comes back when the track is shrunk. `--ceiling`
// walks a track's height through it; at dpr 1 the same walk paints to 8000.
//
// The rebuild is still free at 4x the texture: 60 rebuilds of a 65 MiB target
// in 1.0 ms total (0.020 ms median), against 0.7 ms at dpr 1.
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
//  - **`layout.css.devPixelsPerPx` is a STRING pref.** Written as a number,
//    Firefox rejects the profile and exits 0 before any page loads, which
//    reaches puppeteer as "Failed to launch the browser process: Code: 0" with
//    an empty stderr and names nothing. `--dpr` writes `DPR.toFixed(1)`.
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
// `--dpr=N` pins `layout.css.devPixelsPerPx`, which is what makes the two dpr
// arms one measurement rather than two machines: the same window, the same
// track, the same driver, and the backing store the only thing that moved. The
// page's own `devicePixelRatio` is reported back, so a pref that did not take
// is visible in the output instead of silently halving the answer.
const DPR_ARG = process.argv.find(a => a.startsWith('--dpr='))
const DPR = DPR_ARG ? Number(DPR_ARG.slice('--dpr='.length)) : undefined
// `--ceiling` walks the track height into the clamp instead of measuring a
// drag. Different question, same trip: MAX_CANVAS_DIM_PX bounds the backing
// store at 8192, so at dpr 2 a CSS height past ~4096 stops tracking, and what
// the user sees there is the thing to find out.
const CEILING = process.argv.includes('--ceiling')
// `--tracks=N` loads N GPU tracks and totals the MSAA targets standing at once.
// One target per display is the design (`WebGPUHal` owns one each), so the
// session-wide number is the one nothing anywhere counts.
const TRACKS_ARG = process.argv.find(a => a.startsWith('--tracks='))
const TRACKS = TRACKS_ARG ? Number(TRACKS_ARG.slice('--tracks='.length)) : 0
// From `workspaces-freeze-stress.ts`, which walks the same list up for the
// WebGL2 context ceiling — same question, different resource.
const VOLVOX_TRACKS = [
  'volvox_bam_pileup',
  'volvox_microarray',
  'volvox_filtered_vcf',
  'volvox_bam_snpcoverage',
  'volvox_gc',
  'volvox_sv_test',
  'volvox_alignments',
  'volvox_gwas',
  'volvox_test_vcf',
  'volvox_microarray_color',
  'volvox_microarray_line',
  'volvox_microarray_density',
]

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

// Census of the MSAA targets standing right now, installed before the app runs
// so a display's FIRST build is counted — `instrument()` below deliberately
// excludes those, because a drag measurement wants only the rebuilds.
async function installLiveCensus(page: Page) {
  await page.evaluateOnNewDocument(() => {
    const w = window as any
    w.__msaaLive = new Map()
    const install = () => {
      const devProto = w.GPUDevice?.prototype
      const texProto = w.GPUTexture?.prototype
      if (!devProto || !texProto) {
        return false
      }
      const origCreate = devProto.createTexture
      devProto.createTexture = function (desc: any) {
        const tex = origCreate.call(this, desc)
        if ((desc?.sampleCount ?? 1) > 1) {
          const size = desc.size
          const [width, height] = Array.isArray(size)
            ? size
            : [size?.width ?? 0, size?.height ?? 0]
          w.__msaaLive.set(tex, {
            width,
            height,
            sampleCount: desc.sampleCount,
          })
        }
        return tex
      }
      const origDestroy = texProto.destroy
      texProto.destroy = function () {
        w.__msaaLive.delete(this)
        return origDestroy.call(this)
      }
      return true
    }
    install()
  })
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

// Grow the track height in steps and report, at each one, the three things that
// decide what the user sees: the CSS box the display asked for, the backing
// store it actually got (`syncCanvasSize` clamps at MAX_CANVAS_DIM_PX = 8192),
// and whether a frame still lands. The MSAA refusal in `recreateMsaaTexture`
// fires only past `maxTextureDimension2D`, and the clamp holds the backing
// store at 8192 — so if the limit is also 8192 the refusal is unreachable by
// this route and the clamp regime is what a user meets instead.
async function walkIntoTheCeiling(page: Page, consoleLines: string[]) {
  console.log(
    '\ncssH'.padEnd(9),
    'backingH'.padStart(9),
    'msaaMiB'.padStart(9),
    'clamped'.padStart(8),
    'error'.padStart(6),
  )
  for (const cssHeight of [1000, 2000, 3000, 4000, 4200, 5000, 6000, 8000]) {
    const before = consoleLines.length
    const row = await page.evaluate(async cssHeight => {
      const w = window as any
      const display = w.JBrowseSession.views[0].tracks[0].displays[0]
      display.setHeight(cssHeight)
      const nextFrame = () =>
        new Promise<number>(resolve => requestAnimationFrame(resolve))
      // two frames: one to resize the canvas, one to draw into it
      await nextFrame()
      await nextFrame()
      const canvas = document.querySelector('canvas')
      return {
        cssHeight,
        backingHeight: canvas?.height ?? 0,
        backingWidth: canvas?.width ?? 0,
        error: display.error ? String(display.error) : '',
      }
    }, cssHeight)
    const fresh = consoleLines.slice(before)
    const clamped = fresh.some(t => t.includes('exceeds the safe limit'))
    // What the GPU said at this height. The clamp regime's failure is a rect
    // the backing store cannot hold, and the rejection is the only thing that
    // names it — `display.error` stays empty and nothing reaches the user.
    for (const line of fresh) {
      if (
        /validation|scissor|viewport|GPUValidationError|out of bounds/i.test(
          line,
        )
      ) {
        console.log(`      gpu@${cssHeight}: ${line.slice(0, 160)}`)
      }
    }
    const msaaMiB = (row.backingWidth * row.backingHeight * 4 * 4) / 1024 / 1024
    console.log(
      String(row.cssHeight).padEnd(9),
      String(row.backingHeight).padStart(9),
      msaaMiB.toFixed(1).padStart(9),
      String(clamped).padStart(8),
      (row.error || '-').slice(0, 60).padStart(6),
    )
    await page.screenshot({
      path: `msaa-ceiling-${row.cssHeight}.png`,
    })
  }
  // **The screenshots are the evidence for what the user sees**, and there is no
  // `painted` column because there is no honest way to compute one here: a
  // WebGPU canvas's contents are not readable back through `drawImage` after
  // present, so a pixel probe reports "blank" for every row including the ones
  // that plainly paint. Read the PNGs.
  //
  // Does it come back? A drag past the clamp and back is the gesture a user
  // actually makes, and a track that stays blank after shrinking is a
  // different (worse) bug from one that recovers.
  const recovered = await page.evaluate(async () => {
    const w = window as any
    w.JBrowseSession.views[0].tracks[0].displays[0].setHeight(1000)
    const nextFrame = () =>
      new Promise<number>(resolve => requestAnimationFrame(resolve))
    await nextFrame()
    await nextFrame()
    const canvas = document.querySelector('canvas')
    return canvas ? `${canvas.width}x${canvas.height}` : '-'
  })
  console.log(`\nback down to css 1000 → backing ${recovered}`)
  await page.screenshot({ path: 'msaa-ceiling-recovered.png' })
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
      // A STRING pref (default "-1.0", meaning follow the screen). Written as
      // a number, Firefox rejects the profile and exits 0 at startup, which
      // reaches puppeteer as "Failed to launch the browser process: Code: 0"
      // and names nothing.
      ...(DPR === undefined
        ? {}
        : { 'layout.css.devPixelsPerPx': DPR.toFixed(1) }),
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
  await installLiveCensus(page)
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
          tracks:
            TRACKS > 0
              ? VOLVOX_TRACKS.slice(0, TRACKS).map(trackId => ({ trackId }))
              : [{ trackId: 'volvox_alignments' }],
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
    const geometry = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      const box = canvas?.getBoundingClientRect()
      return {
        dpr: window.devicePixelRatio,
        cssBox: box
          ? `${Math.round(box.width)}x${Math.round(box.height)}`
          : '-',
        backing: canvas ? `${canvas.width}x${canvas.height}` : '-',
      }
    })
    console.log(
      `devicePixelRatio: ${geometry.dpr}${
        DPR === undefined ? ' (native)' : ` (asked for ${DPR})`
      }  canvas css ${geometry.cssBox} → backing ${geometry.backing}`,
    )
    // `logGpuCapabilities` warns these on device acquisition, so the run that
    // measures the target also records the limits it is measured against —
    // maxTextureDimension2D is what decides where the refusal lands.
    for (const line of consoleLines.filter(t => t.includes('maxTexture'))) {
      console.log(line)
    }

    if (TRACKS > 0) {
      const census = await page.evaluate(() => {
        const w = window as any
        const targets = [...w.__msaaLive.values()] as {
          width: number
          height: number
          sampleCount: number
        }[]
        return {
          count: targets.length,
          mib: targets.reduce(
            (a, t) => a + (t.width * t.height * 4 * t.sampleCount) / 1048576,
            0,
          ),
          sizes: targets.map(t => `${t.width}x${t.height}`),
        }
      })
      console.log(
        `\n${TRACKS} tracks → ${census.count} live MSAA target(s), ` +
          `${census.mib.toFixed(1)} MiB total`,
      )
      console.log(`  ${census.sizes.join('  ')}`)
      return
    }

    if (CEILING) {
      await walkIntoTheCeiling(page, consoleLines)
      return
    }

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
