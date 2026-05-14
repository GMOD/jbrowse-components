// Perf benchmark on HPRC chr20. Boots the server and times /subgraph and
// /synteny across 1kb / 100kb / 1Mb regions, three trials each.
//
// Run:
//   BACKEND=odgi pnpm exec node --experimental-strip-types tools/graph-server/test/perf-chr20.ts
//   BACKEND=vg   pnpm exec node --experimental-strip-types tools/graph-server/test/perf-chr20.ts

import { spawn } from 'child_process'
import path from 'path'
import { setTimeout as sleep } from 'timers/promises'

const PORT = Number(process.env.PORT ?? 5198)
const BACKEND = (process.env.BACKEND ?? 'odgi') as 'odgi' | 'vg'
const HERE = new URL('.', import.meta.url).pathname
const REPO = path.resolve(HERE, '../../..')
const DATASETS = path.join(
  HERE,
  BACKEND === 'vg' ? 'datasets.chr20.vg.json' : 'datasets.chr20.json',
)
const SERVER = path.join(HERE, '../src/server.ts')

interface Sample {
  label: string
  refName: string
  start: number
  end: number
}

const SAMPLES: Sample[] = [
  { label: '1kb', refName: 'chr20', start: 1_000_000, end: 1_001_000 },
  { label: '10kb', refName: 'chr20', start: 1_000_000, end: 1_010_000 },
  { label: '100kb', refName: 'chr20', start: 1_000_000, end: 1_100_000 },
  { label: '1Mb', refName: 'chr20', start: 1_000_000, end: 2_000_000 },
]

async function timed<T>(label: string, fn: () => Promise<T>) {
  const t0 = Date.now()
  const v = await fn()
  return { label, value: v, ms: Date.now() - t0 }
}

async function main() {
  const proc = spawn('node', ['--experimental-strip-types', SERVER], {
    env: {
      ...process.env,
      PORT: String(PORT),
      GRAPH_SERVER_DATASETS: DATASETS,
    },
    cwd: REPO,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let serverOutput = ''
  proc.stdout.on('data', d => {
    serverOutput += d
    process.stdout.write(`[server] ${d}`)
  })
  proc.stderr.on('data', d => {
    serverOutput += d
    process.stderr.write(`[server-err] ${d}`)
  })

  let killed = false
  process.on('exit', () => {
    if (!killed) {
      proc.kill()
    }
  })

  const base = `http://127.0.0.1:${PORT}/api/v0`
  for (let i = 0; i < 200; i++) {
    await sleep(150)
    try {
      const r = await fetch(`${base}/health`)
      if (r.ok) {
        break
      }
    } catch {
      // not ready
    }
  }

  try {
    const setupResult = await timed('setup', async () => {
      const r = await fetch(`${base}/datasets/chr20/setup`)
      return r.json() as Promise<{
        paths: { name: string; length: number; genome: string }[]
        assemblies: string[]
      }>
    })
    console.log(
      `\n[perf] backend=${BACKEND} setup: ${setupResult.value.paths.length} paths, ${setupResult.value.assemblies.length} assemblies (${setupResult.ms}ms)`,
    )
    // Prefer GRCh38 as ref if present (canonical HPRC pangenome anchor);
    // otherwise fall back to any chr20-bearing path.
    const refPath =
      setupResult.value.paths.find(p => /^GRCh38#0#chr20/i.test(p.name)) ??
      setupResult.value.paths.find(p => /chr20/i.test(p.name))
    if (!refPath) {
      throw new Error(
        `no chr20 path in dataset; first 5 paths: ${setupResult.value.paths
          .slice(0, 5)
          .map(p => p.name)
          .join(', ')}`,
      )
    }
    console.log(
      `[perf] reference path: ${refPath.name} (genome=${refPath.genome}, length=${refPath.length})`,
    )

    // Strip both the PanSN genome prefix and the subwalk range suffix so
    // /synteny gets a bare contig name (`chr20`) — the server resolves the
    // path internally via genome+refName.
    const last = refPath.name.split('#').pop() ?? refPath.name
    const refName = last.replace(/:\d+-\d+$/, '')
    const genome = refPath.genome

    const headers = { 'content-type': 'application/json' }
    console.log('\n[perf] subgraph (3 trials each)')
    for (const s of SAMPLES) {
      const trials: number[] = []
      let bytes = 0
      for (let t = 0; t < 3; t++) {
        const t0 = Date.now()
        const r = await fetch(`${base}/datasets/chr20/subgraph`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            refName,
            start: s.start,
            end: s.end,
            genome,
            context: 1,
          }),
        })
        const text = await r.text()
        bytes = text.length
        trials.push(Date.now() - t0)
      }
      console.log(
        `  ${s.label} ${refName}:${s.start}-${s.end}: trials=[${trials.join(',')}]ms, bytes=${bytes}`,
      )
    }

    console.log('\n[perf] synteny (3 trials each)')
    for (const s of SAMPLES) {
      const trials: number[] = []
      let nFeats = 0
      for (let t = 0; t < 3; t++) {
        const t0 = Date.now()
        const r = await fetch(`${base}/datasets/chr20/synteny`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            refName,
            start: s.start,
            end: s.end,
            genome,
            context: 1,
          }),
        })
        const j = (await r.json()) as { features: unknown[] }
        nFeats = j.features.length
        trials.push(Date.now() - t0)
      }
      console.log(
        `  ${s.label} ${refName}:${s.start}-${s.end}: trials=[${trials.join(',')}]ms, features=${nFeats}`,
      )
    }
    console.log('\n[perf] OK')
  } finally {
    killed = true
    proc.kill()
    void serverOutput
  }
}

main().catch((e: unknown) => {
  console.error('[perf] FAIL', e)
  process.exit(1)
})
