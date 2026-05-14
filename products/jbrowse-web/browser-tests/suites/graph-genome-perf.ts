// Performance tests for GraphGenomeView. The Jest suites cover the parse /
// convert / buildGeometry pipeline in isolation; these pin the *instrumented*
// end-to-end path in a real browser: GetSubgraph RPC latency (fetchMs), the
// Bandage FMMM layout compute time (layoutMs) and the main-thread geometry
// build (geometryMs) are all surfaced on the model and rendered into the
// `graph-perf-stats` element as data-* attributes by GraphStats.tsx.
//
// Budgets are deliberately generous — they catch catastrophic regressions
// (an accidental O(n^2), a layout that never returns, a fetch that hangs)
// without flaking on a slow CI runner. The volvox pangenome subgraph is a
// few hundred nodes, which is the realistic small-region case.

import {
  PORT,
  appendGpuParam,
  assertCanvasHasContent,
  delay,
  findByTestId,
  findByText,
} from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

interface PerfMetrics {
  fetchMs: number
  layoutMs: number
  geometryMs: number
  geometryVertices: number
}

async function openGraphGenomeView(page: Page) {
  const url = appendGpuParam(
    `http://localhost:${PORT}/?config=test_data/volvox/config.json&sessionName=Test%20Session`,
  )
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })
  await (await findByText(page, 'Add'))?.click()
  await delay(300)
  await (await findByText(page, 'Graph genome view'))?.click()
  await delay(500)
}

async function loadRegionInImportForm(page: Page, region: string) {
  const trackSelectTrigger = await page.waitForSelector(
    '[data-testid="gfa-track-field"] .MuiSelect-select',
    { timeout: 10000 },
  )
  await trackSelectTrigger?.click()
  await delay(400)
  const option = await page.waitForSelector('[role="option"]', {
    timeout: 5000,
  })
  await option?.click()
  await delay(300)

  const locInput = await page.waitForSelector(
    '[data-testid="gfa-loc-field"] input',
    { timeout: 5000 },
  )
  await locInput?.click()
  await locInput?.type(region, { delay: 40 })
  await locInput?.press('Escape')
  await delay(300)

  const openBtn = await findByTestId(page, 'gfa-open-btn', 5000)
  await openBtn?.click()
}

// Reads the data-* attributes off the perf readout. The element renders as
// soon as the *first* metric is set (fetchMs, before layout/geometry), so we
// must wait until all four are populated — otherwise the unset ones read back
// as NaN, which puppeteer serialises to null, which silently passes `>= 0`
// budget checks.
async function readPerfMetrics(
  page: Page,
  timeout = 90000,
): Promise<PerfMetrics> {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="graph-perf-stats"]')
      if (!el) {
        return false
      }
      const ready = (name: string) => {
        const v = el.getAttribute(name)
        return v !== null && v !== '' && Number.isFinite(parseFloat(v))
      }
      return (
        ready('data-fetch-ms') &&
        ready('data-layout-ms') &&
        ready('data-geometry-ms') &&
        ready('data-geometry-vertices')
      )
    },
    { timeout, polling: 200 },
  )
  return page.$eval('[data-testid="graph-perf-stats"]', el => {
    const num = (name: string) => parseFloat(el.getAttribute(name) ?? '')
    return {
      fetchMs: num('data-fetch-ms'),
      layoutMs: num('data-layout-ms'),
      geometryMs: num('data-geometry-ms'),
      geometryVertices: num('data-geometry-vertices'),
    }
  })
}

const suite: TestSuite = {
  name: 'Graph Genome View — performance',
  tests: [
    {
      name: 'instrumented subgraph load reports fetch/layout/geometry timing',
      fn: async page => {
        await openGraphGenomeView(page)
        await findByText(page, 'Load a GFA graph', 10000)
        await loadRegionInImportForm(page, 'ctgA:1-50000')

        await page.waitForSelector('[data-testid="graph-genome-canvas"]', {
          timeout: 90000,
        })
        const m = await readPerfMetrics(page)

        // fetch is a real RPC round-trip — present and non-negative
        if (!(m.fetchMs >= 0)) {
          throw new Error(`fetchMs not captured: ${m.fetchMs}`)
        }
        // Bandage FMMM layout compute (not the WASM download) — a few hundred
        // nodes should be well under the ceiling
        if (!(m.layoutMs >= 0 && m.layoutMs < 20000)) {
          throw new Error(`layoutMs out of budget: ${m.layoutMs}`)
        }
        // main-thread geometry build
        if (!(m.geometryMs >= 0 && m.geometryMs < 5000)) {
          throw new Error(`geometryMs out of budget: ${m.geometryMs}`)
        }
        // a real subgraph produced a real mesh
        if (!(m.geometryVertices > 0)) {
          throw new Error(
            `geometryVertices not captured: ${m.geometryVertices}`,
          )
        }

        await delay(1000)
        await assertCanvasHasContent(
          page,
          '[data-testid="graph-genome-canvas"]',
          { minDistinctColors: 4 },
        )

        // eslint-disable-next-line no-console
        console.log(
          `      graph perf: fetch=${Math.round(m.fetchMs)}ms ` +
            `layout=${Math.round(m.layoutMs)}ms ` +
            `geometry=${Math.round(m.geometryMs)}ms ` +
            `vertices=${m.geometryVertices}`,
        )
      },
    },
    {
      name: 'pan/zoom rebuilds geometry and stays within budget',
      fn: async page => {
        await openGraphGenomeView(page)
        await findByText(page, 'Load a GFA graph', 10000)
        await loadRegionInImportForm(page, 'ctgA:1-50000')

        const canvas = await page.waitForSelector(
          '[data-testid="graph-genome-canvas"]',
          { timeout: 90000 },
        )
        await readPerfMetrics(page)
        await delay(1000)

        // Zoom in with the wheel over the canvas center, a few times.
        const box = await canvas!.boundingBox()
        if (!box) {
          throw new Error('graph canvas has no bounding box')
        }
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2
        await page.mouse.move(cx, cy)
        for (let i = 0; i < 5; i++) {
          await page.mouse.wheel({ deltaY: -120 })
          await delay(120)
        }
        // viewportDirty is debounced (150ms) then triggers a geometry rebuild
        await delay(800)

        const after = await readPerfMetrics(page)
        // the rebuild after zoom must still be within the main-thread budget
        if (!(after.geometryMs >= 0 && after.geometryMs < 5000)) {
          throw new Error(
            `post-zoom geometryMs out of budget: ${after.geometryMs}`,
          )
        }
        // canvas is still showing real content after the zoom interaction
        await assertCanvasHasContent(
          page,
          '[data-testid="graph-genome-canvas"]',
          { minDistinctColors: 4 },
        )
      },
    },
    {
      name: 'no console errors during instrumented subgraph load',
      fn: async page => {
        const errors: string[] = []
        page.on('console', msg => {
          if (msg.type() === 'error') {
            errors.push(msg.text())
          }
        })

        await openGraphGenomeView(page)
        await findByText(page, 'Load a GFA graph', 10000)
        await loadRegionInImportForm(page, 'ctgA:1-50000')
        await page.waitForSelector('[data-testid="graph-genome-canvas"]', {
          timeout: 90000,
        })
        await readPerfMetrics(page)
        await delay(500)

        const relevant = errors.filter(
          e =>
            e.toLowerCase().includes('getsubgraph') ||
            e.toLowerCase().includes('graphcomputelayout') ||
            e.toLowerCase().includes('failed to fetch') ||
            e.toLowerCase().includes('rpcmanager'),
        )
        if (relevant.length > 0) {
          throw new Error(
            `Console errors during instrumented load: ${relevant.join('; ')}`,
          )
        }
      },
    },
  ],
}

export default suite
