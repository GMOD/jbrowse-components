/* eslint-disable no-console */
// The probe behind the `amplicon-depth-gate`, `amplicon-depth-force-load` and
// `amplicon-depth-raised-limit` records
// (agent-docs/reference/REGION_TOO_LARGE.md). Their `source.repro`
// says how the SARS-CoV-2 BAM, CSI and CRAM files are made; put them and a
// config naming their tracks under `test_data/amplicon-depth/`, build
// jbrowse-web, then from products/jbrowse-web:
//
//   PLAN='[{"kind":"gate","track":"bai-50k","loc":"NC_045512.2:7001-9000"},
//          {"kind":"force","track":"bai-50k","loc":"NC_045512.2:1-29903","rep":1}]' \
//     OUT=/tmp/amplicon.jsonl node browser-tests/probe-amplicon-depth.ts
//
// `gate` reads the display's byte estimate, budget and phase once the app is
// ready. `force` presses force-load on the banner and times the first drawn
// display, sampling worker JS heap over CDP and every Chrome process's Pss
// from /proc (Linux only). One browser per step, so no step reads another's
// HTTP cache or worker state.
import { appendFileSync, readFileSync, readdirSync } from 'node:fs'

import {
  BASE_CHROME_ARGS,
  encodeSessionSpec,
} from '@jbrowse/browser-test-utils'
import puppeteer from 'puppeteer'

import { startServerOnFreePort } from './server.ts'

import type { CDPSession, Page } from 'puppeteer'

interface Step {
  kind: 'gate' | 'force'
  track: string
  loc: string
  rep?: number
}

interface LiveDisplay {
  displayPhase: string
  regionTooLarge: boolean
  byteEstimate?: { bytes: number; measuredSpanBp: number }
  resolvedByteLimit: () => number | undefined
  error?: unknown
  forceLoad: () => void
}

interface LiveWindow {
  JBrowseSession: {
    views: {
      width: number
      bpPerPx: number
      tracks: { displays: LiveDisplay[] }[]
    }[]
  }
  ampliconTimes: Record<string, number>
}

const plan: Step[] = JSON.parse(process.env.PLAN ?? '[]')
const OUT = process.env.OUT ?? '/tmp/amplicon.jsonl'
const CONFIG = 'test_data/amplicon-depth/config.json'
const LOAD_TIMEOUT = Number(process.env.LOAD_TIMEOUT ?? 900000)
const MiB = 1048576

function descendants(root: number) {
  const parent = new Map<number, number>()
  for (const d of readdirSync('/proc')) {
    if (/^\d+$/.test(d)) {
      try {
        const stat = readFileSync(`/proc/${d}/stat`, 'utf8')
        const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1])
        parent.set(Number(d), ppid)
      } catch {}
    }
  }
  const out = [root]
  for (let i = 0; i < out.length; i++) {
    for (const [pid, pp] of parent) {
      if (pp === out[i]) {
        out.push(pid)
      }
    }
  }
  return out
}

function pssKb(pid: number) {
  try {
    const m = /^Pss:\s+(\d+)/m.exec(
      readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8'),
    )
    return m ? Number(m[1]) : 0
  } catch {
    return 0
  }
}

function isRenderer(pid: number) {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes(
      '--type=renderer',
    )
  } catch {
    return false
  }
}

function readDisplay(page: Page) {
  return page.evaluate(() => {
    const view = (window as unknown as LiveWindow).JBrowseSession.views[0]
    const display = view?.tracks[0]?.displays[0]
    const els = [
      ...document.querySelectorAll<HTMLElement>('[data-display-phase]'),
    ]
    return {
      phase: display?.displayPhase,
      tooLarge: display?.regionTooLarge,
      estimate: display?.byteEstimate?.bytes,
      measuredSpanBp: display?.byteEstimate?.measuredSpanBp,
      limit: display?.resolvedByteLimit(),
      error: display?.error ? String(display.error) : undefined,
      visibleBp: view ? Math.round(view.width * view.bpPerPx) : undefined,
      domPhases: els.map(e => e.dataset.displayPhase),
      domDrawn: els.map(e => e.dataset.displayDrawn),
    }
  })
}

async function waitAppReady(page: Page, trackId: string) {
  await page.waitForFunction(
    (id: string) => {
      const m = document.querySelector('[data-testid="app-ready-marker"]')
      return (
        m instanceof HTMLElement &&
        m.dataset.appPhase === 'ready' &&
        (JSON.parse(m.dataset.appTracks ?? '[]') as string[]).includes(id) &&
        document.querySelector('[data-display-phase]') !== null &&
        document.querySelector('[data-display-phase="loading"]') === null &&
        document.querySelector('[data-testid="loading-overlay"]') === null
      )
    },
    { timeout: LOAD_TIMEOUT, polling: 250 },
    trackId,
  )
}

function rendererName(page: Page) {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    return gl && ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      : 'none'
  })
}

function startMemorySampler(rootPid: number, workers: Map<string, CDPSession>) {
  const heap = new Map<string, number>()
  const pending = new Set<string>()
  const peak = { heapSum: 0, heapOne: 0, rendererKb: 0, treeKb: 0, samples: 0 }
  const sample = () => {
    for (const [id, s] of workers) {
      if (!pending.has(id)) {
        pending.add(id)
        s.send('Runtime.getHeapUsage')
          .then(u => {
            peak.samples++
            heap.set(id, u.usedSize)
            peak.heapSum = Math.max(
              peak.heapSum,
              [...heap.values()].reduce((a, b) => a + b, 0),
            )
            peak.heapOne = Math.max(peak.heapOne, u.usedSize)
          })
          .catch(() => {})
          .finally(() => pending.delete(id))
      }
    }
    let tree = 0
    let renderer = 0
    for (const p of descendants(rootPid)) {
      const kb = pssKb(p)
      tree += kb
      renderer = isRenderer(p) ? Math.max(renderer, kb) : renderer
    }
    peak.treeKb = Math.max(peak.treeKb, tree)
    peak.rendererKb = Math.max(peak.rendererKb, renderer)
  }
  const timer = setInterval(sample, 250)
  return {
    stop: () => {
      sample()
      clearInterval(timer)
      return peak
    },
  }
}

async function forceLoadAndTime(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as LiveWindow
    const rec: Record<string, number> = {}
    w.ampliconTimes = rec
    const check = () => {
      const now = performance.now() - (rec.t0 ?? 0)
      const drawn = document.querySelector('[data-display-drawn="true"]')
      if (rec.firstPaint === undefined && drawn) {
        rec.firstPaint = now
      }
      if (
        rec.settled === undefined &&
        drawn &&
        !document.querySelector(
          '[data-display-drawn="false"],[data-display-phase="loading"],[data-display-phase="tooLarge"],[data-testid="loading-overlay"]',
        )
      ) {
        rec.settled = now
      }
      if (
        rec.terminal === undefined &&
        document.querySelector(
          '[data-display-phase="error"],[data-display-phase="renderError"]',
        )
      ) {
        rec.terminal = now
      }
    }
    new MutationObserver(check).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-display-drawn', 'data-display-phase'],
    })
    rec.t0 = performance.now()
    check()
    const display = w.JBrowseSession.views[0]?.tracks[0]?.displays[0]
    if (display?.regionTooLarge) {
      display.forceLoad()
      rec.forced = 1
    }
  })
  const deadline = Date.now() + LOAD_TIMEOUT
  let rec: Record<string, number> = {}
  while (
    Date.now() < deadline &&
    rec.settled === undefined &&
    rec.terminal === undefined
  ) {
    await new Promise(r => setTimeout(r, 500))
    rec = await page.evaluate(
      () => (window as unknown as LiveWindow).ampliconTimes,
    )
  }
  return rec
}

async function runOne(step: Step, port: number) {
  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 1200000,
    args: [...BASE_CHROME_ARGS, '--window-size=1400,900'],
  })
  const rootPid = browser.process()?.pid ?? 0
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 800 })
  const events: string[] = []
  page.on('error', e => events.push(`page error: ${String(e)}`))
  page.on('pageerror', e =>
    events.push(`pageerror: ${String(e).slice(0, 300)}`),
  )

  const workers = new Map<string, CDPSession>()
  const client = await page.createCDPSession()
  await client.send('Target.setAutoAttach', {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: true,
  })
  client.on('Target.attachedToTarget', ({ targetInfo, sessionId }) => {
    const s = client.connection()?.session(sessionId)
    if (targetInfo.type === 'worker' && s) {
      workers.set(targetInfo.targetId, s)
      void s.send('Runtime.enable').catch(() => {})
    }
  })
  client.on('Target.detachedFromTarget', ({ targetId }) => {
    if (targetId !== undefined && workers.delete(targetId)) {
      events.push(`worker detached ${targetId}`)
    }
  })

  const spec = {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'SARS-CoV-2',
        loc: step.loc,
        tracks: [step.track],
      },
    ],
  }
  const sampler =
    step.kind === 'force' ? startMemorySampler(rootPid, workers) : undefined
  const result: Record<string, unknown> = { ...step }
  const tNav = Date.now()
  try {
    await page.goto(
      `http://localhost:${port}/?config=${CONFIG}&session=${encodeSessionSpec(spec)}&sessionName=amp`,
      { waitUntil: 'domcontentloaded', timeout: 120000 },
    )
    await waitAppReady(page, step.track)
    result.navToSettledMs = Date.now() - tNav
    result.renderer = await rendererName(page)
    result.before = await readDisplay(page)
    if (sampler) {
      const rec = await forceLoadAndTime(page)
      const peak = sampler.stop()
      result.forced = rec.forced === 1
      result.firstPaintMs = rec.firstPaint
      result.settledMs = rec.settled
      result.terminalMs = rec.terminal
      result.peakWorkerHeapSumMiB = Math.round(peak.heapSum / MiB)
      result.peakWorkerHeapOneMiB = Math.round(peak.heapOne / MiB)
      result.peakRendererPssMiB = Math.round(peak.rendererKb / 1024)
      result.peakTreePssMiB = Math.round(peak.treeKb / 1024)
      result.heapSamples = peak.samples
      result.workers = workers.size
      result.after = await readDisplay(page)
    }
  } catch (e) {
    sampler?.stop()
    result.exception = String(e).slice(0, 500)
  }
  result.events = events.slice(0, 20)
  await browser.close().catch(() => {})
  appendFileSync(OUT, `${JSON.stringify(result)}\n`)
  console.log(JSON.stringify(result))
}

const { server, port } = await startServerOnFreePort(3471)
for (const step of plan) {
  await runOne(step, port)
}
server.close()
process.exit(0)
