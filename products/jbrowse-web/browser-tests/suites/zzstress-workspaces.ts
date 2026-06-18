import { delay, navigateWithSessionSpec } from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

const N = 12

function manyViews() {
  return Array.from({ length: N }, (_, i) => ({
    type: 'LinearGenomeView',
    assembly: 'volvox',
    loc: i % 2 === 0 ? 'ctgA:1-50000' : 'ctgB:1-50000',
  }))
}

interface WidthLog {
  view: string
  total: number
  t: number
}

// Collect [WIDTHSET] console lines emitted by the gated instrumentation in
// useWidthSetter. Each line == one width-driven re-layout/re-render of a view.
function collectWidthLogs(page: Page) {
  const logs: WidthLog[] = []
  page.on('console', msg => {
    const text = msg.text()
    const m = /\[WIDTHSET] view=(\S+) width=\S+ total=(\d+) t=(\d+)/.exec(text)
    if (m) {
      logs.push({ view: m[1]!, total: Number(m[2]), t: Number(m[3]) })
    }
  })
  return logs
}

function report(label: string, logs: WidthLog[]) {
  const perView = new Map<string, number>()
  for (const l of logs) {
    perView.set(l.view, (perView.get(l.view) ?? 0) + 1)
  }
  const times = logs.map(l => l.t)
  const span = times.length ? Math.max(...times) - Math.min(...times) : 0
  // bucket setWidth events into 500ms windows to see burst-vs-sustained
  const buckets = new Map<number, number>()
  const t0 = times.length ? Math.min(...times) : 0
  for (const t of times) {
    const b = Math.floor((t - t0) / 500)
    buckets.set(b, (buckets.get(b) ?? 0) + 1)
  }
  const timeline = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([b, c]) => `${b * 500}ms:${c}`)
    .join(' ')

  console.log(`\n===== ${label} =====`)
  console.log(`views=${perView.size} totalSetWidth=${logs.length} span=${span}ms`)
  console.log(`avgPerView=${(logs.length / Math.max(perView.size, 1)).toFixed(1)}`)
  console.log(`maxPerView=${Math.max(0, ...perView.values())}`)
  console.log(`timeline(500ms buckets): ${timeline}`)
}

const suite: TestSuite = {
  name: 'ZZStress Workspaces',
  tests: [
    {
      name: 'classic: N views, count width-driven re-layouts',
      fn: async page => {
        await page.evaluateOnNewDocument(() => {
          ;(globalThis as unknown as { __WIDTH_DEBUG__: boolean }).__WIDTH_DEBUG__ =
            true
        })
        const logs = collectWidthLogs(page)
        await navigateWithSessionSpec(page, { views: manyViews() })
        await delay(8000)
        report('CLASSIC', logs)
      },
    },
    {
      name: 'tiled: N views in one dockview panel, count re-layouts',
      fn: async page => {
        await page.evaluateOnNewDocument(() => {
          ;(globalThis as unknown as { __WIDTH_DEBUG__: boolean }).__WIDTH_DEBUG__ =
            true
        })
        const logs = collectWidthLogs(page)
        await navigateWithSessionSpec(page, {
          views: manyViews(),
          layout: { views: Array.from({ length: N }, (_, i) => i) },
        })
        await delay(8000)
        report('TILED (one panel)', logs)
      },
    },
  ],
}

export default suite
