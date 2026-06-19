/**
 * Standalone repro for the dockview/workspaces freeze.
 * Loads N heavy GPU genome views in Classic vs Tiled (dockview) and measures:
 *  - GPU context churn (WebGL2Hal init/dispose, context LOST, GL error)
 *  - load wall-time
 *  - main-thread responsiveness (rAF frame intervals + longtask total) during a
 *    programmatic vertical scroll of the view list
 *
 * Run: node products/jbrowse-web/browser-tests/repro.ts (after copying here) OR
 * via tsx. We import the repo's server + encoder so encoding can't drift.
 */
import { launch } from 'puppeteer'

import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

import { startServer } from './server.ts'

import type { Browser, Page } from 'puppeteer'

const PORT = 3344
const N = Number(process.env.N ?? 12)
const TRACKS = (
  process.env.TRACKS ?? 'volvox_cram_alignments'
).split(',')
const LOC = process.env.LOC ?? 'ctgA:1-20000'

function buildSpec() {
  return {
    views: Array.from({ length: N }, () => ({
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: LOC,
      tracks: TRACKS,
    })),
  }
}

interface Counters {
  glInit: number
  glDispose: number
  contextLost: number
  glError: number
  uncaptured: number
}

function attachConsole(page: Page, counters: Counters) {
  page.on('console', msg => {
    const t = msg.text()
    if (t.includes('[WebGL2Hal #')) {
      if (t.includes('init')) counters.glInit++
      if (t.includes('dispose')) counters.glDispose++
    }
    if (t.includes('context LOST') || t.includes('CONTEXT_LOST')) {
      counters.contextLost++
    }
    if (t.includes('GL error') || t.includes('GL_INVALID')) counters.glError++
    if (t.toLowerCase().includes('uncaptured')) counters.uncaptured++
  })
  page.on('pageerror', e => {
    console.log('  [pageerror]', e.message.slice(0, 200))
  })
}

async function runMode(browser: Browser, useWorkspaces: boolean) {
  const counters: Counters = {
    glInit: 0,
    glDispose: 0,
    contextLost: 0,
    glError: 0,
    uncaptured: 0,
  }
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  attachConsole(page, counters)

  const backend = process.env.BACKEND ?? 'webgl'
  // Firefox BiDi throws "Permission denied" when touching localStorage on
  // about:blank, so visit the origin first, then seed the flag with evaluate().
  await page.goto(`http://localhost:${PORT}/`, {
    waitUntil: 'load',
    timeout: 60000,
  })
  await page.evaluate((on: boolean) => {
    localStorage.setItem('useWorkspaces', on ? 'true' : 'false')
  }, useWorkspaces)

  const spec = encodeSessionSpec(buildSpec())
  const url = `http://localhost:${PORT}/?config=test_data/volvox/config.json&session=${spec}&sessionName=Stress&renderer=${backend}`

  const t0 = Date.now()
  await page.goto(url, { waitUntil: 'load', timeout: 90000 })

  // Wait until all N view containers exist
  await page.waitForFunction(
    (n: number) =>
      document.querySelectorAll('[data-testid^="view-container-"]').length >= n,
    { timeout: 90000 },
    N,
  )
  // With lazy view mounting, only near-viewport views render canvases, so we no
  // longer expect canvas count == N. Wait for the visible band to render at
  // least one canvas, then settle for late GPU draws / context churn.
  await page
    .waitForFunction(() => document.querySelectorAll('canvas').length >= 1, {
      timeout: 90000,
    })
    .catch(() => console.log('  (no canvas rendered at all — render failed?)'))
  await new Promise(r => setTimeout(r, 6000))

  const loadMs = Date.now() - t0

  const canvasCount = await page.evaluate(
    () => document.querySelectorAll('canvas').length,
  )
  const dockviewGroups = await page.evaluate(
    () => document.querySelectorAll('.dv-groupview').length,
  )

  // Responsiveness probe: sample rAF intervals for 3s while scrolling the view
  // list. Long gaps between frames == main thread stalled.
  const probe = await page.evaluate(async () => {
    const scroller =
      (document.querySelector(
        '[data-testid^="view-container-"]',
      ) as HTMLElement | null)?.closest('[style*="overflow"], .dv-content-container') ??
      document.scrollingElement ??
      document.body
    // find an actually-scrollable ancestor
    let el: HTMLElement | null = document.querySelector(
      '[data-testid^="view-container-"]',
    )
    let scrollEl: HTMLElement = document.scrollingElement as HTMLElement
    while (el) {
      const oy = getComputedStyle(el).overflowY
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) {
        scrollEl = el
        break
      }
      el = el.parentElement
    }
    void scroller

    const frames: number[] = []
    let last = performance.now()
    let longtaskTotal = 0
    const po = new PerformanceObserver(list => {
      for (const e of list.getEntries()) longtaskTotal += e.duration
    })
    try {
      po.observe({ entryTypes: ['longtask'] })
    } catch {
      /* longtask unsupported */
    }

    const start = performance.now()
    let dir = 1
    await new Promise<void>(resolve => {
      function step() {
        const now = performance.now()
        frames.push(now - last)
        last = now
        // drive a scroll each frame
        scrollEl.scrollTop += dir * 120
        if (
          scrollEl.scrollTop + scrollEl.clientHeight >=
            scrollEl.scrollHeight - 5 ||
          scrollEl.scrollTop <= 0
        ) {
          dir *= -1
        }
        if (now - start < 3000) {
          requestAnimationFrame(step)
        } else {
          resolve()
        }
      }
      requestAnimationFrame(step)
    })
    po.disconnect()

    frames.sort((a, b) => a - b)
    const sum = frames.reduce((a, b) => a + b, 0)
    const max = frames.at(-1) ?? 0
    const p95 = frames[Math.floor(frames.length * 0.95)] ?? 0
    const median = frames[Math.floor(frames.length / 2)] ?? 0
    return {
      frameCount: frames.length,
      avgFrameMs: sum / frames.length,
      medianFrameMs: median,
      p95FrameMs: p95,
      maxFrameMs: max,
      longtaskTotalMs: Math.round(longtaskTotal),
      scrollHeight: scrollEl.scrollHeight,
      clientHeight: scrollEl.clientHeight,
    }
  })

  await page.close()
  return { loadMs, canvasCount, dockviewGroups, counters, probe }
}

async function main() {
  console.log(`Starting server on ${PORT}...`)
  const server = await startServer(PORT)

  // ORDER=tiled-first runs dockview first (to rule out cold-start ordering bias)
  const order =
    process.env.ORDER === 'tiled-first' ? [true, false] : [false, true]
  for (const useWorkspaces of order) {
    const label = useWorkspaces ? 'TILED (dockview)' : 'CLASSIC'
    console.log(
      `\n===== ${label} — ${N} views, tracks=${TRACKS.join('+')}, loc=${LOC} =====`,
    )
    const useFirefox = process.env.BROWSER === 'firefox'
    const browser = useFirefox
      ? await launch({
          browser: 'firefox',
          executablePath:
            process.env.FIREFOX_NIGHTLY_PATH ?? '/usr/bin/firefox-nightly',
          headless: false,
          protocolTimeout: 200000,
          timeout: 60000,
          extraPrefsFirefox: {
            'dom.webgpu.enabled': true,
            'gfx.webrender.all': true,
            'gfx.webgpu.ignore-blocklist': true,
          },
          defaultViewport: { width: 1280, height: 900 },
        })
      : await launch({
          headless: false,
          protocolTimeout: 200000,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--window-size=1300,950',
          ],
          defaultViewport: null,
        })
    try {
      const r = await runMode(browser, useWorkspaces)
      console.log(JSON.stringify(r, null, 2))
    } catch (e) {
      console.log('  RUN ERROR:', (e as Error).message)
    } finally {
      await browser.close()
    }
  }

  await server.close?.()
  process.exit(0)
}

void main()
