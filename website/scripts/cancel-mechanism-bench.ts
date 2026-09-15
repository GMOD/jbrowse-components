// How a worker loop that never awaits gets interrupted, measured in a real
// Chrome worker over a fixed matrix-fill workload (4000 passes over 100k
// Float32 cells, ~4 s).
//
// Arms, each a way the loop consults its cancellation once per pass:
//
//   none        no check at all — the floor the others are read against
//   set         a flag set by the worker's own onmessage — the message path
//               alone, which a loop that never yields can never receive
//   probe       the retired mechanism: a synchronous XHR against a blob URL the
//               main thread revokes, gated at 50 ms backing off to 500 ms
//   yield       createAbortBreakpoint's mechanism: a MessageChannel task every
//               50 ms, then read the flag
//   yield-flat  the same yield with no backoff, which is what ships
//
// A cancel run aborts from the main thread 333, 640 and 1100 ms in and records
// how long the loop kept running past it. Plus the two unit costs the old
// mechanism was believed to have: one probe, and one createObjectURL.
//
//   node website/scripts/cancel-mechanism-bench.ts [--runs=3]
//
// Record: agent-docs/measurements/cancel-mechanism.json
import { writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'

import {
  BASE_CHROME_ARGS,
  findChromeExecutable,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { flagArg } from './dev-harness.ts'
import { repoRoot } from './paths.ts'

import type { AddressInfo } from 'node:net'

const runs = Number(flagArg('runs', '3'))
const STOPS = [333, 640, 1100]
const MODES = ['none', 'set', 'probe', 'yield', 'yield-flat'] as const

const workerSource = `
const CELLS = 100000
const OUTER = 4000
const buf = new Float32Array(CELLS)
let stopped = false
let mode = 'none'
let token = ''
let checkInterval = 50
let nextCheckAt = 0
const now = () => performance.timeOrigin + performance.now()

function probe() {
  const xhr = new XMLHttpRequest()
  xhr.open('GET', token, false)
  try {
    xhr.send(null)
  } catch {
    return true
  }
  return false
}

const channel = new MessageChannel()
let pending
channel.port1.onmessage = () => {
  const r = pending
  pending = undefined
  r()
}
const yieldTask = () =>
  new Promise(resolve => {
    pending = resolve
    channel.port2.postMessage(0)
  })

let checks = 0
function checkDue() {
  const t = performance.now()
  if (t < nextCheckAt) {
    return undefined
  }
  nextCheckAt = t + checkInterval
  if (mode !== 'yield-flat') {
    checkInterval = Math.min(checkInterval + 50, 500)
  }
  checks++
  if (mode === 'probe') {
    if (stopped || probe()) {
      throw new Error('abort')
    }
  } else if (mode === 'set') {
    if (stopped) {
      throw new Error('abort')
    }
  } else {
    return yieldTask().then(() => {
      if (stopped) {
        throw new Error('abort')
      }
    })
  }
  return undefined
}

async function run() {
  stopped = false
  checks = 0
  checkInterval = 50
  nextCheckAt = 0
  const start = now()
  self.postMessage({ type: 'started' })
  let acc = 0
  try {
    for (let o = 0; o < OUTER; o++) {
      for (let i = 0; i < CELLS; i++) {
        buf[i] = (buf[i] * 0.5 + i * 1e-7 + o) % 7
      }
      acc += buf[o % CELLS]
      if (mode !== 'none') {
        const p = checkDue()
        if (p) {
          await p
        }
      }
    }
    self.postMessage({ type: 'done', at: now(), elapsed: now() - start, checks, acc })
  } catch (e) {
    self.postMessage({ type: 'aborted', at: now(), elapsed: now() - start, checks })
  }
}

function unitCosts() {
  const N = 10000000
  const signal = new AbortController().signal
  const map = new Map([['blob:abc', 1]])
  const due = () => undefined
  let acc = 0
  const time = fn => {
    const t = performance.now()
    fn()
    return ((performance.now() - t) / N) * 1e6
  }
  const plainNs = time(() => {
    for (let i = 0; i < N; i++) {
      acc += i & 1
    }
  })
  const signalNs = time(() => {
    for (let i = 0; i < N; i++) {
      acc += i & 1
      if (signal.aborted) {
        throw new Error('x')
      }
    }
  })
  const mapNs = time(() => {
    for (let i = 0; i < N; i++) {
      acc += i & 1
      if (map.has('blob:xyz')) {
        throw new Error('x')
      }
    }
  })
  const ifDueNs = time(() => {
    for (let i = 0; i < N; i++) {
      acc += i & 1
      const p = due()
      if (p) {
        throw new Error('x')
      }
    }
  })
  return { plainNs, signalNs, mapNs, ifDueNs, acc }
}

async function awaitCost() {
  const N = 10000000
  let acc = 0
  const t = performance.now()
  for (let i = 0; i < N; i++) {
    acc += i & 1
    await undefined
  }
  return { awaitNs: ((performance.now() - t) / N) * 1e6, acc }
}

self.onmessage = e => {
  if (e.data.type === 'stop') {
    stopped = true
  } else if (e.data.type === 'unitcost') {
    const sync = unitCosts()
    awaitCost().then(a => {
      self.postMessage({ type: 'unitcost', ...sync, awaitNs: a.awaitNs })
    })
  } else if (e.data.type === 'probecost') {
    token = e.data.token
    const n = 200
    const a = performance.now()
    for (let i = 0; i < n; i++) {
      probe()
    }
    self.postMessage({ type: 'probecost', perProbeMs: (performance.now() - a) / n })
  } else if (e.data.type === 'run') {
    mode = e.data.mode
    token = e.data.token
    run().catch(err => self.postMessage({ type: 'error', message: String(err) }))
  }
}
`

const pageSource = `<!doctype html><title>cancel-mechanism-bench</title><script>
window.runArm = (mode, stopAfterMs) =>
  new Promise(resolve => {
    const w = new Worker('/worker.js')
    const token = URL.createObjectURL(new Blob())
    let stopSentAt = 0
    w.onmessage = e => {
      const m = e.data
      if (m.type === 'started') {
        if (stopAfterMs !== undefined) {
          setTimeout(() => {
            stopSentAt = performance.timeOrigin + performance.now()
            URL.revokeObjectURL(token)
            w.postMessage({ type: 'stop' })
          }, stopAfterMs)
        }
      } else if (m.type !== 'probecost') {
        w.terminate()
        resolve({
          outcome: m.type,
          elapsed: m.elapsed,
          checks: m.checks,
          overrun: stopSentAt ? m.at - stopSentAt : undefined,
          message: m.message,
        })
      }
    }
    w.postMessage({ type: 'run', mode, token })
  })
window.unitCost = () =>
  new Promise(resolve => {
    const w = new Worker('/worker.js')
    w.onmessage = e => {
      w.terminate()
      resolve(e.data)
    }
    w.postMessage({ type: 'unitcost' })
  })
window.probeCost = () =>
  new Promise(resolve => {
    const w = new Worker('/worker.js')
    const token = URL.createObjectURL(new Blob())
    w.onmessage = e => {
      w.terminate()
      URL.revokeObjectURL(token)
      resolve(e.data.perProbeMs)
    }
    w.postMessage({ type: 'probecost', token })
  })
window.mintCost = n => {
  const blob = new Blob()
  const a = performance.now()
  for (let i = 0; i < n; i++) {
    URL.revokeObjectURL(URL.createObjectURL(blob))
  }
  return ((performance.now() - a) / n) * 1000
}
</script>`

const server = createServer((req, res) => {
  if (req.url === '/worker.js') {
    res.setHeader('content-type', 'text/javascript')
    res.end(workerSource)
  } else {
    res.setHeader('content-type', 'text/html')
    res.end(pageSource)
  }
})
await new Promise<void>(r => {
  server.listen(0, '127.0.0.1', () => {
    r()
  })
})
const { port } = server.address() as AddressInfo

const browser = await launch({
  executablePath: findChromeExecutable(),
  args: BASE_CHROME_ARGS,
  headless: true,
})
const page = await browser.newPage()
await page.goto(`http://127.0.0.1:${port}/`)

interface ArmResult {
  outcome: string
  elapsed: number
  checks: number
  overrun?: number
  message?: string
}
const median = (a: number[]) =>
  [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!

const probeMs = median(
  await Promise.all(
    [0, 1, 2].map(() => page.evaluate(() => (window as any).probeCost())),
  ),
)
const mintUs = await page.evaluate(() => (window as any).mintCost(2000))
const unit = (await page.evaluate(() => (window as any).unitCost())) as {
  plainNs: number
  signalNs: number
  mapNs: number
  ifDueNs: number
  awaitNs: number
}

// arms interleaved per run rather than run back to back, so a neighbour's load
// drifting over the minutes this takes lands on every arm alike
const results = new Map(
  MODES.map(m => [m, { full: [] as ArmResult[], cancel: [] as ArmResult[] }]),
)
for (let r = 0; r < runs; r++) {
  for (const mode of MODES) {
    const { full, cancel } = results.get(mode)!
    full.push(await page.evaluate(m => (window as any).runArm(m), mode))
    if (mode !== 'none') {
      for (const stop of STOPS) {
        cancel.push(
          await page.evaluate(
            (m, s) => (window as any).runArm(m, s),
            mode,
            stop,
          ),
        )
      }
    }
  }
}

const rows = []
for (const mode of MODES) {
  const { full, cancel } = results.get(mode)!
  const failed = [...full, ...cancel].find(x => x.outcome === 'error')
  if (failed) {
    throw new Error(`${mode}: ${failed.message}`)
  }
  rows.push({
    values: {
      mode,
      fullMs: Math.round(median(full.map(x => x.elapsed))),
      checks: full[0]!.checks,
      cancelled:
        mode === 'none'
          ? 'n/a'
          : cancel.every(x => x.outcome === 'aborted')
            ? 'mid-loop'
            : 'ran to completion',
      overrunMs: cancel.length
        ? Math.round(median(cancel.map(x => x.overrun!)))
        : 0,
      overrunMaxMs: cancel.length
        ? Math.round(Math.max(...cancel.map(x => x.overrun!)))
        : 0,
    },
  })
  console.error(mode, JSON.stringify(rows.at(-1)!.values))
}

await browser.close()
server.close()

const record = {
  id: 'cancel-mechanism',
  measured: new Date().toISOString().slice(0, 10),
  published: false,
  source: {
    kind: 'bench',
    repro: 'node website/scripts/cancel-mechanism-bench.ts --runs=3',
    notes: `A real Chrome worker (${process.platform}) filling a 100k-cell Float32Array 4000 times, consulting its cancellation once per pass. Cancel rows abort from the main thread 333, 640 and 1100 ms in, three stops per run; overrun is how long the loop ran past the stop. Unit costs on the same page: one synchronous blob-URL probe ${probeMs.toFixed(2)} ms, one createObjectURL+revoke pair ${mintUs.toFixed(0)} µs.`,
  },
  columns: [
    { key: 'mode', label: 'arm' },
    { key: 'fullMs', label: 'uncancelled run', format: 'ms', align: 'right' },
    { key: 'checks', label: 'checks per run', format: 'int', align: 'right' },
    { key: 'cancelled', label: 'a cancel lands' },
    {
      key: 'overrunMs',
      label: 'overrun, median',
      format: 'ms',
      align: 'right',
    },
    {
      key: 'overrunMaxMs',
      label: 'overrun, max',
      format: 'ms',
      align: 'right',
    },
  ],
  rows,
}
const out = join(repoRoot, 'agent-docs/measurements/cancel-mechanism.json')
writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`)
console.log(`wrote ${out}`)

const perItem = {
  id: 'abort-check-per-item',
  measured: record.measured,
  published: false,
  source: {
    kind: 'bench',
    repro: record.source.repro,
    notes:
      'What one loop iteration pays for each way of consulting its cancellation, in the same Chrome worker, over 10M iterations of a trivial body. The last row is why createAbortBreakpoint splits due() from yield(): an await on a non-promise still costs a microtask.',
  },
  columns: [
    { key: 'check', label: 'per-item check' },
    { key: 'ns', label: 'cost per item', format: 'int', align: 'right' },
  ],
  rows: [
    {
      values: { check: 'none (loop body alone)', ns: Math.round(unit.plainNs) },
    },
    { values: { check: '`signal.aborted`', ns: Math.round(unit.signalNs) } },
    {
      values: {
        check: '`Map.has` (the retired stopped-id set)',
        ns: Math.round(unit.mapNs),
      },
    },
    {
      values: {
        check: '`if (breakpoint.due())` (a counter bump)',
        ns: Math.round(unit.ifDueNs),
      },
    },
    {
      values: {
        check: '`await` of a non-promise',
        ns: Math.round(unit.awaitNs),
      },
    },
  ],
}
const out2 = join(repoRoot, 'agent-docs/measurements/abort-check-per-item.json')
writeFileSync(out2, `${JSON.stringify(perItem, null, 2)}\n`)
console.log(`wrote ${out2}`)
