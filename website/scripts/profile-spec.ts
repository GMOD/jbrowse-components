// CPU-profile one screenshot spec's cold load — main thread and every RPC worker
// — and print where the wall clock actually went. Complements profile-app.ts,
// which profiles a fixed volvox session plus an interaction; this one takes any
// spec by name, so a figure that takes minutes to render can be explained
// instead of guessed at.
//
//   node scripts/profile-spec.ts tcga/cohort_cnv_genome [--out=<dir>]
//
// The timeline is the point: each milestone is a real readiness signal, so the
// gaps between them attribute the wall clock to a phase (assembly load, fetch +
// parse, render) before the CPU tables attribute it to code.
import fs from 'node:fs'
import path from 'node:path'

import {
  waitForDisplayPhases,
  waitForDisplaysDone,
  waitForViewPhases,
} from '@jbrowse/browser-test-utils'

import {
  flagArg,
  jbrowseWebRoot,
  resolveUrlSpec,
  specUrl,
  specViewport,
  withHarness,
} from './dev-harness.ts'
import { repoRoot } from './paths.ts'
import { aggregateProfile, renderTable } from './profile-resolve.ts'

import type { CDPSession, Page } from 'puppeteer'

const buildJsDir = path.join(jbrowseWebRoot, 'build', 'static', 'js')
const PORT = 3342

const specName = process.argv[2]
const outDir = flagArg('out', path.join(repoRoot, 'perf-out'))
const timeout = Number(flagArg('timeout', '900000'))
// Run with SharedArrayBuffer force-enabled, i.e. what the app gets on a
// cross-origin-isolated (COOP/COEP) deployment. Stop tokens then use the atomic
// fast path instead of the synchronous-XHR fallback — pass this to measure how
// much of a spec's wall clock that fallback is costing.
const sab = process.argv.includes('--sab')
// Render through the hardware GL stack instead of SwiftShader's software
// rasterizer. The screenshot generator uses swiftshader for reproducibility, but
// it makes GPU-heavy figures pay software raster cost — the tcga cohort figure
// spends its whole wall clock in ~10 multi-second GPU passes (see
// scripts/trace-tasks.ts). Pass this to see what the same figure costs on a GPU.
const angleGl = process.argv.includes('--angle-gl')

const spec = resolveUrlSpec(
  specName,
  'usage: node scripts/profile-spec.ts <url-mode spec name> [--out=dir] [--timeout=ms]',
)

// Requests, grouped by host and by the file they hit. A spec whose CPU profile
// shows an idle worker is waiting on these, and a tabix/BAM read is many small
// range requests over one file — so the count per file, not the byte total, is
// what explains the wall clock.
interface Req {
  url: string
  bytes: number
  startedAt: number
  finishedAt: number
}

function collectNetwork(client: CDPSession) {
  const done: Req[] = []
  collectNetworkInto(client, done)
  return done
}

function collectNetworkInto(client: CDPSession, done: Req[]) {
  const inflight = new Map<string, { url: string; startedAt: number }>()
  client.on('Network.requestWillBeSent', e => {
    inflight.set(e.requestId, {
      url: e.request.url,
      startedAt: e.timestamp * 1000,
    })
  })
  client.on('Network.loadingFinished', e => {
    const meta = inflight.get(e.requestId)
    if (meta) {
      done.push({
        url: meta.url,
        bytes: e.encodedDataLength,
        startedAt: meta.startedAt,
        finishedAt: e.timestamp * 1000,
      })
    }
  })
}

function networkReport(reqs: Req[]) {
  const byFile = new Map<string, { n: number; bytes: number; ms: number }>()
  for (const r of reqs) {
    const key = r.url.replace(/[?#].*$/, '')
    const cur = byFile.get(key) ?? { n: 0, bytes: 0, ms: 0 }
    cur.n += 1
    cur.bytes += r.bytes
    cur.ms += r.finishedAt - r.startedAt
    byFile.set(key, cur)
  }
  const rows = [...byFile.entries()]
    .sort((a, b) => b[1].ms - a[1].ms)
    .slice(0, 15)
    .map(
      ([url, v]) =>
        `| ${v.n} | ${(v.bytes / 1024).toFixed(0)} KB | ${(v.ms / 1000).toFixed(1)}s | ${url.replace(/^https?:\/\//, '')} |`,
    )
  return [
    `requests: ${reqs.length}, ${(reqs.reduce((a, b) => a + b.bytes, 0) / 1024 / 1024).toFixed(1)} MB`,
    '',
    '| n | bytes | summed latency | url |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n')
}

interface Probe {
  label: string
  session: CDPSession
}

async function startProbe(session: CDPSession, label: string) {
  try {
    await session.send('Profiler.enable')
    // 1ms sampling: the phases of interest run for minutes, so a finer interval
    // buys nothing but profile size
    await session.send('Profiler.setSamplingInterval', { interval: 1000 })
    await session.send('Profiler.start')
    return { label, session }
  } catch {
    return undefined
  }
}

// Worker fetches are reported by the worker's own target, not the page's, and the
// data fetches all happen in the RPC worker — so Network has to be enabled there
// too or the table comes back showing only the bundle downloads.
function attachWorkerProbes(page: Page, probes: Probe[], reqs: Req[]) {
  page.on('workercreated', worker => {
    const session = worker.client
    void session
      .send('Network.enable')
      .then(() => {
        collectNetworkInto(session, reqs)
      })
      .catch(() => {})
    void startProbe(session, `worker:${path.basename(worker.url())}`).then(
      p => {
        if (p) {
          probes.push(p)
        }
      },
    )
  })
}

fs.mkdirSync(outDir, { recursive: true })

await withHarness(
  {
    port: PORT,
    protocolTimeout: timeout,
    viewport: specViewport(spec),
    chromeArgs: [
      ...(angleGl ? ['--use-angle=gl'] : ['--enable-unsafe-swiftshader']),
      ...(sab ? ['--enable-features=SharedArrayBuffer'] : []),
    ],
  },
  async ({ page }) => {
    const client = await page.createCDPSession()
    await client.send('Network.enable')
    const reqs = collectNetwork(client)
    const probes: Probe[] = []
    attachWorkerProbes(page, probes, reqs)
    const main = await startProbe(client, 'main')
    if (main) {
      probes.push(main)
    }

    const t0 = Date.now()
    const marks: { label: string; at: number }[] = []
    const mark = (label: string) => {
      marks.push({ label, at: Date.now() - t0 })
      const last = marks.at(-1)!
      const prev = marks.at(-2)?.at ?? 0
      console.log(
        `${(last.at / 1000).toFixed(1)}s (+${((last.at - prev) / 1000).toFixed(1)}s) ${label}`,
      )
    }

    const url = specUrl(spec, PORT)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout })
    mark('domcontentloaded')
    await waitForViewPhases(page, timeout)
    mark('view initialized (assembly loaded, navigated)')
    await waitForDisplayPhases(page, timeout)
    mark('no display still loading (fetch + parse done)')
    await waitForDisplaysDone(page, timeout)
    mark('all displays painted')
    if (spec.readySelector) {
      await page
        .waitForSelector(spec.readySelector, { visible: true, timeout })
        .catch(() => {
          console.log(`readySelector never appeared: ${spec.readySelector}`)
        })
      mark(`readySelector ${spec.readySelector}`)
    }

    console.log(`\n### Network\n`)
    console.log(networkReport(reqs))

    for (const probe of probes) {
      const { profile } = await probe.session
        .send('Profiler.stop')
        .catch(() => ({ profile: undefined }))
      if (profile?.samples?.length) {
        const file = path.join(
          outDir,
          `${spec.name.replaceAll('/', '_')}.${probe.label.replaceAll(/[^\w.-]/g, '_')}.cpuprofile`,
        )
        fs.writeFileSync(file, JSON.stringify(profile))
        console.log(`\n### CPU — ${probe.label}\n`)
        console.log(renderTable(aggregateProfile(profile, buildJsDir)))
        console.log(`\nprofile: ${file}`)
      }
    }
  },
)
