/* eslint-disable no-console */
// Capture the wiggle renderer's marks at device resolution, so a change to how
// a bar's horizontal cuts are antialiased can be compared against the shipping
// look AND against the sample count.
//
// The question it exists to answer: `wiggle.slang`'s xyplot bar used to be a
// flat fill whose edges were smoothed, if at all, by the HAL's 4x multisampled
// colour attachment, and a bar's top edge is the datum. Four arms settle whether
// the fragment can do that work itself — the shader before and after, each at
// both sample counts:
//
//   before @ 4   the shipping look, and the target the change has to match
//   before @ 1   what dropping the sample count used to cost
//   after  @ 1   must match `before @ 4` at the tops — the claim
//   after  @ 4   must not be worse than `after @ 1`
//
// The sample count is a per-display property (`RenderingBackendOptions.
// sampleCount`), so the 1-sample arms are `sampleCount: 1` in
// `plugins/wiggle/src/shared/WiggleRenderer.ts`'s `createRenderingBackend` call.
// Flip it, rebuild, capture, and put it back — which display drops to 1 is a
// look-at-the-pixels decision, not something a probe leaves behind.
//
//     pnpm --filter @jbrowse/web build
//     FIREFOX_NIGHTLY_PATH=... node browser-tests/probe-bar-top-aa.ts --out=/tmp/shots/before-4
//     node browser-tests/probe-bar-top-aa.ts --diff /tmp/shots/before-4 /tmp/shots/after-1
//
// **The horizontal/vertical split in the diff arm is what makes this readable.**
// A bar's horizontal cuts carry its value and its vertical sides carry only its
// silhouette, so a single differing-pixel count answers two questions at once
// and neither of them clearly. Reported separately, the result reads off the
// table: after the change, `after @ 4` against `after @ 1` differs on VERTICAL
// runs only — the tops are identical at both sample counts, which is what the
// change was for — while `before @ 4` against `before @ 1` moved both.
// `--out=<dir>` alongside `--diff` writes the classified diff as an image,
// magenta for horizontal runs and green for vertical.
//
// TRAPS
//
//  - **WebGPU needs Firefox Nightly, headed.** Chrome + puppeteer does not
//    render a WebGPU canvas at all. `?renderer=webgpu` pins the ladder so a
//    fallback to WebGL2 fails loudly instead of quietly measuring the wrong
//    backend, and the app's own "[GPU] WebGPU device ready" line corroborates.
//  - **`layout.css.devPixelsPerPx` is a STRING pref.** Written as a number,
//    Firefox rejects the profile and exits 0 before any page loads, which
//    reaches puppeteer as "Failed to launch the browser process: Code: 0" with
//    nothing in stderr. Same trap `probe-msaa-resize-cost.ts` records.
//  - The capture is the canvas ELEMENT's screenshot, which is composited
//    output. That is the right instrument here — both arms are the same DOM,
//    the same data and the same browser, so anything that moves is the render.
//    Two builds of the same arm come back byte-identical; check that before
//    reading a small diff as signal.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { basename, join } from 'node:path'

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
const DPR = Number(arg('dpr') ?? 2)
const LOC = arg('loc') ?? 'ctgA:1-4,000'

// One capture each. `rendering` drives `setRenderingType` after load rather
// than relying on a configured track, so the xyplot and the line arms are the
// same data drawn two ways and a difference between them is the shader.
const SCENES = [
  {
    name: 'xyplot',
    trackId: 'volvox_microarray',
    rendering: undefined,
    pivot: undefined,
  },
  {
    name: 'linecenter',
    trackId: 'volvox_microarray',
    rendering: 'linecenter',
    pivot: undefined,
  },
  // A bar whose score sits BELOW the origin has its datum on its BOTTOM cut and
  // the baseline on its top, so this is the scene that says whether "the top
  // edge" was the right thing to name. Driving the pivot into the middle of the
  // domain is what produces them from data that is otherwise all positive, and
  // it also produces the bars this shader's other decision is about: a score
  // landing on the pivot is a bar of zero height, and there are hundreds of them
  // at a pivot the data actually visits.
  {
    name: 'bicolor',
    trackId: 'volvox_microarray',
    rendering: undefined,
    pivot: 150,
  },
  {
    name: 'posneg-frac',
    trackId: 'wiggle_track_fractional_posneg',
    rendering: 'xyplot',
    pivot: undefined,
  },
  // Controls: neither computes its own coverage, so both must come back
  // byte-identical across the two builds. A difference here is the capture
  // drifting, not the change.
  {
    name: 'density',
    trackId: 'volvox_microarray_density',
    rendering: undefined,
    pivot: undefined,
  },
  {
    name: 'stepline',
    trackId: 'volvox_microarray_line',
    rendering: undefined,
    pivot: undefined,
  },
] as const

interface Stats {
  differing: number
  total: number
  meanDelta: number
  maxDelta: number
  // Of the differing pixels, how many sit on a HORIZONTAL run and how many on a
  // vertical one. That split is the whole point: a bar's top cut is horizontal
  // and its sides are vertical, so "did the tops move" and "did the sides move"
  // are two different findings and a single count cannot tell them apart. A
  // pixel is called horizontal when its left or right neighbour also differs
  // and neither vertical neighbour does, and vertical for the mirror case.
  horizontal: number
  vertical: number
  diffImage: Uint8Array
}

// Per-channel absolute difference over the pixels that differ at all. The mean
// is over DIFFERING pixels, not over the image: an image where 0.08% of pixels
// moved by 89 and an image where 8% moved by 1 are not the same finding, and a
// mean over the whole frame reports them as the same small number.
function compare(a: Uint8Array, b: Uint8Array): Stats {
  // @ts-expect-error pngjs accepts a Uint8Array at runtime — same cast
  // `pngDiff.ts` makes, and for the same reason: puppeteer's screenshot and
  // node's readFileSync disagree with @types/pngjs about Buffer.
  const pa = PNG.sync.read(a)
  // @ts-expect-error pngjs accepts a Uint8Array at runtime
  const pb = PNG.sync.read(b)
  if (pa.width !== pb.width || pa.height !== pb.height) {
    throw new Error(
      `size mismatch: ${pa.width}x${pa.height} vs ${pb.width}x${pb.height}`,
    )
  }
  const { width, height } = pa
  const delta = new Uint8Array(width * height)
  let differing = 0
  let sum = 0
  let maxDelta = 0
  for (let p = 0; p < width * height; p++) {
    const i = p * 4
    let d = 0
    for (let c = 0; c < 4; c++) {
      d = Math.max(d, Math.abs(pa.data[i + c]! - pb.data[i + c]!))
    }
    delta[p] = d
    if (d > 0) {
      differing++
      sum += d
      maxDelta = Math.max(maxDelta, d)
    }
  }
  const diff = new PNG({ width, height })
  let horizontal = 0
  let vertical = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      const di = p * 4
      diff.data[di + 3] = 255
      if (delta[p] === 0) {
        continue
      }
      const left = x > 0 && delta[p - 1]! > 0
      const right = x < width - 1 && delta[p + 1]! > 0
      const up = y > 0 && delta[p - width]! > 0
      const down = y < height - 1 && delta[p + width]! > 0
      const runsX = left || right
      const runsY = up || down
      if (runsX && !runsY) {
        horizontal++
        // horizontal runs magenta, vertical runs green, ambiguous white
        diff.data[di] = 255
        diff.data[di + 2] = 255
      } else if (runsY && !runsX) {
        vertical++
        diff.data[di + 1] = 255
      } else {
        diff.data[di] = 255
        diff.data[di + 1] = 255
        diff.data[di + 2] = 255
      }
    }
  }
  return {
    differing,
    total: width * height,
    meanDelta: differing > 0 ? sum / differing : 0,
    maxDelta,
    horizontal,
    vertical,
    diffImage: PNG.sync.write(diff),
  }
}

function runDiff(dirA: string, dirB: string, outDir?: string) {
  const names = readdirSync(dirA).filter(
    f => f.endsWith('.png') && !f.endsWith('.zoom.png'),
  )
  console.log(
    'scene'.padEnd(12),
    'differing'.padStart(10),
    'pct'.padStart(8),
    'meanΔ'.padStart(7),
    'maxΔ'.padStart(6),
    'horiz'.padStart(8),
    'vert'.padStart(8),
  )
  for (const name of names.sort()) {
    // Skipped rather than thrown on, because the scene list moves while a set of
    // captures is being taken and a stale file on one side is not a finding —
    // but it IS a pair that went uncompared, so it is named rather than passed
    // over in silence.
    if (!existsSync(join(dirB, name))) {
      console.log(
        `${basename(name, '.png').padEnd(12)} (no counterpart in ${dirB})`,
      )
      continue
    }
    const a = readFileSync(join(dirA, name))
    const b = readFileSync(join(dirB, name))
    const s = compare(a, b)
    console.log(
      basename(name, '.png').padEnd(12),
      String(s.differing).padStart(10),
      `${((100 * s.differing) / s.total).toFixed(3)}%`.padStart(8),
      s.meanDelta.toFixed(1).padStart(7),
      String(s.maxDelta).padStart(6),
      String(s.horizontal).padStart(8),
      String(s.vertical).padStart(8),
    )
    if (outDir) {
      mkdirSync(outDir, { recursive: true })
      writeFileSync(join(outDir, name), s.diffImage)
    }
  }
}

// A crop, magnified with nearest-neighbour, so a one-device-pixel row of
// partial coverage is something a person can actually look at. Bilinear would
// invent exactly the gradient under examination.
function writeZoom(
  src: Uint8Array,
  out: string,
  x: number,
  y: number,
  w: number,
  h: number,
  scale: number,
) {
  // @ts-expect-error pngjs accepts a Uint8Array at runtime
  const p = PNG.sync.read(src)
  const z = new PNG({ width: w * scale, height: h * scale })
  for (let dy = 0; dy < h * scale; dy++) {
    for (let dx = 0; dx < w * scale; dx++) {
      const sx = Math.min(p.width - 1, x + Math.floor(dx / scale))
      const sy = Math.min(p.height - 1, y + Math.floor(dy / scale))
      const si = (sy * p.width + sx) * 4
      const di = (dy * z.width + dx) * 4
      for (let c = 0; c < 4; c++) {
        z.data[di + c] = p.data[si + c]!
      }
    }
  }
  writeFileSync(out, PNG.sync.write(z))
}

async function captureScene(
  page: Page,
  scene: (typeof SCENES)[number],
  outDir: string,
) {
  await navigateWithSessionSpec(page, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: LOC,
        tracks: [{ trackId: scene.trackId }],
      },
    ],
  })
  await waitForDataLoaded(page)
  if (scene.rendering) {
    // AFTER the first paint, not after `waitForDataLoaded`: the view's track
    // array is populated by the session load and a navigation that has finished
    // loading data can still be a frame short of having a track to reach into.
    await page.waitForSelector('[data-display-drawn="true"] canvas', {
      timeout: 60000,
    })
    await page.evaluate(rendering => {
      const w = window as any
      w.JBrowseSession.views[0].tracks[0].displays[0].setRenderingType(
        rendering,
      )
    }, scene.rendering)
    await waitForDataLoaded(page)
  }
  if (scene.pivot !== undefined) {
    await page.waitForSelector('[data-display-drawn="true"] canvas', {
      timeout: 60000,
    })
    await page.evaluate(pivot => {
      const w = window as any
      w.JBrowseSession.views[0].tracks[0].displays[0].setBicolorPivot(pivot)
    }, scene.pivot)
    await waitForDataLoaded(page)
  }
  // The canvas is repainted by an autorun that is not what `waitForDataLoaded`
  // watches, so give the frame after the last model write somewhere to land.
  await delay(2500)
  const el = await page.waitForSelector('[data-display-drawn="true"] canvas', {
    timeout: 60000,
  })
  if (!el) {
    throw new Error(`${scene.name}: no painted canvas`)
  }
  const backing = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>(
      '[data-display-drawn="true"] canvas',
    )
    return {
      dpr: window.devicePixelRatio,
      backing: c ? `${c.width}x${c.height}` : '-',
    }
  })
  const shot = await el.screenshot({ type: 'png' })
  const path = join(outDir, `${scene.name}.png`)
  writeFileSync(path, shot)
  // @ts-expect-error pngjs accepts a Uint8Array at runtime
  const png = PNG.sync.read(shot)
  console.log(
    `${scene.name.padEnd(12)} dpr ${backing.dpr}  canvas backing ${backing.backing}  capture ${png.width}x${png.height}`,
  )
  // A strip across the bar tops at 8x. The offsets are the top third of the
  // capture, where an xyplot's tall bars end.
  writeZoom(
    shot,
    join(outDir, `${scene.name}.zoom.png`),
    Math.floor(png.width * 0.1),
    0,
    220,
    Math.min(90, png.height),
    8,
  )
}

async function main() {
  if (process.argv.includes('--diff')) {
    const i = process.argv.indexOf('--diff')
    const dirA = process.argv[i + 1]
    const dirB = process.argv[i + 2]
    if (!dirA || !dirB) {
      throw new Error('--diff needs two directories')
    }
    runDiff(dirA, dirB, OUT)
    return
  }
  if (!OUT) {
    throw new Error('pass --out=<dir>')
  }
  mkdirSync(OUT, { recursive: true })
  // Pins the ladder through `appendGpuParam`, so a machine that falls back to
  // WebGL2 fails at startup instead of quietly capturing the other backend.
  snapshotConfig.backend = 'webgpu'
  const { port, server } = await startServerOnFreePort(3561)
  setPort(port)
  const browser = await launch({
    browser: 'firefox',
    executablePath: FIREFOX,
    headless: false,
    timeout: 60000,
    extraPrefsFirefox: {
      'layout.css.devPixelsPerPx': DPR.toFixed(1),
      'dom.webgpu.enabled': true,
      'gfx.webrender.all': true,
      'gfx.webgpu.ignore-blocklist': true,
    },
    defaultViewport: { width: 1280, height: 700 },
  })
  const page = await browser.newPage()
  const consoleLines: string[] = []
  page.on('console', m => {
    consoleLines.push(m.text())
  })
  try {
    for (const scene of SCENES) {
      await captureScene(page, scene, OUT)
    }
    if (!consoleLines.some(t => t.includes('WebGPU device ready'))) {
      throw new Error(
        'no "[GPU] WebGPU device ready" line — the captures are not WebGPU',
      )
    }
    console.log('backend: WebGPU (device-ready line seen)')
  } finally {
    await browser.close()
    server.close()
  }
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
