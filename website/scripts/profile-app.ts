// Throwaway: CPU-profile a cold jbrowse-web load (LGV + a couple tracks) and a
// pan/zoom interaction, then attribute self time back to real source files via
// the build sourcemaps. Zero source changes, runs the built bundle.
//
//   node scripts/profile-app.ts [--headed] [--throttle=4] [--tracks=a,b]
//                               [--loc=ctgA:1-20,000] [--out=<dir>]
//
// Writes <out>/{cold,warm,interaction}.cpuprofile (+ per-worker) and report.md.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BASE_CHROME_ARGS,
  createTestServer,
  findChromeExecutable,
  delay,
  waitForDisplayPhases,
  waitForDisplaysDone,
  waitForLoadingComplete,
  waitForQuiescent,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { aggregateProfile, renderTable } from './profile-resolve.ts'
import { VOLVOX, lgvSession } from './screenshot-spec-helpers.ts'

import type { ProfileSummary } from './profile-resolve.ts'
import type { CDPSession, Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..', '..')
const jbrowseWebRoot = path.resolve(repoRoot, 'products', 'jbrowse-web')
const buildJsDir = path.join(jbrowseWebRoot, 'build', 'static', 'js')

const arg = (name: string, fallback: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback

const headed = process.argv.includes('--headed')
const throttle = Number(arg('throttle', '1'))
const loc = arg('loc', 'ctgA:1-20,000')
const tracks = arg(
  'tracks',
  'volvox_alignments,gff3tabix_genes,volvox_microarray',
).split(',')
const outDir = arg('out', path.join(repoRoot, 'perf-out'))
const PORT = 3341
const VIEWPORT = { width: 1280, height: 800, deviceScaleFactor: 1 }

interface CpuProfile {
  nodes: {
    id: number
    callFrame: {
      functionName: string
      scriptId: string
      url: string
      lineNumber: number
      columnNumber: number
    }
    hitCount?: number
    children?: number[]
  }[]
  startTime: number
  endTime: number
  samples?: number[]
  timeDeltas?: number[]
}

interface NetEntry {
  url: string
  bytes: number
  mimeType: string
  fromCache: boolean
}

// Profiler attached to one target (main frame or a worker). Kept as a plain
// object so the same start/stop pair works for both.
interface Probe {
  label: string
  session: CDPSession
}

async function startProbe(
  session: CDPSession,
  label: string,
): Promise<Probe | undefined> {
  try {
    await session.send('Profiler.enable')
    await session.send('Profiler.setSamplingInterval', { interval: 100 })
    await session.send('Profiler.start')
    return { label, session }
  } catch {
    return undefined
  }
}

async function stopProbe(probe: Probe): Promise<CpuProfile | undefined> {
  try {
    const { profile } = await probe.session.send('Profiler.stop')
    return profile
  } catch {
    return undefined
  }
}

// Every worker the page spawns gets its own profiler as soon as puppeteer
// reports it. Some worker eval before attach is unavoidable; the network table
// covers the worker bundle's download/parse cost separately.
function attachWorkerProbes(page: Page, probes: Probe[]) {
  page.on('workercreated', worker => {
    const url = worker.url()
    void startProbe(worker.client, `worker:${path.basename(url)}`).then(p => {
      if (p) {
        probes.push(p)
      }
    })
  })
}

function collectNetwork(client: CDPSession) {
  const byRequest = new Map<string, { url: string; mimeType: string }>()
  const entries: NetEntry[] = []
  client.on('Network.responseReceived', e => {
    byRequest.set(e.requestId, {
      url: e.response.url,
      mimeType: e.response.mimeType,
    })
  })
  client.on('Network.loadingFinished', e => {
    const meta = byRequest.get(e.requestId)
    if (meta) {
      entries.push({
        url: meta.url,
        bytes: e.encodedDataLength,
        mimeType: meta.mimeType,
        fromCache: e.encodedDataLength === 0,
      })
    }
  })
  return entries
}

// Page-side timings: navigation milestones + any long tasks the main thread hit.
async function installPageTimers(page: Page) {
  await page.evaluateOnNewDocument(() => {
    const w = window as unknown as {
      __perf: { longTasks: { start: number; dur: number }[] }
    }
    w.__perf = { longTasks: [] }
    try {
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) {
          w.__perf.longTasks.push({ start: e.startTime, dur: e.duration })
        }
      }).observe({ entryTypes: ['longtask'] })
    } catch {
      // longtask unsupported — table just comes back empty
    }
  })
}

async function readPageTimings(page: Page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined
    const paints = Object.fromEntries(
      performance.getEntriesByType('paint').map(p => [p.name, p.startTime]),
    )
    const w = window as unknown as {
      __perf: { longTasks: { start: number; dur: number }[] }
    }
    return {
      domContentLoaded: nav?.domContentLoadedEventEnd ?? 0,
      loadEvent: nav?.loadEventEnd ?? 0,
      firstPaint: paints['first-paint'] ?? 0,
      firstContentfulPaint: paints['first-contentful-paint'] ?? 0,
      longTasks: w.__perf.longTasks,
    }
  })
}

// Per-frame main-thread cost during a gesture: rAF deltas capture what the user
// actually feels (a frame that misses 16.7ms is a dropped frame).
async function startFrameMeter(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as {
      __frames: { deltas: number[]; stop?: () => void }
    }
    const deltas: number[] = []
    let last = performance.now()
    let running = true
    const tick = () => {
      const now = performance.now()
      deltas.push(now - last)
      last = now
      if (running) {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
    w.__frames = {
      deltas,
      stop: () => {
        running = false
      },
    }
  })
}

async function stopFrameMeter(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as {
      __frames: { deltas: number[]; stop: () => void }
    }
    w.__frames.stop()
    const d = [...w.__frames.deltas].sort((a, b) => a - b)
    const pct = (p: number) =>
      d[Math.min(d.length - 1, Math.floor(d.length * p))] ?? 0
    return {
      frames: d.length,
      median: pct(0.5),
      p90: pct(0.9),
      max: d.at(-1) ?? 0,
      dropped: d.filter(x => x > 20).length,
    }
  })
}

async function loadApp(page: Page, url: string) {
  const t0 = Date.now()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
  // zoom_in is part of the LGV header, so it appears as soon as the view mounts
  await page.waitForSelector('[data-testid="zoom_in"]', { timeout: 45000 })
  const tView = Date.now() - t0
  await waitForLoadingComplete(page, { timeout: 45000, waitForDownloads: true })
  await waitForDisplayPhases(page, 120000)
  await waitForDisplaysDone(page, 120000)
  await waitForQuiescent(page, { timeout: 45000 })
  return { toViewMs: tView, toSettledMs: Date.now() - t0 }
}

function fmtBytes(n: number) {
  return `${(n / 1024).toFixed(0)} KB`
}

function networkTable(entries: NetEntry[]) {
  const js = entries.filter(e => e.mimeType.includes('javascript'))
  const totalJs = js.reduce((a, b) => a + b.bytes, 0)
  const total = entries.reduce((a, b) => a + b.bytes, 0)
  const rows = [...js]
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 15)
    .map(e => `| ${path.basename(e.url)} | ${fmtBytes(e.bytes)} |`)
  return [
    `JS requests: ${js.length}, ${fmtBytes(totalJs)} over the wire; all requests ${entries.length}, ${fmtBytes(total)}`,
    '',
    '| chunk | transferred |',
    '| --- | --- |',
    ...rows,
  ].join('\n')
}

async function runPhase(
  page: Page,
  client: CDPSession,
  label: string,
  body: () => Promise<void>,
) {
  const probes: Probe[] = []
  attachWorkerProbes(page, probes)
  const main = await startProbe(client, 'main')
  if (main) {
    probes.push(main)
  }
  await body()
  const profiles: { label: string; profile: CpuProfile }[] = []
  for (const probe of probes) {
    const profile = await stopProbe(probe)
    if (profile?.samples?.length) {
      profiles.push({ label: probe.label, profile })
    }
  }
  for (const { label: l, profile } of profiles) {
    fs.writeFileSync(
      path.join(outDir, `${label}.${l.replace(/[^\w.-]/g, '_')}.cpuprofile`),
      JSON.stringify(profile),
    )
  }
  return profiles
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const server = await createTestServer(PORT, { jbrowseWebRoot, repoRoot })
  const browser = await launch({
    headless: !headed,
    defaultViewport: VIEWPORT,
    executablePath: findChromeExecutable(),
    // --use-angle=gl keeps headless on the hardware GL stack instead of
    // falling back to SwiftShader, which would make render cost fictional.
    args: [...BASE_CHROME_ARGS, '--use-angle=gl'],
  })
  const report: string[] = []
  const summaries: { label: string; summary: ProfileSummary }[] = []
  try {
    const url = `http://localhost:${PORT}/${lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc,
      tracks,
    })}`
    report.push(
      `# jbrowse-web startup profile`,
      '',
      `- url: \`${url.replace(`http://localhost:${PORT}`, '')}\``,
      `- tracks: ${tracks.join(', ')}`,
      `- loc: ${loc}`,
      `- cpu throttle: ${throttle}x`,
      '',
    )

    // ---- cold load (empty cache) ----
    const page = await browser.newPage()
    page.on('pageerror', e => {
      process.stderr.write(`PAGEERROR ${String(e).slice(0, 300)}\n`)
    })
    page.on('console', m => {
      if (m.type() === 'error') {
        process.stderr.write(`CONSOLE ${m.text().slice(0, 300)}\n`)
      }
    })
    await installPageTimers(page)
    const client = await page.createCDPSession()
    await client.send('Network.enable')
    await page.setCacheEnabled(false)
    if (throttle > 1) {
      await client.send('Emulation.setCPUThrottlingRate', { rate: throttle })
    }
    const net = collectNetwork(client)
    let coldTimes = { toViewMs: 0, toSettledMs: 0 }
    const coldProfiles = await runPhase(page, client, 'cold', async () => {
      coldTimes = await loadApp(page, url)
    })
    const timings = await readPageTimings(page)

    report.push(
      '## Cold load (no cache)',
      '',
      `- nav → view container: **${coldTimes.toViewMs} ms**`,
      `- nav → all displays settled: **${coldTimes.toSettledMs} ms**`,
      `- first contentful paint: ${timings.firstContentfulPaint.toFixed(0)} ms`,
      `- DOMContentLoaded: ${timings.domContentLoaded.toFixed(0)} ms`,
      `- long tasks (>50ms): ${timings.longTasks.length}, total ${timings.longTasks
        .reduce((a, b) => a + b.dur, 0)
        .toFixed(
          0,
        )} ms, worst ${Math.max(0, ...timings.longTasks.map(t => t.dur)).toFixed(0)} ms`,
      '',
      networkTable(net),
      '',
    )
    for (const { label, profile } of coldProfiles) {
      const summary = aggregateProfile(profile, buildJsDir)
      summaries.push({ label: `cold/${label}`, summary })
      report.push(`### CPU — cold ${label}`, '', renderTable(summary), '')
    }

    // ---- warm load (disk cache, same page) ----
    await page.setCacheEnabled(true)
    let warmTimes = { toViewMs: 0, toSettledMs: 0 }
    await loadApp(page, url) // prime the cache
    const warmProfiles = await runPhase(page, client, 'warm', async () => {
      warmTimes = await loadApp(page, url)
    })
    report.push(
      '## Warm load (cached bundles)',
      '',
      `- nav → view container: **${warmTimes.toViewMs} ms**`,
      `- nav → all displays settled: **${warmTimes.toSettledMs} ms**`,
      '',
    )
    for (const { label, profile } of warmProfiles) {
      const summary = aggregateProfile(profile, buildJsDir)
      summaries.push({ label: `warm/${label}`, summary })
      report.push(`### CPU — warm ${label}`, '', renderTable(summary), '')
    }

    // ---- interaction: pan + zoom within already-loaded data ----
    await delay(1000)
    await startFrameMeter(page)
    const interactionProfiles = await runPhase(
      page,
      client,
      'interaction',
      async () => {
        const box = { x: 0, w: VIEWPORT.width }
        // below the LGV header/ruler, inside the track area
        const cy = 420
        // drag-pan across the view a few times
        for (let i = 0; i < 3; i++) {
          await page.mouse.move(box.x + box.w * 0.8, cy)
          await page.mouse.down()
          for (let s = 0; s < 20; s++) {
            await page.mouse.move(box.x + box.w * (0.8 - 0.03 * s), cy)
            await delay(16)
          }
          await page.mouse.up()
          await delay(250)
        }
        // zoom in/out via the buttons (stays within loaded data)
        for (const testid of ['zoom_in', 'zoom_in', 'zoom_out', 'zoom_out']) {
          await page.click(`[data-testid="${testid}"]`)
          await delay(700)
        }
      },
    )
    const frames = await stopFrameMeter(page)
    report.push(
      '## Interaction (pan + zoom, data already loaded)',
      '',
      `- frames: ${frames.frames}, median ${frames.median.toFixed(1)} ms, p90 ${frames.p90.toFixed(1)} ms, max ${frames.max.toFixed(1)} ms`,
      `- frames over 20 ms: ${frames.dropped} (${((100 * frames.dropped) / Math.max(1, frames.frames)).toFixed(0)}%)`,
      '',
    )
    for (const { label, profile } of interactionProfiles) {
      const summary = aggregateProfile(profile, buildJsDir)
      summaries.push({ label: `interaction/${label}`, summary })
      report.push(
        `### CPU — interaction ${label}`,
        '',
        renderTable(summary),
        '',
      )
    }
  } finally {
    await browser.close()
    server.close()
  }
  const reportPath = path.join(outDir, 'report.md')
  fs.writeFileSync(reportPath, report.join('\n'))
  fs.writeFileSync(
    path.join(outDir, 'summary.json'),
    JSON.stringify(summaries, null, 2),
  )
  process.stderr.write(`\nwrote ${reportPath}\n`)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
