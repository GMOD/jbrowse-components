/* eslint-disable no-console */
// What Hi-C's buffered static-block fetch costs per frame, on a real deep
// `.hic` and a real GPU.
//
// Since the 2026-08-21 absolute-coordinates rewrite the display fetches
// `staticBlocks.contentBlocks` rather than the exact visible span, so a pan
// inside the loaded blocks is a pure redraw and no RPC goes out. The blocks are
// 800 CSS px on a grid, so they cover up to a block more than the window at
// each end — 1.51x the visible span at a 1588 px canvas. Contacts grow with
// span squared, and every contact is an instanced quad whose vertices the
// rasterizer runs whether or not its fragments land on screen. That was the
// worry; this is the number.
//
// **Measured 2026-08-22, Rao 2014 HMEC combined (7.6 GB, hg19), 1588x300
// canvas, 40 frames per locus, three runs of each arm interleaved.** `n` is
// contacts drawn per frame, `ms` the median frame interval across the run;
// vsync here is 16.7.
//
//   WebGL2 rung, Intel UHD 630 integrated
//     span     binsize   exact-visible n         ms      buffered n        ms
//     500 kb     5000        2,338     16.6-16.7            6,358   16.6-16.7
//     2 Mb       5000       36,820     16.7                64,231   16.4-16.7
//     10 Mb     10000      124,108     16.6-16.9          225,503   16.6-16.9
//     50 Mb     50000      318,024     17.3-17.9          609,913   27.0-27.4
//     chr1     250000      396,234     19.0-20.3          396,234   19.2-20.8
//
//   WebGPU rung, AMD RDNA-1 discrete: the same five zooms and both arms sit at
//   16.4-16.9, so that table would be one number repeated twenty times. What
//   moves there is GPU time rather than the frame — `submit→done` at the 50 Mb
//   zoom ran 7.8-8.7 ms on 318,024 contacts against 9.6-13.5 ms on 609,913 —
//   and the frame absorbs it.
//
// **So the buffer holds the frame on WebGPU and does not on WebGL2 at the
// deepest zoom**: 60 fps to ~37 while panning, on the one row where the extra
// contacts are counted in hundreds of thousands. Every other zoom holds vsync
// on both rungs and both arms.
//
// **The whole-chromosome row is the control**: at that zoom the view covers the
// displayed region, so the static blocks ARE the visible span and both arms
// draw the same 396,234 contacts. They score the same, run for run, which is
// what says the 50 Mb row measured the instance count and not the arm.
//
// Re-run this before reopening the question; these are the numbers a change has
// to beat. `--exact-visible` needs two lines the tree does not carry, in
// `LinearHicDisplay`'s `prepare` — that arm exists to be measured against, not
// to ship:
//
//     const blocks =
//       typeof window !== 'undefined' &&
//       window.location.search.includes('hicExactVisible=1')
//         ? self.lgv.dynamicBlocks.contentBlocks
//         : self.lgv.staticBlocks.contentBlocks
//
// The signature above it still reads `staticBlocks`, deliberately: that keeps
// the pan a pure redraw in both arms, so what is compared is the vertex count
// and nothing else. The display that arm emulates refetched on every pan, which
// is the cost the buffer bought off and is not what this measures.
//
// `--exact-visible` refuses to run unless a BUILT bundle mentions that query
// param (`assertBuildCarriesSwitch` below), because the edit-but-forgot-to-build
// case is the one that lies: both arms fetch the static blocks and the run
// reports no cost.
//
// TRAPS
//
//  - **Headless Chrome does not pick the machine's GPU on its own**, it picks
//    SwiftShader, on which a vertex-cost measurement means nothing.
//    `--use-gl=angle` is what makes it real (runner.ts `--real-gpu` says the
//    same). With it, this machine's ladder lands on **WebGPU** — a different
//    GPU from the one the WebGL2 rung gets, which is why `--backend=webgl` is a
//    second measurement and not a second opinion.
//  - **A `draw` call returning is not the GPU running it.** WebGPU records into
//    a command buffer and submits; the work happens later, so the GPU-time
//    column is `queue.onSubmittedWorkDone()` timed from the submit. It is an
//    upper bound carrying the promise's own task latency, and it is noisy below
//    a few hundred thousand instances — the 2,338-contact row ranged 2.3-5.0 ms
//    across runs. Read it at the top of the range or not at all; the frame
//    interval is the column that reproduces.
//  - **`gl.finish()` is not that sync.** On the WebGL2 rung it returned in
//    ~0.1 ms whether the draw carried 6 thousand instances or 610 thousand, so
//    there is no GPU-time column there and the frame interval is the
//    measurement — which is the user-visible quantity anyway.
//  - **A pan that leaves the loaded blocks refetches**, which is a different
//    measurement. The pan here oscillates one pixel around where it started.
//  - The first frame after a navigation builds pipelines; every arm discards
//    one frame before counting.
//  - The config this loads streams a 7.6 GB file from UCSC. That is deliberate
//    — the committed `test.hic` is 5 MB and answers nothing about a deep map —
//    and it is why this is a hand-run probe rather than a suite.
//
//     node browser-tests/probe-hic-buffered-vertex-cost.ts [frames] \
//       [--backend=webgl] [--exact-visible]
import fs from 'node:fs'
import path from 'node:path'

import {
  BASE_CHROME_ARGS,
  displayPainted,
  encodeSessionSpec,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import {
  navigateToUrl,
  setPort,
  waitForDataLoaded,
  waitForDisplayPaint,
} from './helpers.ts'
import { buildPath, startServerOnFreePort } from './server.ts'
import { snapshotConfig } from './snapshot.ts'

import type { Page } from 'puppeteer'

const FRAMES = Number(process.argv[2] ?? 40)
const CONFIG = 'extra_test_data/hic_deep_remote.json'
// `--backend=webgl` pins the WebGL2 rung, which on this machine is a different
// GPU from the one WebGPU picks — the integrated part rather than the discrete
// one.
const BACKEND = process.argv.includes('--backend=webgl') ? 'webgl' : ''
// The query param the switch reads, and the string the bundle is checked for —
// one spelling, so a rename of the flag cannot leave the check looking for the
// old one.
const MARKER = 'hicExactVisible'
// Needs the two-line `hicExactVisible` switch quoted above. Without it in the
// build the flag changes nothing and both arms measure the same thing — two
// buffered runs read as a comparison that found no cost, which is the wrong
// answer rather than a missing one, so `assertBuildCarriesSwitch` refuses the
// run instead.
const EXACT_VISIBLE = process.argv.includes('--exact-visible')

// The bundle, not the source: the switch is a local edit that has to have been
// BUILT, and the failure this catches is exactly a tree with the two lines in
// it and a `build/` from before them.
function assertBuildCarriesSwitch() {
  const js = path.join(buildPath, 'static', 'js')
  const bundled =
    fs.existsSync(js) &&
    fs
      .readdirSync(js)
      .filter(f => f.endsWith('.js'))
      .some(f => fs.readFileSync(path.join(js, f), 'utf8').includes(MARKER))
  if (!bundled) {
    throw new Error(
      `--exact-visible, but no bundle under ${js} mentions \`${MARKER}\`. ` +
        `That switch is a local edit to LinearHicDisplay's \`prepare\` (quoted ` +
        `at the top of this file) and it has to be built: ` +
        `pnpm --filter @jbrowse/web build. Without it both arms fetch the ` +
        `static blocks and the comparison reports no cost, whatever the ` +
        `contacts column says.`,
    )
  }
}

// One mappable locus on hg19 chr1's p-arm at five zooms. NOT the chromosome
// midpoint, which is the centromere and reports no contacts at any binsize.
const LOCI = [
  'chr1:29,750,000..30,250,000',
  'chr1:29,000,000..31,000,000',
  'chr1:25,000,000..35,000,000',
  'chr1:5,000,000..55,000,000',
  'chr1:1..249,250,621',
]

// Patch the draw and submit paths in the page, so the shipped renderer is
// measured as it runs. Both WebGPU and WebGL2 are patched: which rung the
// ladder lands on is a property of the machine, not of this probe.
async function installProbe(page: Page) {
  await page.evaluateOnNewDocument(() => {
    const w = window as any
    w.__hicProbe = { draws: [] as number[], submits: [] as number[] }
    const passProto = w.GPURenderPassEncoder?.prototype
    if (passProto) {
      const origDraw = passProto.draw
      passProto.draw = function (
        vertexCount: number,
        instanceCount = 1,
        ...rest: unknown[]
      ) {
        w.__hicProbe.draws.push(instanceCount)
        return origDraw.call(this, vertexCount, instanceCount, ...rest)
      }
    }
    const queueProto = w.GPUQueue?.prototype
    if (queueProto) {
      const origSubmit = queueProto.submit
      queueProto.submit = function (buffers: unknown[]) {
        const t0 = performance.now()
        const r = origSubmit.call(this, buffers)
        void this.onSubmittedWorkDone().then(() => {
          w.__hicProbe.submits.push(performance.now() - t0)
        })
        return r
      }
    }
    const glProto = w.WebGL2RenderingContext?.prototype
    if (glProto) {
      const origGl = glProto.drawArraysInstanced
      glProto.drawArraysInstanced = function (
        mode: number,
        first: number,
        count: number,
        instanceCount: number,
      ) {
        w.__hicProbe.draws.push(instanceCount)
        return origGl.call(this, mode, first, count, instanceCount)
      }
    }
  })
}

interface PanResult {
  frameIntervals: number[]
  drawInstances: number[]
  submitToDone: number[]
}

async function panArm(page: Page, frames: number): Promise<PanResult> {
  return page.evaluate(async frames => {
    const w = window as any
    const view = w.JBrowseSession.views[0]
    const nextFrame = () =>
      new Promise<number>(resolve => requestAnimationFrame(resolve))
    await nextFrame()
    w.__hicProbe.draws.length = 0
    w.__hicProbe.submits.length = 0
    const intervals: number[] = []
    let prev = performance.now()
    for (let i = 0; i < frames; i++) {
      // oscillate, so every frame is a state change and the window never leaves
      // the loaded static blocks
      view.horizontalScroll(i % 2 === 0 ? 1 : -1)
      await nextFrame()
      const now = performance.now()
      intervals.push(now - prev)
      prev = now
    }
    // let the last frames' onSubmittedWorkDone promises land
    await new Promise(resolve => setTimeout(resolve, 200))
    return {
      frameIntervals: intervals,
      drawInstances: w.__hicProbe.draws.slice(),
      submitToDone: w.__hicProbe.submits.slice(),
    }
  }, frames)
}

function median(xs: number[]) {
  if (xs.length === 0) {
    return Number.NaN
  }
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]!
}

async function measureLocus(page: Page, loc: string) {
  const spec = encodeSessionSpec({
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg19',
        loc,
        tracks: ['hic_deep'],
      },
    ],
  })
  await navigateToUrl(
    page,
    `config=${CONFIG}&session=${spec}&sessionName=Hic%20Probe${
      EXACT_VISIBLE ? `&${MARKER}=1` : ''
    }`,
  )
  await waitForDisplayPaint(page, displayPainted('hic-display'), 180000)
  await waitForDataLoaded(page, 180000)

  const model = await page.evaluate(() => {
    const w = window as any
    const view = w.JBrowseSession.views[0]
    const display = view.tracks[0].displays[0]
    const canvas = document.querySelector(
      '[data-testid="hic_canvas"]',
    ) as HTMLCanvasElement | null
    return {
      binsize: display.effectiveResolution,
      bpPerPx: view.bpPerPx,
      visibleBp: view.visibleBp,
      bufferedBp: view.staticBlocks.contentBlocks.reduce(
        (a: number, b: any) => a + (b.end - b.start),
        0,
      ),
      numContacts: display.rpcData?.numContacts ?? 0,
      canvas: canvas ? `${canvas.width}x${canvas.height}` : '-',
    }
  })

  const pan = await panArm(page, FRAMES)
  return { loc, ...model, ...pan }
}

async function main() {
  if (EXACT_VISIBLE) {
    assertBuildCarriesSwitch()
  }
  const { port, server } = await startServerOnFreePort(3561)
  setPort(port)
  snapshotConfig.backend = BACKEND
  const browser = await launch({
    headless: true,
    args: [...BASE_CHROME_ARGS, '--use-gl=angle'],
    defaultViewport: { width: 1600, height: 900 },
  })
  const page = await browser.newPage()
  const gpuLines: string[] = []
  page.on('console', m => {
    const t = m.text()
    if (t.includes('[GPU]')) {
      gpuLines.push(t)
    }
  })
  try {
    await installProbe(page)
    console.log(
      `frames per locus: ${FRAMES}  backend: ${BACKEND || 'default ladder'}  ` +
        `arm: ${EXACT_VISIBLE ? 'exact-visible' : 'buffered (shipped)'}`,
    )
    const rows: string[][] = []
    for (const loc of LOCI) {
      const r = await measureLocus(page, loc)
      rows.push([
        r.loc,
        String(r.binsize),
        r.bpPerPx.toFixed(0),
        String(Math.round(r.visibleBp)),
        String(Math.round(r.bufferedBp)),
        String(r.numContacts),
        String(Math.max(0, ...r.drawInstances)),
        median(r.submitToDone).toFixed(2),
        median(r.frameIntervals).toFixed(2),
        Math.max(...r.frameIntervals).toFixed(1),
        r.canvas,
      ])
    }
    console.log(`\ndevice: ${gpuLines[0] ?? 'no [GPU] line — WebGL2 rung'}`)
    console.log(
      [
        'locus',
        'binsize',
        'bpPerPx',
        'visible_bp',
        'buffered_bp',
        'contacts',
        'instances_drawn',
        'submitToDone_med_ms',
        'frame_ms_med',
        'frame_ms_max',
        'canvas',
      ].join('\t'),
    )
    for (const row of rows) {
      console.log(row.join('\t'))
    }
  } finally {
    await browser.close()
    server.close()
  }
}

await main()
