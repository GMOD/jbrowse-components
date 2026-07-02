/* eslint-disable no-console */
// Aggregate the v8 CPU sampler from a profile-ultradeep.ts trace into per-thread
// self-time, resolving minified frames through build/static/js/*.js.map.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildPath } from './server.ts'

const require = createRequire(import.meta.url)
const smPath = require
  .resolve('webpack')
  .replace(/webpack@.*/, 'source-map@0.6.1/node_modules/source-map')
const { SourceMapConsumer } = require(smPath)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = process.argv[2] || path.join(__dirname, 'ultradeep-trace.json')

interface Frame {
  functionName: string
  url: string
  lineNumber: number
  columnNumber: number
}
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

const consumers = new Map<string, any>()
async function consumerFor(url: string) {
  const base = (url || '').split('/').pop() || ''
  if (!base.endsWith('.js')) {
    return null
  }
  if (consumers.has(base)) {
    return consumers.get(base)
  }
  const mapFile = path.join(buildPath, 'static', 'js', `${base}.map`)
  const c = fs.existsSync(mapFile)
    ? await new SourceMapConsumer(JSON.parse(fs.readFileSync(mapFile, 'utf8')))
    : null
  consumers.set(base, c)
  return c
}
async function resolve(f: Frame) {
  const c = await consumerFor(f.url)
  const fallback = `${f.functionName || '(anon)'}  [${((f.url || '').split('/').pop() || 'native').slice(0, 20)}]`
  if (!c) {
    return fallback
  }
  const pos = c.originalPositionFor({
    line: f.lineNumber + 1,
    column: f.columnNumber,
  })
  if (!pos.source) {
    return fallback
  }
  const src = pos.source
    .replace(/.*\/node_modules\//, '~/')
    .replace(/^webpack:\/\/[^/]*\//, '')
  return `${pos.name || f.functionName || '(anon)'}  [${src}:${pos.line}]`
}

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
    for (const [label, us] of [...byLabel.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 22)) {
      console.log(`${(us / 1000).toFixed(1).padStart(8)} ms  ${label}`)
    }
  }
}
void main().then(() => process.exit(0))
