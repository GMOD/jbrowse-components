// Shared plumbing for the three heap/leak profilers here (memprofile, memsticky,
// memstress). They ask different questions but attach to the browser the same
// way, and each used to carry its own copy of this — including the same
// `(e: any)` / `(client as any)` casts, none of which were needed: puppeteer
// types every CDP event through devtools-protocol and `CDPSession.connection()`
// is public API.
import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import puppeteer from 'puppeteer'

import type { Browser, CDPSession, Page } from 'puppeteer'

export const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`

export const sleep = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms)
  })

// A profiling browser: real GL through ANGLE (these measure GPU-backed
// rendering, so swiftshader would be measuring the wrong thing), --expose-gc so
// forceGc actually collects, and a protocolTimeout wide enough for a heap
// snapshot of a multi-hundred-MB worker.
export async function launchProfilingBrowser(extraArgs: string[] = []) {
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS !== '0',
    protocolTimeout: 600000,
    args: [
      ...BASE_CHROME_ARGS,
      '--ignore-gpu-blocklist',
      '--use-angle=gl',
      '--use-gl=angle',
      '--window-size=1400,900',
      '--js-flags=--expose-gc',
      ...extraArgs,
    ],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 800 })
  return { browser, page } satisfies { browser: Browser; page: Page }
}

// Auto-attach to every worker target the page spawns and keep a CDP session per
// worker, so heap questions can be asked of the RPC workers and not just the
// main thread. Sessions are dropped on detach — a stale one answers every heap
// query with an error, which reads as "this worker uses no memory".
export async function setupWorkerTracking(page: Page) {
  const workerSessions = new Map<string, CDPSession>()
  const client = await page.createCDPSession()
  await client.send('Target.setAutoAttach', {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: true,
  })
  client.on('Target.attachedToTarget', ({ targetInfo, sessionId }) => {
    if (targetInfo.type === 'worker' || targetInfo.type === 'shared_worker') {
      const session = client.connection()?.session(sessionId)
      if (session) {
        workerSessions.set(targetInfo.targetId, session)
      }
    }
  })
  client.on('Target.detachedFromTarget', ({ targetId }) => {
    if (targetId !== undefined) {
      workerSessions.delete(targetId)
    }
  })
  return workerSessions
}

export async function heapUsage(session: CDPSession) {
  await session.send('Runtime.enable')
  return session.send('Runtime.getHeapUsage')
}

// Heap usage that reports zero rather than throwing, for the summing loops: a
// worker can exit between the poll starting and the query landing.
export async function heapUsageOrZero(session: CDPSession) {
  return heapUsage(session).catch(() => ({ usedSize: 0, totalSize: 0 }))
}

export async function forceGc(session: CDPSession) {
  await session.send('HeapProfiler.enable').catch(() => {})
  await session.send('HeapProfiler.collectGarbage').catch(() => {})
}

// Summed used/reserved heap across a set of worker sessions.
export async function sumHeapUsage(sessions: Iterable<CDPSession>) {
  let used = 0
  let total = 0
  for (const session of sessions) {
    const usage = await heapUsageOrZero(session)
    used += usage.usedSize
    total += usage.totalSize
  }
  return { used, total }
}

// A V8 heap snapshot as its raw JSON. Unlike `Runtime.getHeapUsage` this DOES
// count external ArrayBuffers (WASM memory included), which is the whole reason
// the bgzf question needs it.
export async function takeHeapSnapshot(session: CDPSession, collect = true) {
  let buf = ''
  const onChunk = ({ chunk }: { chunk: string }) => {
    buf += chunk
  }
  session.on('HeapProfiler.addHeapSnapshotChunk', onChunk)
  await session.send('HeapProfiler.enable')
  if (collect) {
    await session.send('HeapProfiler.collectGarbage')
  }
  await session.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false })
  session.off('HeapProfiler.addHeapSnapshotChunk', onChunk)
  return buf
}

// Best-effort wait for "a display has painted and nothing is loading". Both
// halves matter: `*-done` alone fires on a first paint that may still be empty,
// and an absent overlay alone is true before the fetch even starts.
export async function waitRender(page: Page, timeout = 60000) {
  await page
    .waitForFunction(
      () =>
        document.querySelectorAll('[data-display-drawn="true"]').length > 0 &&
        document.querySelectorAll('[data-testid="loading-overlay"]').length ===
          0,
      { timeout, polling: 200 },
    )
    .catch(() => {})
}

const LOCATION_INPUT = 'input[placeholder="Search for location"]'

// Type a locstring into the location box and wait out the re-render.
export async function navTo(page: Page, loc: string, settleMs = 300) {
  await page.waitForSelector(LOCATION_INPUT, { timeout: 20000 })
  await page.focus(LOCATION_INPUT)
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.type(LOCATION_INPUT, loc)
  await page.keyboard.press('Enter')
  await sleep(settleMs)
  await waitRender(page)
}
