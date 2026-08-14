/* eslint-disable no-console */
// Retained-memory profile for the ultra-deep alignments render: which
// allocation site produced the bytes still LIVE when the render finishes.
//
// READ THIS BEFORE INTERPRETING THE OUTPUT. `HeapProfiler.startSampling`
// reports only objects that survived to `stopSampling` — verified directly:
// 500k objects allocated and dropped in a loop sample as 0.0 MB, the same loop
// retaining them samples 27 MB. So this answers "what is the worker holding",
// NOT "what is churning through the nursery".
//
// It therefore does NOT attribute the GC line (199 ms of 2165 ms on the
// alignments worker). Transient garbage — the string churn that line has been
// blamed on for two sessions — is exactly what this tool cannot see, and no
// reading of its output confirms or refutes that hypothesis. The tool for that
// is `HeapProfiler.startTrackingHeapObjects({trackAllocations: true})`, whose
// snapshot carries an allocation trace tree covering dead objects too; it is
// not built yet.
//
// Capture and analysis are one script on purpose. The chunk source maps must
// come from the build that produced the profile (filenames carry a content
// hash), and splitting the two invites analysing a fresh profile against a
// rebuilt bundle, which silently unresolves every frame.
//
// Run `pnpm --filter @jbrowse/web build` first. Not part of the suite.
import {
  BASE_CHROME_ARGS,
  displayPainted,
  encodeSessionSpec,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { createFrameResolver } from './frameResolver.ts'
import { waitForDisplayPaint } from './helpers.ts'
import { startServer } from './server.ts'

import type { Frame } from './frameResolver.ts'
import type { CDPSession, WebWorker } from 'puppeteer'

const PORT = 3398
// <20kb window auto-force-loads past the fetchSizeLimit prompt so it renders.
const LOC = process.env.LOC || 'ctgA:14000-26000'
// Bytes between samples. Smaller resolves finer at more profiling overhead;
// the default 32768 is too coarse to separate the mid-sized allocators here.
const SAMPLING_INTERVAL = Number(process.env.SAMPLING_INTERVAL || 8192)
const MIN_KB = Number(process.env.MIN_KB || 64)

interface HeapNode {
  callFrame: Frame
  selfSize: number
  children: HeapNode[]
}

async function startSampling(session: CDPSession) {
  await session.send('HeapProfiler.enable')
  await session.send('HeapProfiler.startSampling', {
    samplingInterval: SAMPLING_INTERVAL,
  })
}

// selfSize summed per call frame: bytes still live at stopSampling, keyed by
// the site that allocated them — not by who was on the stack at the time.
function collectSelfSizes(node: HeapNode, out: Map<string, [Frame, number]>) {
  if (node.selfSize > 0) {
    const f = node.callFrame
    const key = `${f.url}:${f.lineNumber}:${f.columnNumber}:${f.functionName}`
    const prev = out.get(key)
    out.set(key, [f, (prev ? prev[1] : 0) + node.selfSize])
  }
  for (const child of node.children) {
    collectSelfSizes(child, out)
  }
}

async function report(label: string, node: HeapNode) {
  const raw = new Map<string, [Frame, number]>()
  collectSelfSizes(node, raw)
  const { resolve, counts } = createFrameResolver()
  const byLabel = new Map<string, number>()
  let total = 0
  for (const [frame, bytes] of raw.values()) {
    total += bytes
    const name = await resolve(frame)
    byLabel.set(name, (byLabel.get(name) || 0) + bytes)
  }
  console.log(
    `\n==== ${label} — ${(total / 1024 / 1024).toFixed(1)} MB retained ====`,
  )
  let tail = 0
  for (const [name, bytes] of [...byLabel.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    if (bytes / 1024 >= MIN_KB) {
      const pct = ((bytes / total) * 100).toFixed(1)
      console.log(
        `${(bytes / 1024).toFixed(0).padStart(9)} KB ${pct.padStart(5)}%  ${name}`,
      )
    } else {
      tail += bytes
    }
  }
  console.log(
    `${(tail / 1024).toFixed(0).padStart(9)} KB         (everything under ${MIN_KB} KB)`,
  )
  const { resolved, unresolved } = counts()
  if (unresolved > resolved / 20) {
    console.log(
      `  WARNING: ${unresolved}/${resolved + unresolved} frames unresolved — ` +
        'the build was rebuilt after capture, re-run rather than interpret this',
    )
  }
}

async function main() {
  const server = await startServer(PORT)
  const browser = await launch({ headless: true, args: BASE_CHROME_ARGS })
  const page = await browser.newPage()
  await page.setViewport({ width: 1500, height: 900 })

  // Attach before navigating: the RPC worker starts fetching as soon as it
  // exists, so a sampler started after the fact misses the extraction pass
  // that this whole profile is about.
  const sampled: { worker: WebWorker; started: Promise<void> }[] = []
  page.on('workercreated', worker => {
    sampled.push({ worker, started: startSampling(worker.client) })
  })

  const spec = {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: LOC,
        tracks: ['volvox_ultradeep'],
      },
    ],
  }
  const config = 'extra_test_data/volvox-ultradeep.json'
  const query = `config=${config}&session=${encodeSessionSpec(
    spec,
  )}&sessionName=Perf&renderer=canvas2d`

  const mainSession = await page.createCDPSession()
  await startSampling(mainSession)

  const t0 = Date.now()
  await page.goto(`http://localhost:${PORT}/?${query}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })
  // See profile-ultradeep.ts: a gated display never publishes the paint-complete
  // test-id, so a bare wait burns its full timeout and then hands you a heap
  // profile of a page that fetched nothing — which is indistinguishable from a
  // real one except for `pileup-done -1 ms`.
  let doneMs = -1
  await waitForDisplayPaint(page, displayPainted('pileup-display'), 180000)
    .then(() => {
      doneMs = Date.now() - t0
    })
    .catch((e: unknown) => {
      console.log(`WARN: pileup-display-done not seen — ${String(e)}`)
    })

  const results: { label: string; head: HeapNode }[] = []
  for (const { worker, started } of sampled) {
    await started
    const { profile } = await worker.client.send('HeapProfiler.stopSampling')
    results.push({
      label: `worker ${worker.url().split('/').pop()}`,
      head: profile.head,
    })
  }
  const { profile: mainProfile } = await mainSession.send(
    'HeapProfiler.stopSampling',
  )
  results.push({ label: 'main thread', head: mainProfile.head })

  await browser.close()
  server.close()

  console.log(
    `region ${LOC}  pileup-done ${doneMs} ms  sampling every ${SAMPLING_INTERVAL} B`,
  )
  for (const { label, head } of results) {
    await report(label, head)
  }
}

void main().then(() => process.exit(0))
