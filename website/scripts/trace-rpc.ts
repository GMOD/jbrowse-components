// Where does a slow figure's wall clock go — inside an RPC call, or between
// them? Wraps `Worker.postMessage` and the worker's message events in the page
// (no app changes, runs the built bundle) and reports, per RPC method, how many
// calls were made and how long each took end to end, plus the gaps where no call
// was in flight at all.
//
//   node scripts/trace-rpc.ts tcga/cohort_cnv_genome [--timeout=ms]
//
// A profile that shows both threads idle can't say whether the app is waiting on
// a call or failing to make one; this can.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BASE_CHROME_ARGS,
  createTestServer,
  findChromeExecutable,
  waitForViewPhases,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { specs } from './screenshot-specs.ts'

import type { SessionUrlSpec } from './screenshot-specs.ts'
import type { CDPSession } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..', '..')
const jbrowseWebRoot = path.resolve(repoRoot, 'products', 'jbrowse-web')
const PORT = 3343

const arg = (name: string, fallback: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback
const timeout = Number(arg('timeout', '900000'))

function resolveSpec(name: string | undefined): SessionUrlSpec {
  const found = specs.find(s => s.name === name)
  if (!found || found.mode !== 'url') {
    console.error('usage: node scripts/trace-rpc.ts <url-mode spec name>')
    process.exit(1)
  }
  return found
}

const spec = resolveSpec(process.argv[2])

interface RpcEvent {
  t: number
  dir: 'out' | 'in'
  method: string
  uid: string
}

async function main() {
  const server = await createTestServer(PORT, { jbrowseWebRoot, repoRoot })
  const browser = await launch({
    headless: true,
    executablePath: findChromeExecutable(),
    args: [
      ...BASE_CHROME_ARGS,
      '--enable-unsafe-swiftshader',
      // suspects for the missing wall clock: Chrome throttles timers and
      // background tasks in a page it considers hidden (headless), and its IPC
      // flooding protection progressively delays a renderer that posts a lot of
      // messages — both would starve the RPC worker without costing any CPU
      ...(process.argv.includes('--no-throttle')
        ? [
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-ipc-flooding-protection',
          ]
        : []),
    ],
    protocolTimeout: timeout,
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({
      width: spec.viewportWidth ?? 1500,
      height: spec.viewportHeight ?? 800,
      deviceScaleFactor: 1,
    })
    // Patch before any app script runs: every RPC message in and out gets a
    // timestamp, keyed by the librpc uuid so a reply can be matched to its call.
    await page.evaluateOnNewDocument(() => {
      const log: RpcEvent[] = []
      Object.assign(window, { __rpcLog: log })
      const t0 = performance.now()
      // RpcClient's frame shape: calls carry {method, uid, libRpc}, replies and
      // status events carry {uid, libRpc} with eventName set for the latter
      const record = (dir: 'out' | 'in', data: unknown) => {
        const d = data as
          | { method?: string; uid?: string; eventName?: string; libRpc?: true }
          | undefined
        if (d?.libRpc && d.uid !== undefined && d.eventName === undefined) {
          log.push({
            t: performance.now() - t0,
            dir,
            method: d.method ?? '(reply)',
            uid: d.uid,
          })
        }
      }
      // one listener per worker, not per postMessage, or every call re-registers
      // and each reply gets logged n times
      const listening = new WeakSet<Worker>()
      // the overload pair (message, transfer[]) | (message, options) is what
      // makes a typed wrapper awkward; the patch forwards arguments untouched
      const origPost = Worker.prototype.postMessage as (
        this: Worker,
        ...args: unknown[]
      ) => void
      function patched(this: Worker, ...args: unknown[]) {
        record('out', args[0])
        if (!listening.has(this)) {
          listening.add(this)
          this.addEventListener('message', e => {
            record('in', (e as MessageEvent).data)
          })
        }
        origPost.apply(this, args)
      }
      Worker.prototype.postMessage = patched as Worker['postMessage']
    })

    // Count and time every synchronous XHR the RPC worker makes — that is the
    // stop-token fallback probe (checkStopToken), and a thread blocked in one is
    // reported as *idle* by the sampling profiler, so it is invisible in a CPU
    // profile. Also record whether the worker got SharedArrayBuffer (the cheap
    // atomic path) at all.
    const workerSessions: { url: string; session: CDPSession }[] = []
    page.on('workercreated', worker => {
      const session = worker.client
      workerSessions.push({ url: worker.url(), session })
      void session
        .send('Runtime.evaluate', {
          expression: `
            globalThis.__xhr = { n: 0, ms: 0, max: 0 }
            globalThis.__sab = typeof SharedArrayBuffer
            const send = XMLHttpRequest.prototype.send
            XMLHttpRequest.prototype.send = function (...a) {
              const t = performance.now()
              try {
                return send.apply(this, a)
              } finally {
                const d = performance.now() - t
                globalThis.__xhr.n++
                globalThis.__xhr.ms += d
                globalThis.__xhr.max = Math.max(globalThis.__xhr.max, d)
              }
            }
            // async fetch: how long the worker spends awaiting data
            globalThis.__fetch = { n: 0, ms: 0, max: 0 }
            const of = globalThis.fetch
            globalThis.fetch = async function (...a) {
              const t = performance.now()
              try {
                return await of.apply(this, a)
              } finally {
                const d = performance.now() - t
                globalThis.__fetch.n++
                globalThis.__fetch.ms += d
                globalThis.__fetch.max = Math.max(globalThis.__fetch.max, d)
              }
            }
            // postMessage from the worker: structured clone runs synchronously
            // in C++, so a big non-transferable payload blocks the thread with
            // no JS frames for a sampling profiler to attribute
            globalThis.__pm = { n: 0, ms: 0, max: 0, noTransfer: 0 }
            const op = globalThis.postMessage
            globalThis.postMessage = function (msg, transfer) {
              const t = performance.now()
              try {
                return op.call(this, msg, transfer)
              } finally {
                const d = performance.now() - t
                globalThis.__pm.n++
                globalThis.__pm.ms += d
                globalThis.__pm.max = Math.max(globalThis.__pm.max, d)
                if (!transfer || transfer.length === 0) {
                  globalThis.__pm.noTransfer++
                }
              }
            }
            // event-loop lag: a timer that should fire every 50ms. Large lag ==
            // the thread is BLOCKED (in JS or in C++ the JS profiler can't see,
            // e.g. structured clone); near-zero lag == genuinely waiting on I/O.
            globalThis.__lag = { n: 0, ms: 0, max: 0 }
            let __last = performance.now()
            setInterval(() => {
              const now = performance.now()
              const d = Math.max(0, now - __last - 50)
              __last = now
              globalThis.__lag.n++
              globalThis.__lag.ms += d
              globalThis.__lag.max = Math.max(globalThis.__lag.max, d)
            }, 50)
          `,
        })
        .catch(() => {})
    })

    const url = spec.url.startsWith('http')
      ? spec.url
      : `http://localhost:${PORT}/${spec.url}`
    const t0 = Date.now()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout })
    await waitForViewPhases(page, timeout)
    if (spec.readySelector) {
      await page
        .waitForSelector(spec.readySelector, { visible: true, timeout })
        .catch(() => {
          console.log(`readySelector never appeared: ${spec.readySelector}`)
        })
    }
    console.log(`total wall ${((Date.now() - t0) / 1000).toFixed(1)}s`)

    const log = (await page.evaluate(
      () => (window as unknown as { __rpcLog: RpcEvent[] }).__rpcLog,
    )) as RpcEvent[]

    // pair each outbound call with its first inbound reply of the same uuid
    const calls: { method: string; start: number; end: number }[] = []
    const open = new Map<string, { method: string; start: number }>()
    for (const e of log) {
      if (e.dir === 'out') {
        open.set(e.uid, { method: e.method, start: e.t })
      } else {
        const c = open.get(e.uid)
        if (c) {
          calls.push({ method: c.method, start: c.start, end: e.t })
          open.delete(e.uid)
        }
      }
    }
    const byMethod = new Map<string, { n: number; ms: number; max: number }>()
    for (const c of calls) {
      const cur = byMethod.get(c.method) ?? { n: 0, ms: 0, max: 0 }
      cur.n += 1
      cur.ms += c.end - c.start
      cur.max = Math.max(cur.max, c.end - c.start)
      byMethod.set(c.method, cur)
    }
    console.log(`\n| n | total | slowest | method |`)
    console.log(`| --- | --- | --- | --- |`)
    for (const [m, v] of [...byMethod.entries()].sort(
      (a, b) => b[1].ms - a[1].ms,
    )) {
      console.log(
        `| ${v.n} | ${(v.ms / 1000).toFixed(1)}s | ${(v.max / 1000).toFixed(1)}s | ${m} |`,
      )
    }
    console.log(`\nunanswered calls: ${open.size}`)
    for (const [uid, c] of open) {
      console.log(`  ${c.method} sent at ${(c.start / 1000).toFixed(1)}s (uid ${uid})`)
    }
    // wall clock with no call in flight at all
    const sorted = [...calls].sort((a, b) => a.start - b.start)
    let covered = 0
    let cursor = 0
    for (const c of sorted) {
      const s = Math.max(cursor, c.start)
      if (c.end > s) {
        covered += c.end - s
        cursor = c.end
      }
    }
    const last = Math.max(...log.map(e => e.t), 0)
    console.log(
      `\nRPC in flight ${(covered / 1000).toFixed(1)}s of ${(last / 1000).toFixed(1)}s traced; idle-between-calls ${((last - covered) / 1000).toFixed(1)}s`,
    )
    for (const { url: wurl, session } of workerSessions) {
      const res = await session
        .send('Runtime.evaluate', {
          expression:
            `JSON.stringify({
              syncXhr: globalThis.__xhr,
              fetch: globalThis.__fetch,
              blockedLag: globalThis.__lag,
              postMessage: globalThis.__pm,
              sab: globalThis.__sab,
            })`,
          returnByValue: true,
        })
        .catch(() => undefined)
      const value = res?.result.value
      if (typeof value === 'string') {
        console.log(`\nworker ${path.basename(wurl)}: ${value}`)
      }
    }

    console.log('\nfirst 40 events:')
    for (const e of log.slice(0, 40)) {
      console.log(`  ${(e.t / 1000).toFixed(2)}s ${e.dir} ${e.method}`)
    }
  } finally {
    await browser.close()
    server.close()
  }
}

await main()
