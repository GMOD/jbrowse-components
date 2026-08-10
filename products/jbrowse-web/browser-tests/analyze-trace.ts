/* eslint-disable no-console */
// Aggregate the v8 CPU sampler from a profile-ultradeep.ts trace into per-thread
// self-time, resolving minified frames through build/static/js/*.js.map.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createFrameResolver } from './frameResolver.ts'

import type { Frame } from './frameResolver.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = process.argv[2] || path.join(__dirname, 'ultradeep-trace.json')
const MIN_MS = Number(process.env.MIN_MS || 1)

const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
const events: any[] = Array.isArray(raw) ? raw : raw.traceEvents

const byTid = new Map<
  number,
  {
    nodes: Map<number, { callFrame: Frame }>
    samples: number[]
    deltas: number[]
  }
>()
for (const e of events) {
  if (e.name !== 'ProfileChunk' && e.name !== 'Profile') {
    continue
  }
  if (!byTid.has(e.tid)) {
    byTid.set(e.tid, { nodes: new Map(), samples: [], deltas: [] })
  }
  const t = byTid.get(e.tid)!
  const cp = e.args?.data?.cpuProfile || e.args?.data
  for (const n of cp?.nodes || []) {
    t.nodes.set(n.id, n)
  }
  for (const s of cp?.samples || []) {
    t.samples.push(s)
  }
  for (const d of e.args?.data?.timeDeltas || []) {
    t.deltas.push(d)
  }
}
const threadNames = new Map<number, string>()
for (const e of events) {
  if (e.name === 'thread_name' && e.args?.name) {
    threadNames.set(e.tid, e.args.name)
  }
}

const { resolve, counts } = createFrameResolver()

async function main() {
  const threads = [...byTid.entries()]
    .map(([tid, t]) => {
      let total = 0
      const self = new Map<number, number>()
      for (let i = 0; i < t.samples.length; i++) {
        const dt = t.deltas[i] || 0
        self.set(t.samples[i]!, (self.get(t.samples[i]!) || 0) + dt)
        total += dt
      }
      return { tid, t, self, total }
    })
    .filter(x => x.total > 2_000_000)
    .sort((a, b) => b.total - a.total)

  for (const { tid, t, self } of threads) {
    const byLabel = new Map<string, number>()
    let busy = 0
    for (const [id, us] of self) {
      const n = t.nodes.get(id)
      const fn = n?.callFrame.functionName || ''
      if (!n || fn === '(idle)' || fn === '(program)') {
        continue
      }
      busy += us
      const label = await resolve(n.callFrame)
      byLabel.set(label, (byLabel.get(label) || 0) + us)
    }
    console.log(
      `\n==== ${threadNames.get(tid) || `tid ${tid}`} — busy ${(busy / 1000).toFixed(0)} ms ====`,
    )
    // No fixed top-N: a cost can be the #1 frame on a thread and still fall
    // outside a truncated list when the thread has a long tail, which has
    // hidden the answer here before. Everything at or above MIN_MS prints.
    let tail = 0
    for (const [label, us] of [...byLabel.entries()].sort(
      (a, b) => b[1] - a[1],
    )) {
      if (us / 1000 >= MIN_MS) {
        console.log(`${(us / 1000).toFixed(1).padStart(8)} ms  ${label}`)
      } else {
        tail += us
      }
    }
    console.log(
      `${(tail / 1000).toFixed(1).padStart(8)} ms  (${byLabel.size} labels, everything under ${MIN_MS} ms)`,
    )
  }
  const { resolved, unresolved } = counts()
  console.log(
    `\nframes resolved ${resolved}, unresolved ${unresolved}${
      unresolved > resolved / 20
        ? ' — SOURCE MAPS DO NOT MATCH THIS TRACE, re-capture against the current build'
        : ''
    }`,
  )
}
void main().then(() => process.exit(0))
