/* eslint-disable no-console */
// Browser counterpart of jbrowse-web's `ZoomRenderCensus` jest suite: attribute
// every DOM mutation during a zoom to its nearest identifiable subtree, in a
// real bundle with real layout, and count the overlays that are mounted at all.
//
//   node browser-tests/probe-zoom-churn.ts [--headed] [--start]
//
// Two things it does that `website/scripts/measure-zoom-churn.ts` does not, both
// load-bearing for what it is checking:
//
// - **Mid-contig by default** (`ctgA:20000-24000`, `--start` for `ctgA:1-`).
//   A view at the genome start keeps a boundary PaddingBlock on screen for the
//   whole gesture, so it is the one regime where the per-track padding overlay
//   has something to draw — and therefore the one regime that cannot see
//   whether it stopped drawing it.
// - **Eight tracks.** Every per-frame cost here is either view-global or paid
//   once per track, and which of the two a component is decides whether it
//   matters in a real session.
//
// The census this mirrors runs in jsdom, where there is no layout and no
// compositor. Its counts being reproduced here is what says the jsdom numbers
// describe the app rather than the shim.
import {
  BASE_CHROME_ARGS,
  encodeSessionSpec,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { startServerOnFreePort } from './server.ts'

import type { Page } from 'puppeteer'

const headed = process.argv.includes('--headed')
const atStart = process.argv.includes('--start')
const LOC = atStart ? 'ctgA:1-4000' : 'ctgA:20000-24000'
const ZOOMS = Number(process.env.ZOOMS || 6)

const TRACKS = [
  'volvox_microarray',
  'volvox_microarray_multi',
  'volvox_filtered_vcf',
  'volvox_gc',
  'volvox_microarray_line',
  'volvox_microarray_density',
  'volvox_test_vcf',
  'volvox_microarray_color',
]

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

async function startObserver(page: Page) {
  await page.evaluate(() => {
    const counts = new Map<string, number>()
    const labelFor = (node: Node) => {
      let el: HTMLElement | null =
        node.nodeType === 1 ? (node as HTMLElement) : node.parentElement
      const trail: string[] = []
      for (let i = 0; el && i < 12; i++) {
        const testid = el.dataset.testid
        if (testid) {
          return `${testid} > ${trail.slice(0, 2).reverse().join('/')}`
        }
        const cls = (el.className || '').toString().split(' ')[0]
        if (cls) {
          trail.push(cls)
        }
        el = el.parentElement
      }
      return trail.slice(-3).reverse().join('/') || node.nodeName
    }
    const obs = new MutationObserver(records => {
      for (const r of records) {
        const structural = r.addedNodes.length + r.removedNodes.length
        const kind = r.type === 'attributes' ? 'attr' : 'struct'
        const key = `${kind}  ${labelFor(r.target)}`
        counts.set(key, (counts.get(key) ?? 0) + (structural || 1))
      }
    })
    obs.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    })
    Object.assign(window, { __churn: counts, __churnObs: obs })
  })
}

// Two unambiguous counts, rather than a computed-style heuristic that cannot
// tell a `PaddingBlocks` wrapper from a `Gridlines` one — they render the same
// `ZoomTransform`. Total elements, and the elements carrying an inline
// `translateX`, which is what `ZoomTransform` writes: an instance that renders
// contributes two of the first and one of the second, whether or not it has any
// span to draw.
async function domCounts(page: Page) {
  return page.evaluate(() => ({
    elements: document.querySelectorAll('*').length,
    translated: document.querySelectorAll('[style*="translateX"]').length,
  }))
}

const { port } = await startServerOnFreePort(3000)
const spec = encodeSessionSpec({
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: LOC,
      tracks: TRACKS,
    },
  ],
})
const url = `http://localhost:${port}/?config=test_data/volvox/config.json&sessionName=Churn&session=${spec}`

const browser = await launch({
  headless: !headed,
  args: [...BASE_CHROME_ARGS, '--window-size=1280,800'],
  defaultViewport: { width: 1280, height: 800 },
})

try {
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 })
  await page.waitForSelector('[data-display-drawn="true"]', { timeout: 90000 })
  await delay(3000)

  const dom = await domCounts(page)
  const spans = await page.evaluate(
    () =>
      (window as unknown as { JBrowseRootModel: any }).JBrowseRootModel.session
        .views[0].paddingSpans.length as number,
  )

  await startObserver(page)
  for (let i = 0; i < ZOOMS; i++) {
    const btn = await page.$('[data-testid="zoom_in"]')
    // eslint-disable-next-line no-await-in-loop
    await btn?.click()
    // eslint-disable-next-line no-await-in-loop
    await delay(700)
  }
  await delay(500)

  const dump = await page.evaluate(() => {
    const w = window as unknown as {
      __churn: Map<string, number>
      __churnObs: MutationObserver
    }
    w.__churnObs.disconnect()
    return [...w.__churn.entries()].sort((a, b) => b[1] - a[1])
  })

  let total = 0
  let structural = 0
  for (const [k, n] of dump) {
    total += n
    if (k.startsWith('struct')) {
      structural += n
    }
  }
  console.log(
    `\n=== ${LOC}, ${TRACKS.length} tracks, ${ZOOMS} zoom clicks ===\n` +
      `view.paddingSpans          ${spans}\n` +
      `DOM elements               ${dom.elements}\n` +
      `  with inline translateX   ${dom.translated}\n` +
      `DOM mutations              ${total}\n` +
      `  structural               ${structural}\n`,
  )
  for (const [k, n] of dump.slice(0, 20)) {
    console.log(`${String(n).padStart(6)}  ${k}`)
  }
} finally {
  await browser.close()
  process.exit(0)
}
