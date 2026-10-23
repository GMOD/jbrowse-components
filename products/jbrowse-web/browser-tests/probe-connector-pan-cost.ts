/* eslint-disable no-console */
// What "Pileup connectors" (`pileup.connectors`) costs a pan, A/B
// across two production builds: ADR-225's "Measured" table.
//
// Each arm is a built `products/jbrowse-web/build` served statically, so the
// probe compares any two commits: serve the build of the commit before the
// change at BASE_URL and the build after it at AFTER_URL. Two HG008-T views over
// the jbrowse.org cgiab demo data, a 120-frame pan of 3 px a frame out and
// back, connectors ON and OFF, interleaved by rep → view → arm → setting, each
// load panned once untraced before the traced pan.
//
//   main-thread ms — top-level RunTask time on the renderer main thread per
//                    frame, from a CDP trace, bucketed by the `performance.mark`
//                    each frame drops; the per-frame median is the cell
//   mutations      — MutationObserver records per frame over the document
//
// The cost of the setting is ON − OFF within an arm. Before ADR-225 the
// overlay wrote two SVG attributes per connector per frame, so the mutation
// column counts connectors; after it, a pan touches no DOM.
//
// Pin the GPU rung through CHROME_ARGS and check it in the `info` line: on a
// headless Linux box with an NVIDIA card `--use-angle=gl-egl --use-gl=angle`
// reaches hardware WebGL2, and the default flags reach none.
//
//   BASE_URL=http://localhost:8831 AFTER_URL=http://localhost:8832 \
//   CHROME_PATH=<chrome> CHROME_ARGS='--use-angle=gl-egl --use-gl=angle' \
//   node products/jbrowse-web/browser-tests/probe-connector-pan-cost.ts run 3
//
// `probe` instead of `run` loads each arm × view × setting once and writes a
// screenshot per load to OUT, the check that connectors draw at all.
import fs from 'node:fs'
import os from 'node:os'

import {
  BASE_CHROME_ARGS,
  encodeSessionSpec,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import type { Page } from 'puppeteer'

const MODE = process.argv[2] ?? 'probe'
const REPS = Number(process.argv[3] ?? 3)
const OUT = process.env.OUT ?? './connector-pan-out'
const ARMS = {
  before: process.env.BASE_URL ?? 'http://localhost:8831',
  after: process.env.AFTER_URL ?? 'http://localhost:8832',
}
type Arm = keyof typeof ARMS
const VIEW_WIDTH = 1400
const DISPLAY_HEIGHT = 500
const FRAMES = 120
const PX = 3
const LOC = 'chr3:184,709,000-184,723,000'
const ASSEMBLY = 'GRCh38_GIABv3'
const CGIAB = 'https://jbrowse.org/demos/cgiab'

function bamTrack(trackId: string, file: string) {
  const uri = `${CGIAB}/${file}`
  return {
    type: 'AlignmentsTrack',
    trackId,
    name: trackId,
    assemblyNames: [ASSEMBLY],
    adapter: {
      type: 'BamAdapter',
      fetchSizeLimit: 80_000_000,
      bamLocation: { uri, locationType: 'UriLocation' },
      index: {
        indexType: 'BAI',
        location: { uri: `${uri}.bai`, locationType: 'UriLocation' },
      },
    },
  }
}

const VIEWS = {
  illumina: {
    track: bamTrack(
      'hg008t_illumina',
      'HG008-T_Illumina_195x.sv_read_evidence_slices.bam',
    ),
    display: { unit: 'read' },
  },
  hifi: {
    track: bamTrack(
      'hg008t_hifi',
      'HG008-T_PacBio-HiFi-Revio_116x.sv_read_evidence_slices.bam',
    ),
    display: { unit: 'chain', facet: 'split' },
  },
}
type View = keyof typeof VIEWS

function appUrl(arm: Arm, view: View, on: boolean) {
  const { track, display } = VIEWS[view]
  const spec = {
    sessionTracks: [track],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: ASSEMBLY,
        loc: LOC,
        tracks: [
          {
            trackId: track.trackId,
            type: 'LinearAlignmentsDisplay',
            forceLoad: true,
            height: DISPLAY_HEIGHT,
            pileup: { connectors: { show: on } },
            ...display,
          },
        ],
      },
    ],
  }
  return `${ARMS[arm]}/?config=${encodeURIComponent(`${CGIAB}/config.json`)}&session=${encodeSessionSpec(spec)}&sessionName=bench&renderer=webgl`
}

function median(a: number[]) {
  const s = a.toSorted((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

const loadAverage = () => os.loadavg()[0]!.toFixed(2)

const browser = await launch({
  headless: true,
  executablePath: process.env.CHROME_PATH,
  args: [
    ...BASE_CHROME_ARGS,
    '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    ...(process.env.CHROME_ARGS ?? '').split(/\s+/).filter(Boolean),
  ],
})

interface WindowWithSession {
  JBrowseSession: {
    views: {
      width: number
      horizontalScroll: (px: number) => void
      tracks: {
        displays: {
          connectorsByGroup?: Map<string, { overlayPairs: unknown[] }>
        }[]
      }[]
    }[]
  }
  jb: { waitReady: (ms: number) => Promise<unknown> }
}

async function openPage(
  arm: Arm,
  view: View,
  on: boolean,
  viewportWidth: number,
) {
  const page = await browser.newPage()
  await page.setViewport({ width: viewportWidth, height: 1100 })
  await page.goto(appUrl(arm, view, on), {
    waitUntil: 'load',
    timeout: 120_000,
  })
  await page.waitForFunction(
    () => {
      const w = window as unknown as Partial<WindowWithSession>
      return w.jb?.waitReady && w.JBrowseSession?.views[0]
    },
    { timeout: 120_000 },
  )
  await page.evaluate(() =>
    (window as unknown as WindowWithSession).jb.waitReady(1500),
  )
  await page.waitForSelector('[data-display-drawn="true"]', {
    timeout: 120_000,
  })
  await new Promise(r => setTimeout(r, 1500))
  const info = await page.evaluate(() => {
    const v = (window as unknown as WindowWithSession).JBrowseSession.views[0]!
    const d = v.tracks[0]!.displays[0]!
    let connectors = 0
    for (const g of d.connectorsByGroup?.values() ?? []) {
      connectors += g.overlayPairs.length
    }
    const gl = document.createElement('canvas').getContext('webgl2')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    return {
      viewWidth: v.width,
      connectors,
      svgConnectors: document.querySelectorAll(
        '[data-testid="pileup-bezier-arc"]',
      ).length,
      gpu: ext
        ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL))
        : 'no webgl2',
    }
  })
  return { page, info }
}

// One horizontalScroll per animation frame; each frame drops a mark the trace
// buckets main-thread tasks by, and reads the mutations since the last.
function pan(page: Page) {
  return page.evaluate(
    (frames, px) =>
      new Promise<{ ts: number[]; muts: number[] }>(resolve => {
        const v = (window as unknown as WindowWithSession).JBrowseSession
          .views[0]!
        let delivered = 0
        const mo = new MutationObserver(r => {
          delivered += r.length
        })
        mo.observe(document.documentElement, {
          subtree: true,
          attributes: true,
          childList: true,
          characterData: true,
        })
        const ts: number[] = []
        const muts: number[] = []
        let i = 0
        function step(t: number) {
          ts.push(t)
          muts.push(delivered + mo.takeRecords().length)
          delivered = 0
          performance.mark('panframe')
          if (i >= frames) {
            mo.disconnect()
            resolve({ ts, muts: muts.slice(1) })
            return
          }
          v.horizontalScroll(i < frames / 2 ? px : -px)
          i++
          requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }),
    FRAMES,
    PX,
  )
}

interface TraceEvent {
  name: string
  cat?: string
  ph: string
  ts: number
  dur?: number
  pid: number
  tid: number
}

function mainThreadMsPerFrame(trace: string) {
  const events = (JSON.parse(trace) as { traceEvents: TraceEvent[] })
    .traceEvents
  const marks = events.filter(
    e => e.name === 'panframe' && e.cat?.includes('blink.user_timing'),
  )
  if (marks.length < FRAMES + 1) {
    throw new Error(`only ${marks.length} frame marks in the trace`)
  }
  const { pid, tid } = marks[0]!
  const markTs = marks.map(e => e.ts).toSorted((a, b) => a - b)
  const tasks = events
    .filter(
      e =>
        e.pid === pid &&
        e.tid === tid &&
        e.ph === 'X' &&
        (e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask'),
    )
    .toSorted((a, b) => a.ts - b.ts)
  const perFrame = new Array<number>(FRAMES).fill(0)
  let nestedUntil = -1
  for (const t of tasks) {
    const end = t.ts + (t.dur ?? 0)
    if (t.ts < nestedUntil) {
      continue
    }
    nestedUntil = end
    const k = markTs.findIndex((m, j) => end >= m && end < markTs[j + 1]!)
    if (k >= 0 && k < FRAMES) {
      perFrame[k]! += (t.dur ?? 0) / 1000
    }
  }
  return perFrame
}

async function measure(
  arm: Arm,
  view: View,
  on: boolean,
  viewportWidth: number,
) {
  const loadBefore = loadAverage()
  const { page, info } = await openPage(arm, view, on, viewportWidth)
  await pan(page)
  await new Promise(r => setTimeout(r, 1000))
  await page.tracing.start({
    categories: [
      'toplevel',
      'devtools.timeline',
      'disabled-by-default-devtools.timeline',
      'blink.user_timing',
    ],
  })
  const { ts, muts } = await pan(page)
  const trace = Buffer.from((await page.tracing.stop())!).toString('utf8')
  await page.close()
  return {
    arm,
    view,
    on,
    load: `${loadBefore}→${loadAverage()}`,
    info,
    mainMs: median(mainThreadMsPerFrame(trace)),
    mutations: median(muts),
    frameMs: median(ts.slice(1).map((t, i) => t - ts[i]!)),
  }
}

// The view is narrower than the viewport by the chrome around it, so size the
// viewport until the view itself is VIEW_WIDTH.
const { page: calibration, info: calibrated } = await openPage(
  'after',
  'illumina',
  false,
  VIEW_WIDTH,
)
await calibration.close()
const viewportWidth = 2 * VIEW_WIDTH - calibrated.viewWidth
console.log(
  JSON.stringify({ chrome: await browser.version(), gpu: calibrated.gpu }),
)

fs.mkdirSync(OUT, { recursive: true })
const arms = Object.keys(ARMS) as Arm[]
const views = Object.keys(VIEWS) as View[]
if (MODE === 'probe') {
  for (const view of views) {
    for (const arm of arms) {
      for (const on of [true, false]) {
        const { page, info } = await openPage(arm, view, on, viewportWidth)
        await page.screenshot({
          path: `${OUT}/${view}-${arm}-${on ? 'on' : 'off'}.png`,
        })
        console.log(JSON.stringify({ arm, view, on, info }))
        await page.close()
      }
    }
  }
} else {
  const results: ({ rep: number } & Awaited<ReturnType<typeof measure>>)[] = []
  for (let rep = 0; rep < REPS; rep++) {
    for (const view of views) {
      for (const arm of arms) {
        for (const on of [true, false]) {
          const r = { rep, ...(await measure(arm, view, on, viewportWidth)) }
          results.push(r)
          console.log(JSON.stringify(r))
        }
      }
    }
  }
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1))
  const pick = (
    view: View,
    arm: Arm,
    on: boolean,
    key: 'mainMs' | 'mutations',
  ) =>
    median(
      results
        .filter(r => r.view === view && r.arm === arm && r.on === on)
        .map(r => r[key]),
    )
  console.table(
    views.flatMap(view =>
      arms.map(arm => ({
        view,
        arm,
        connectors: results.find(r => r.view === view && r.arm === arm && r.on)
          ?.info.connectors,
        mainMsOnMinusOff:
          pick(view, arm, true, 'mainMs') - pick(view, arm, false, 'mainMs'),
        mutationsOn: pick(view, arm, true, 'mutations'),
        mutationsOff: pick(view, arm, false, 'mutations'),
      })),
    ),
  )
}
await browser.close()
