/* eslint-disable no-console */
// What a cold load shows: every screencast frame with its time, plus layout
// shifts and long tasks, for one BAM track and the hg38 hub's default session.
// Read the frames as a contact sheet; a millisecond figure cannot say what was
// on screen while it ran.
//
//   node browser-tests/probe-coldload-film.ts [--out=dir] [--latency=20] [--ms=2500]
//
// Run after a build. Pin Chrome to a few cores (`taskset -c 0-3 node …`) to
// see what a laptop sees rather than a 24-core box.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { localhostCert, startSecureServerOnFreePort } from './server.ts'

const flag = (n: string) =>
  process.argv.find(a => a.startsWith(`--${n}=`))?.split('=')[1]
const out = flag('out') ?? path.join(os.tmpdir(), 'coldload-film')
const latency = Number(flag('latency') ?? 20)
const total = Number(flag('ms') ?? 2500)

const pages: Record<string, string> = {
  bam: 'config=test_data/volvox/config.json&assembly=volvox&loc=ctgA:1-20000&tracks=volvox_bam&renderer=canvas2d',
  hub: 'config=https://jbrowse.org/ucsc/hg38/config.json',
}

async function main() {
  const tls = localhostCert()
  const local = await startSecureServerOnFreePort(3372, tls)
  const root = `https://localhost:${local.port}/`
  for (const [name, q] of Object.entries(pages)) {
    const dir = path.join(out, name)
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    const browser = await launch({
      headless: true,
      args: [
        ...BASE_CHROME_ARGS,
        `--ignore-certificate-errors-spki-list=${tls.spki}`,
      ],
    })
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })
    const client = await page.createCDPSession()
    await client.send('Network.enable')
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency,
      downloadThroughput: -1,
      uploadThroughput: -1,
    })
    await page.evaluateOnNewDocument(() => {
      const w = window as any
      w.__shifts = []
      w.__long = []
      w.__marks = {}
      new PerformanceObserver(l => {
        for (const e of l.getEntries() as any[]) {
          w.__shifts.push({
            t: Math.round(e.startTime),
            v: +e.value.toFixed(4),
            who: (e.sources ?? [])
              .map(
                (s: any) =>
                  `${s.node?.nodeName ?? '?'}.${(s.node?.className?.baseVal ?? s.node?.className ?? '').toString().slice(0, 40)}`,
              )
              .slice(0, 3),
          })
        }
      }).observe({ type: 'layout-shift', buffered: true })
      new PerformanceObserver(l => {
        for (const e of l.getEntries()) {
          w.__long.push({
            t: Math.round(e.startTime),
            d: Math.round(e.duration),
          })
        }
      }).observe({ type: 'longtask', buffered: true })
      new PerformanceObserver(l => {
        for (const e of l.getEntries()) {
          w.__marks[e.name] = Math.round(e.startTime)
        }
      }).observe({ type: 'paint', buffered: true })
      new MutationObserver(() => {
        const m = w.__marks
        if (!m.drawn && document.querySelector('[data-display-drawn="true"]')) {
          m.drawn = Math.round(performance.now())
        }
        if (!m.ready && document.querySelector('[data-app-phase="ready"]')) {
          m.ready = Math.round(performance.now())
        }
      }).observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
      })
    })
    const frames: { t: number; file: string }[] = []
    let t0: number | undefined
    client.on('Page.screencastFrame', e => {
      const ts = e.metadata.timestamp ?? 0
      t0 ??= ts
      const file = `f${String(frames.length).padStart(3, '0')}.jpg`
      fs.writeFileSync(path.join(dir, file), Buffer.from(e.data, 'base64'))
      frames.push({ t: Math.round((ts - t0) * 1000), file })
      void client
        .send('Page.screencastFrameAck', { sessionId: e.sessionId })
        .catch(() => {})
    })
    await client.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 60,
      everyNthFrame: 1,
    })
    const navStart = Date.now()
    await page.goto(`${root}?${q}`)
    await new Promise(r => setTimeout(r, total - (Date.now() - navStart)))
    await client.send('Page.stopScreencast')
    const data = await page.evaluate(() => {
      const w = window as any
      return { shifts: w.__shifts, long: w.__long, marks: w.__marks }
    })
    const nav = await page.evaluate(() => Math.round(performance.timeOrigin))
    fs.writeFileSync(
      path.join(dir, 'report.json'),
      JSON.stringify({ frames, nav, navStart, ...data }, null, 1),
    )
    const cls = data.shifts.reduce((a: number, s: any) => a + s.v, 0)
    console.log(
      `${name}: ${frames.length} frames, marks ${JSON.stringify(data.marks)}, CLS ${cls.toFixed(3)} over ${data.shifts.length} shifts, long tasks ${JSON.stringify(data.long)}`,
    )
    await browser.close()
  }
  local.server.close()
  process.exit(0)
}

void main()
