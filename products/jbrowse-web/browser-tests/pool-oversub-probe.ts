/* eslint-disable no-console */
// Does the per-context inflate pool actually HURT, or is it just untidy?
//
// percontext-probe.ts counted the multiplication: N RPC workers each spawn their
// own pool, so five bgzip tracks is 20 inflate workers. Whether 20 is too many
// depends on cores, and on a 16-core box it plainly is not — 26 threads on 16 is
// nothing. The case that would hurt is a laptop: 4 cores gives 3 RPC workers x 4
// = 12 inflate workers, ~4x oversubscribed.
//
// The counterfactual is normally "one shared pool", which does not exist yet. But
// `configuration.rpc.workerCount` gives a usable stand-in TODAY: at 1 there is a
// single RPC worker and therefore a single pool of 4, with all N tracks sharing
// it — which is what a shared pool would look like from the inflate side.
//
// The stand-in is NOT free, and the direction of its bias is what makes this
// worth running. workerCount=1 also serializes every track's PARSE onto one
// thread (ARCHITECTURAL_LIMITS "Worker assignment is sticky per adapter"), so it
// carries a handicap a real shared pool would not. If it still wins under a
// constrained core count, oversubscription is real and dominates. If it loses,
// that is not evidence either way — the handicap could be what lost it.
//
// Run it under taskset to fake a laptop:
//   taskset -c 0-3 node browser-tests/pool-oversub-probe.ts
// and interleave the arms rather than running all of one then all of the other.
// taskset works for this: Chrome reports the affinity-limited count, so
// hardwareConcurrency really does read 4 and both pool sizes adapt to it.
//
// ## What it found, 2026-08-12 — the oversubscription does NOT cost latency
//
// 4 cores, 5 no-MD tracks, wall to all five displays painted, min of 3:
//
//   arm                                  rpc  inflate   reps              min
//   today (build 1)                        3       12   2587 2895 2586   2586
//   today (build 2, identical code)        3       12   3684 3579 2984   2984
//   workerCount=1 (one pool, shared)       1        4   3656 2759 3570   2759
//   pool capped to 1 per context           3        3   3382 3514 6108   3382
//
// **Read the two `today` rows before reading anything else.** They are the same
// code built twice and they differ by 15%, which is larger than every gap
// between arms. This box runs at a load average the BENCHMARKING.md doctrine
// warns about, and three reps do not get under it.
//
// So the honest finding is a negative one: NO arm beat the status quo, and
// nothing here supports the idea that 12 inflate workers on 4 cores costs
// anything. Cutting them to 3 was slower in every batch. What that says is that
// per-chunk parallelism is worth more than avoiding oversubscription — the pool
// exists to split ONE chunk across workers, and starving it of that hurts more
// than the extra threads do.
//
// It also lowers the risk of the shared-pool work rather than raising it. The
// fear was that one shared pool of 4 would regress the several-tracks case;
// the `pool capped to 1` arm is strictly worse than that (3 threads AND no
// per-chunk parallelism) and it only cost ~13%, inside the drift. A shared pool
// that keeps per-chunk parallelism should land at parity.
//
// The live argument for sharing is therefore MEMORY, not speed: 20 grow-only
// wasm heaps that nothing tears down. That is not measured here and the JS heap
// counters will not show it — WebAssembly.Memory is outside Runtime.getHeapUsage.
//
// Env: CONFIG, ASSEMBLY, LOC, TRACKS, HEADLESS=0.
import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

import { launchProfilingBrowser } from './memHelpers.ts'
import { startServerOnFreePort } from './server.ts'

import type { CDPSession, Page } from 'puppeteer'

const CONFIG =
  process.env.CONFIG || 'test_data/jb2bench_link/seqfetch_config.json'
const ASSEMBLY = process.env.ASSEMBLY || 'hg19mod'
const LOC = process.env.LOC || 'chr22_mask:100000..110000'
const TRACKS = Number(process.env.TRACKS || 5)

async function trackWorkersDeep(page: Page) {
  const seen = new Map<string, string>()
  const attach = async (client: CDPSession) => {
    await client
      .send('Target.setAutoAttach', {
        autoAttach: true,
        waitForDebuggerOnStart: false,
        flatten: true,
      })
      .catch(() => {})
    client.on('Target.attachedToTarget', ({ targetInfo, sessionId }) => {
      if (targetInfo.type !== 'worker' && targetInfo.type !== 'shared_worker') {
        return
      }
      const session = client.connection()?.session(sessionId)
      if (session) {
        seen.set(targetInfo.targetId, targetInfo.url)
        void attach(session)
      }
    })
  }
  await attach(await page.createCDPSession())
  return seen
}

const { server, port } = await startServerOnFreePort(3430)
const { browser, page } = await launchProfilingBrowser()
const seen = await trackWorkersDeep(page)

const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: ASSEMBLY,
      loc: LOC,
      tracks: Array.from({ length: TRACKS }, (_, i) => `nomd${i + 1}`),
    },
  ],
}

// Timed from the navigation rather than from first paint: what a reader waits
// for is the whole thing, and the pool is only one term in it. No artificial
// settle sleep in the timed section, or the sleep is what gets measured.
//
// The readiness signal is `data-display-drawn`, counted to TRACKS — NOT "zero
// loading overlays", which is true before anything has mounted and so returns
// instantly (measured: 190ms and no tracks open, which is what sent this
// looking for the right signal). ADR-065; jbrowse-web/CLAUDE.md says the same.
const t0 = performance.now()
await page.goto(
  `http://localhost:${port}/?config=${CONFIG}&session=${encodeSessionSpec(spec)}&sessionName=PoolOversub`,
  { waitUntil: 'load', timeout: 300000 },
)
const painted = await page
  .waitForFunction(
    n =>
      document.querySelectorAll(
        '[data-testid="pileup-display"][data-display-drawn="true"]',
      ).length >= n,
    { timeout: 300000, polling: 100 },
    TRACKS,
  )
  .then(() => true)
  .catch(() => false)
const wall = performance.now() - t0

const cores = await page.evaluate(() => navigator.hardwareConcurrency)
const view = await page
  .evaluate(
    () =>
      (
        window as unknown as {
          JBrowseSession?: { views?: { tracks: unknown[] }[] }
        }
      ).JBrowseSession?.views?.[0]?.tracks.length ?? -1,
  )
  .catch(() => -1)

const workers = [...seen.values()]
const pool = workers.filter(u => u.startsWith('blob:')).length
const rpc = workers.length - pool

console.log(
  `cores=${cores} tracks=${view}/${TRACKS} painted=${painted} rpc=${rpc} pool=${pool} wall=${wall.toFixed(0)}ms`,
)
if (view !== TRACKS || !painted) {
  console.log(
    'WARNING: not every track painted — the number above is not comparable',
  )
}

await browser.close()
server.close()
