/* eslint-disable no-console */
// Count `RenderAlignmentData` RPC calls over scripted zoom and pan gestures,
// per colour mode, on a real BAM — the measure-first entry the per-base
// sub-pixel bin left open (agent-docs/measurements/per-base-zoom-refetch.json).
//
// The count is taken by wrapping `rpcManager.call` in the page, so nothing in
// the shipped bundle changes. Each call records when it was issued, when its
// stop token was stopped (`stopStopToken` revokes the token's blob URL, so a
// wrapped `URL.revokeObjectURL` sees the exact moment), how it settled, and
// the last status message the worker posted for it — the gap between the stop
// and that last message is how long extract work kept running behind a
// cancelled RPC.
//
//     pnpm --filter @jbrowse/web build
//     node browser-tests/probe-per-base-refetch.ts --fixture=trio
//     node browser-tests/probe-per-base-refetch.ts --fixture=fam --data=~/data/fam
//
// `trio` is the hosted 1000G HG02030 30x short-read slice on hg38 (needs the
// network); `fam` is a local pacbio CCS BAM served off `--data`, a directory
// holding the `config.json` / `track.bam` pair `jbrowse add-track` writes.
import http from 'node:http'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'
import handler from 'serve-handler'

import {
  delay,
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

import type { Page } from 'puppeteer'

const arg = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)

const FIXTURE = arg('fixture') ?? 'trio'
const OCTAVES = Number(arg('octaves') ?? 7)
const STEP_MS = Number(arg('cadence') ?? 200)
const ALL_MODES = ['normal', 'perBaseQuality', 'perBaseLetter'] as const
const ALL_GESTURES = [
  'stepZoomIn',
  'fastZoomIn',
  'pan',
  'cancelMidFetch',
] as const
const MODES = ALL_MODES.filter(
  m => !arg('modes') || arg('modes')!.split(',').includes(m),
)
const GESTURES = ALL_GESTURES.filter(
  g => !arg('gestures') || arg('gestures')!.split(',').includes(g),
)

type Mode = (typeof ALL_MODES)[number]
type Gesture = (typeof ALL_GESTURES)[number]

interface LiveDisplay {
  isLoading: boolean
  displayPhase: string
  regionTooLarge: boolean
  error?: unknown
}

interface LiveView {
  bpPerPx: number
  assemblyNames: string[]
  displayedRegions: { refName: string; start: number; end: number }[]
  coarseVisibleLocStrings: string
  tracks: { displays: LiveDisplay[] }[]
  zoomTo: (bpPerPx: number) => void
  horizontalScroll: (px: number) => void
  setDisplayedRegions: (regions: Record<string, unknown>[]) => void
}

interface LiveWindow {
  JBrowseSession: { views: LiveView[]; rpcManager: unknown }
}

interface CallRecord {
  issuedAt: number
  stoppedAt?: number
  settledAt?: number
  outcome?: 'ok' | 'aborted' | 'error'
  perBaseBinBp: number
  colorBy: string
  region: string
  statusAfterStop: number
  lastStatusAt?: number
}

interface RunResult {
  calls: CallRecord[]
  setupCalls: number
  anyRpc: number
  bpPerPxStart: number
  bpPerPxEnd: number
  binsSeen: number[]
}

function fixtureFor(name: string, dataUrl: string | undefined) {
  if (name === 'trio') {
    return {
      config: 'test_data/config_demo.json',
      assembly: 'hg38',
      // the slice covers chr1:40,475,861-40,529,995
      loc: 'chr1:40,478,000..40,528,000',
      navRegion: { refName: 'chr1', start: 40490000, end: 40515000 },
      trackId: 'hg02030-slice',
      sessionTracks: [
        {
          type: 'AlignmentsTrack',
          trackId: 'hg02030-slice',
          name: 'HG02030 30x slice',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: {
              uri: 'https://jbrowse.org/demos/kgp-trio/HG02030_trio_slice.bam',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/demos/kgp-trio/HG02030_trio_slice.bam.bai',
              },
            },
          },
        },
      ],
    }
  }
  if (name === 'fam') {
    if (!dataUrl) {
      throw new Error('--fixture=fam needs --data=<dir>')
    }
    return {
      config: `${dataUrl}/config.json`,
      assembly: 'ref',
      loc: 'Pinf-1306-Chr.6:1,000,000..1,065,000',
      navRegion: { refName: 'Pinf-1306-Chr.6', start: 1500000, end: 1565000 },
      trackId: 'track',
      sessionTracks: [],
    }
  }
  throw new Error(`unknown fixture ${name}`)
}

function serveDirectory(dir: string, port: number) {
  return new Promise<http.Server>((res, rej) => {
    const server = http.createServer((req, response) => {
      void handler(req, response, {
        public: dir,
        headers: [
          {
            source: '**/*',
            headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
          },
        ],
      })
    })
    server.on('error', rej)
    server.listen(port, () => {
      res(server)
    })
  })
}

async function installHook(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as {
      JBrowseRootModel: {
        rpcManager: {
          call: (
            sessionId: string,
            name: string,
            args: Record<string, unknown>,
          ) => Promise<unknown>
        }
      }
      __rpcCalls: CallRecord[]
      __rpcAny: number
      __tokens: Map<string, CallRecord>
    }
    const rm = w.JBrowseRootModel.rpcManager
    const orig = rm.call.bind(rm)
    w.__rpcCalls = []
    w.__rpcAny = 0
    w.__tokens = new Map()
    const revoke = URL.revokeObjectURL.bind(URL)
    URL.revokeObjectURL = (url: string) => {
      const rec = w.__tokens.get(url)
      if (rec && rec.stoppedAt === undefined) {
        rec.stoppedAt = performance.now()
      }
      revoke(url)
    }
    rm.call = (sessionId, name, args) => {
      w.__rpcAny++
      if (name !== 'RenderAlignmentData') {
        return orig(sessionId, name, args)
      }
      const region = (
        args.regions as { refName: string; start: number; end: number }[]
      )[0]!
      const rec: CallRecord = {
        issuedAt: performance.now(),
        perBaseBinBp: args.perBaseBinBp as number,
        colorBy:
          (args.colorBy as { type: string } | undefined)?.type ?? 'default',
        region: `${region.refName}:${region.start}-${region.end}`,
        statusAfterStop: 0,
      }
      w.__rpcCalls.push(rec)
      const token = args.stopToken
      if (typeof token === 'string') {
        w.__tokens.set(token, rec)
      }
      const statusCallback = args.statusCallback as
        | ((s: unknown) => void)
        | undefined
      const wrapped = {
        ...args,
        statusCallback: (s: unknown) => {
          rec.lastStatusAt = performance.now()
          if (rec.stoppedAt !== undefined) {
            rec.statusAfterStop++
          }
          statusCallback?.(s)
        },
      }
      const p = orig(sessionId, name, wrapped)
      p.then(
        () => {
          rec.settledAt = performance.now()
          rec.outcome = 'ok'
        },
        (e: unknown) => {
          rec.settledAt = performance.now()
          rec.outcome =
            (e as { name?: string }).name === 'AbortError' ||
            /abort/i.test(String(e))
              ? 'aborted'
              : 'error'
        },
      )
      return p
    }
  })
}

function bpPerPx(page: Page) {
  return page.evaluate(
    () => (window as unknown as LiveWindow).JBrowseSession.views[0]!.bpPerPx,
  )
}

async function gesture(
  page: Page,
  kind: Gesture,
  navRegion: { refName: string; start: number; end: number },
) {
  if (kind === 'cancelMidFetch') {
    // one octave issues a per-base refetch; replacing the displayed regions
    // 80ms into it is the `DisplayedRegionsChange` cancel, the one viewport
    // path that stops a running RPC (a scroll or zoom waits for it instead)
    const btn = await page.$('[data-testid="zoom_in"]')
    await btn?.click()
    // the bin keys off the debounced zoom, so the refetch lands ~500ms after
    // the click; in a mode that owes no refetch the wait simply expires
    await page
      .waitForFunction(
        () =>
          (window as unknown as { __rpcCalls: CallRecord[] }).__rpcCalls.some(
            c => c.settledAt === undefined,
          ),
        { timeout: 3000, polling: 10 },
      )
      .catch(() => undefined)
    await delay(80)
    await page.evaluate(region => {
      const view = (window as unknown as LiveWindow).JBrowseSession.views[0]!
      view.setDisplayedRegions([
        { ...region, assemblyName: view.assemblyNames[0] },
      ])
    }, navRegion)
  } else if (kind === 'stepZoomIn') {
    for (let i = 0; i < OCTAVES; i++) {
      const btn = await page.$('[data-testid="zoom_in"]')
      await btn?.click()
      await delay(STEP_MS)
    }
  } else if (kind === 'fastZoomIn') {
    // the slider path: one `zoomTo` per frame down the whole range in ~400ms
    await page.evaluate(async octaves => {
      const view = (window as unknown as LiveWindow).JBrowseSession.views[0]!
      const start = view.bpPerPx
      const target = start / 2 ** octaves
      const frames = 25
      for (let i = 1; i <= frames; i++) {
        view.zoomTo(start * (target / start) ** (i / frames))
        await new Promise(r => requestAnimationFrame(r))
      }
    }, OCTAVES)
  } else {
    // a drag of a screen and a half, 40px a frame, so it leaves the buffer
    await page.evaluate(async () => {
      const view = (window as unknown as LiveWindow).JBrowseSession.views[0]!
      for (let i = 0; i < 40; i++) {
        view.horizontalScroll(40)
        await new Promise(r => requestAnimationFrame(r))
      }
    })
  }
}

async function settle(page: Page, timeout = 90000) {
  const t0 = Date.now()
  for (;;) {
    const state = await page.evaluate(() => {
      const w = window as unknown as { __rpcCalls: CallRecord[] }
      const d = (window as unknown as LiveWindow).JBrowseSession.views[0]!
        .tracks[0]!.displays[0]!
      const last = w.__rpcCalls.at(-1)
      return {
        loading: d.isLoading,
        pending: w.__rpcCalls.some(c => c.settledAt === undefined),
        sinceLast: last ? performance.now() - last.issuedAt : 1e9,
        phase: d.displayPhase,
        tooLarge: d.regionTooLarge,
        calls: w.__rpcCalls.length,
        outcomes: w.__rpcCalls.map(c => c.outcome ?? 'pending'),
      }
    })
    // the fetch autorun is debounced 600ms, so a quiet page right after the
    // gesture proves nothing yet
    if (
      Date.now() - t0 > 1500 &&
      !state.loading &&
      !state.pending &&
      state.sinceLast > 2000
    ) {
      return
    }
    if (Date.now() - t0 > timeout) {
      throw new Error(`fetches never settled: ${JSON.stringify(state)}`)
    }
    await delay(250)
  }
}

async function runOne(
  page: Page,
  fixture: ReturnType<typeof fixtureFor>,
  mode: Mode,
  kind: Gesture,
): Promise<RunResult> {
  await navigateWithSessionSpec(
    page,
    {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: fixture.assembly,
          loc: fixture.loc,
          tracks: [
            {
              trackId: fixture.trackId,
              displaySnapshot: { colorBy: { type: mode } },
            },
          ],
        },
      ],
      sessionTracks: fixture.sessionTracks,
    },
    fixture.config,
  )
  await waitForDataLoaded(page, 120000)
  // the root model published at startup is not the one the session ends up
  // on, so the hook goes in only once the data is drawn, and a straggling
  // settings refetch gets its own quiet window before the gesture
  await installHook(page)
  await delay(3000)
  await settle(page)
  const bpPerPxStart = await bpPerPx(page)
  const gestureStart = await page.evaluate(() => performance.now())
  await gesture(page, kind, fixture.navRegion)
  await settle(page)
  const bpPerPxEnd = await bpPerPx(page)
  const { all, anyRpc } = await page.evaluate(() => {
    const w = window as unknown as {
      __rpcCalls: CallRecord[]
      __rpcAny: number
    }
    return { all: w.__rpcCalls, anyRpc: w.__rpcAny }
  })
  const calls = all.filter(c => c.issuedAt >= gestureStart)
  if (kind === 'cancelMidFetch' && anyRpc === 0) {
    const dbg = await page.evaluate(() => {
      const w = window as unknown as LiveWindow & {
        JBrowseRootModel: { rpcManager: { call: (...a: unknown[]) => unknown } }
      }
      const v = w.JBrowseSession.views[0]!
      const d = v.tracks[0]!.displays[0]!
      return {
        wrapped: w.JBrowseRootModel.rpcManager.call.length,
        same: w.JBrowseRootModel.rpcManager === w.JBrowseSession.rpcManager,
        loc: v.coarseVisibleLocStrings,
        regions: v.displayedRegions.map(
          r => `${r.refName}:${r.start}-${r.end}`,
        ),
        phase: d.displayPhase,
        err: String(d.error ?? ''),
      }
    })
    throw new Error(
      `the rpc hook saw nothing across a navigation — not live: ${JSON.stringify(dbg)}`,
    )
  }
  return {
    calls,
    setupCalls: all.length - calls.length,
    anyRpc,
    bpPerPxStart,
    bpPerPxEnd,
    binsSeen: [...new Set(calls.map(c => c.perBaseBinBp))],
  }
}

function summarize(r: RunResult) {
  const ok = r.calls.filter(c => c.outcome === 'ok').length
  const aborted = r.calls.filter(c => c.outcome === 'aborted').length
  const errors = r.calls.filter(c => c.outcome === 'error').length
  const overruns = r.calls
    .filter(c => c.stoppedAt !== undefined && c.lastStatusAt !== undefined)
    .map(c => c.lastStatusAt! - c.stoppedAt!)
    .filter(ms => ms > 0)
  const statusAfterStop = r.calls.reduce((a, c) => a + c.statusAfterStop, 0)
  const abortLatencies = r.calls
    .filter(c => c.outcome === 'aborted' && c.stoppedAt !== undefined)
    .map(c => c.settledAt! - c.stoppedAt!)
  return {
    calls: r.calls.length,
    ok,
    aborted,
    errors,
    statusAfterStop,
    maxOverrunMs: overruns.length ? Math.max(...overruns) : 0,
    maxAbortLatencyMs: abortLatencies.length ? Math.max(...abortLatencies) : 0,
  }
}

async function main() {
  const dataDir = arg('data')
  const dataServer =
    dataDir === undefined
      ? undefined
      : await serveDirectory(
          resolve(dataDir.replace(/^~(?=$|\/)/, homedir())),
          3581,
        )
  const fixture = fixtureFor(
    FIXTURE,
    dataServer ? 'http://localhost:3581' : undefined,
  )
  const { port, server } = await startServerOnFreePort(3571)
  setPort(port)
  const browser = await launch({
    headless: true,
    timeout: 60000,
    args: [...BASE_CHROME_ARGS, '--window-size=1280,800'],
    defaultViewport: { width: 1280, height: 800 },
  })
  const page = await browser.newPage()
  const rows: Record<string, unknown>[] = []
  try {
    console.log(
      `fixture=${FIXTURE} octaves=${OCTAVES} cadence=${STEP_MS}ms\n` +
        `${'mode'.padEnd(16)}${'gesture'.padEnd(12)}${'calls'.padStart(6)}${'ok'.padStart(4)}${'abort'.padStart(6)}${'err'.padStart(4)}${'status>stop'.padStart(12)}${'overrun'.padStart(9)}${'abortLat'.padStart(10)}  bins  bp/px  (setup calls / any rpc)`,
    )
    for (const mode of MODES) {
      for (const kind of GESTURES) {
        const r = await runOne(page, fixture, mode, kind)
        const s = summarize(r)
        rows.push({
          mode,
          gesture: kind,
          ...s,
          bins: r.binsSeen,
          bpPerPx: [r.bpPerPxStart, r.bpPerPxEnd],
        })
        console.log(
          `${mode.padEnd(16)}${kind.padEnd(12)}${String(s.calls).padStart(6)}${String(s.ok).padStart(4)}${String(s.aborted).padStart(6)}${String(s.errors).padStart(4)}${String(s.statusAfterStop).padStart(12)}${`${s.maxOverrunMs.toFixed(0)}ms`.padStart(9)}${`${s.maxAbortLatencyMs.toFixed(0)}ms`.padStart(10)}  ${r.binsSeen.join(',').padEnd(12)} ${r.bpPerPxStart.toFixed(2)} -> ${r.bpPerPxEnd.toFixed(2)}  (${r.setupCalls} / ${r.anyRpc})`,
        )
        for (const c of r.calls) {
          console.log(
            `    ${c.outcome?.padEnd(8)} t+${(c.issuedAt - r.calls[0]!.issuedAt).toFixed(0).padStart(5)}ms bin ${String(c.perBaseBinBp).padStart(3)} ${c.region}${
              c.stoppedAt !== undefined
                ? ` stopped@+${(c.stoppedAt - c.issuedAt).toFixed(0)}ms`
                : ''
            }${
              c.settledAt !== undefined
                ? ` settled@+${(c.settledAt - c.issuedAt).toFixed(0)}ms`
                : ''
            }${
              c.statusAfterStop ? ` status-after-stop ${c.statusAfterStop}` : ''
            }`,
          )
        }
      }
    }
    console.log(JSON.stringify(rows))
  } finally {
    await browser.close()
    server.close()
    dataServer?.close()
  }
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
