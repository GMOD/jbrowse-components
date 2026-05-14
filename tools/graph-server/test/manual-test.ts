// Standalone manual test that boots the server against the volvox fixture,
// pings each endpoint, prints timing. Run with:
//
//   GRAPH_SERVER_DATASETS=test/datasets.volvox.json node \
//     --experimental-strip-types test/manual-test.ts
//
// Or just `pnpm test:manual` from this dir.

import { spawn } from 'child_process'
import path from 'path'
import { setTimeout as sleep } from 'timers/promises'

const PORT = Number(process.env.PORT ?? 5099)
const HERE = new URL('.', import.meta.url).pathname
const REPO = path.resolve(HERE, '../../..')
const DATASETS = path.join(HERE, 'datasets.volvox.json')
const SERVER = path.join(HERE, '../src/server.ts')

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
  proc.stdout.on('data', d => process.stdout.write(`[server] ${d}`))
  proc.stderr.on('data', d => process.stderr.write(`[server-err] ${d}`))

  let killed = false
  process.on('exit', () => {
    if (!killed) {
      proc.kill()
    }
  })

  // wait for ready
  const base = `http://127.0.0.1:${PORT}/api/v0`
  for (let i = 0; i < 50; i++) {
    await sleep(100)
    try {
      const r = await fetch(`${base}/health`)
      if (r.ok) {
        break
      }
    } catch {
      // not ready yet
    }
  }

  try {
    const health = await (await fetch(`${base}/health`)).json()
    console.log('\n[client] health:', JSON.stringify(health, null, 2))

    const t0 = Date.now()
    const setup = await (await fetch(`${base}/datasets/volvox/setup`)).json()
    console.log(
      `[client] setup: ${setup.paths.length} paths, ${setup.assemblies.length} assemblies (${Date.now() - t0}ms)`,
    )
    console.log(`[client]   first 3 paths:`, setup.paths.slice(0, 3))

    for (const [start, end] of [
      [1000, 2000],
      [5000, 6000],
      [5000, 15000],
    ]) {
      const t1 = Date.now()
      const sub = await (
        await fetch(`${base}/datasets/volvox/subgraph`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            refName: 'ctgA',
            start,
            end,
            genome: 'ref#0',
            context: 1,
          }),
        })
      ).text()
      const lines = sub.split('\n').filter(Boolean)
      const sCount = lines.filter(l => l.startsWith('S\t')).length
      const lCount = lines.filter(l => l.startsWith('L\t')).length
      const pCount = lines.filter(l => l.startsWith('P\t')).length
      console.log(
        `[client] subgraph ${start}-${end}: ${sCount}S ${lCount}L ${pCount}P (${Date.now() - t1}ms, ${sub.length} bytes)`,
      )
    }

    for (const [start, end] of [
      [1000, 2000],
      [5000, 6000],
      [5000, 15000],
    ]) {
      const t2 = Date.now()
      const syn = (await (
        await fetch(`${base}/datasets/volvox/synteny`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            refName: 'ctgA',
            start,
            end,
            genome: 'ref#0',
            context: 1,
          }),
        })
      ).json()) as { features: unknown[] }
      console.log(
        `[client] synteny ${start}-${end}: ${syn.features.length} blocks (${Date.now() - t2}ms)`,
      )
    }
    console.log('\n[client] OK')
  } finally {
    killed = true
    proc.kill()
  }
}

main().catch((e: unknown) => {
  console.error('[client] FAIL', e)
  process.exit(1)
})
