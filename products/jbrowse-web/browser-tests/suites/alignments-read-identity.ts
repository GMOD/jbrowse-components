import {
  delay,
  findByTestId,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

const pileup = 'pileup-display'

// A read's id leaves the alignments arrays at exactly three places — the hover
// tooltip, `featureIdUnderMouse`, and the feature-details fetch — and the worker
// ships a numeric record id plus a prefix rather than the string itself
// (plugins/alignments/src/shared/readIdentity.ts). So the string is rebuilt on
// the main thread and then compared, in the WORKER, against a real
// `feature.id()` (`GetFeatureDetails`). Nothing in the unit suites crosses that
// boundary, and a prefix that was wrong would not throw: the details fetch would
// simply find nothing, and the click would land on a "Could not load details"
// notification instead of a widget.
//
// Which is why these tests are here and why they assert the feature came back
// rather than only that something was clicked.
interface FeatureInfo {
  name: string
  start: number
  end: number
}
interface Display {
  readIdIndexMap: ReadonlyMap<string, unknown>
  getFeatureInfoById: (id: string) => FeatureInfo | undefined
  withFeatureById: (
    id: string,
    onFeat: (feat: { get: (field: string) => unknown }) => void,
  ) => Promise<void>
  featureIdUnderMouse: string | undefined
}
interface LiveModel {
  JBrowseSession: {
    views: { tracks: { displays: Display[] }[] }[]
    widgets: ReadonlyMap<string, { featureData?: { name?: string } }>
  }
}

async function loadPileup(page: Page) {
  await navigateWithSessionSpec(page, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgA:1000-2000',
        tracks: ['volvox_alignments_pileup_coverage'],
      },
    ],
  })
  await findByTestId(page, pileup, 60000)
  await waitForDataLoaded(page)
  await delay(1000)
}

const suite: TestSuite = {
  name: 'Alignments Read Identity',
  tests: [
    {
      // The round trip in full: take ids the way a hover does (the keys of
      // `readIdIndexMap`, which is where the strings are built at all), then
      // fetch each read's details through the RPC that matches them against
      // `feature.id()` in the worker. A wrong prefix loses every one of them.
      name: 'a read id resolves to its feature through the details RPC',
      fn: async page => {
        await loadPileup(page)
        const resolved = await page.evaluate(async () => {
          const { JBrowseSession } = window as unknown as LiveModel
          const display = JBrowseSession.views[0]!.tracks[0]!.displays[0]!
          const ids = [...display.readIdIndexMap.keys()]
          const sample = [
            ids[0]!,
            ids[Math.floor(ids.length / 2)]!,
            ids.at(-1)!,
          ]
          const out = []
          for (const id of sample) {
            const info = display.getFeatureInfoById(id)
            const feat = await new Promise<{
              name: unknown
              start: unknown
              end: unknown
            } | null>(resolve => {
              const timer = setTimeout(() => {
                resolve(null)
              }, 20000)
              void display.withFeatureById(id, f => {
                clearTimeout(timer)
                resolve({
                  name: f.get('name'),
                  start: f.get('start'),
                  end: f.get('end'),
                })
              })
            })
            out.push({ id, info, feat })
          }
          return { total: ids.length, out }
        })
        // A pileup at this locus is ~90 reads; a zero here would make every
        // assertion below vacuous.
        if (resolved.total < 10) {
          throw new Error(`expected a loaded pileup, got ${resolved.total} ids`)
        }
        for (const { id, info, feat } of resolved.out) {
          if (!feat) {
            throw new Error(`no feature came back for ${id}`)
          }
          // The array-side answer and the worker's own record agree, which is
          // what says the id names the same read on both sides of the boundary.
          if (!info) {
            throw new Error(`the arrays hold no read for ${id}`)
          }
          if (feat.name !== info.name || feat.start !== info.start) {
            throw new Error(
              `details for ${id} disagree with the arrays: ${JSON.stringify({ info, feat })}`,
            )
          }
        }
      },
    },
    {
      // The same path a user takes. A click hit-tests to a read, hands its id
      // to `selectFeatureById`, and the widget that opens carries the read's
      // QNAME — so the assertion is the read's own name, not merely that a
      // widget appeared.
      name: 'clicking a read opens its details widget',
      fn: async page => {
        await loadPileup(page)
        const box = await page.evaluate(() => {
          const el = document.querySelector(
            `[data-testid="pileup-display"] canvas`,
          )!
          const r = el.getBoundingClientRect()
          return { x: r.x, y: r.y, width: r.width, height: r.height }
        })
        // 30% down the display, below the coverage band and inside the dense
        // pileup — the same spot the read-vs-ref context-menu test uses.
        await page.mouse.click(
          box.x + box.width * 0.5,
          box.y + box.height * 0.3,
        )
        await delay(2000)
        const seen = await page.evaluate(() => {
          const { JBrowseSession } = window as unknown as LiveModel
          const display = JBrowseSession.views[0]!.tracks[0]!.displays[0]!
          const names = [...JBrowseSession.widgets.values()]
            .map(w => w.featureData?.name)
            .filter(Boolean)
          return { names, hovered: display.featureIdUnderMouse }
        })
        if (seen.names.length === 0) {
          throw new Error(
            'clicking a read opened no feature widget — the details fetch found nothing',
          )
        }
        // volvox read names are `ctgA_<n>`; anything else means the widget
        // opened on something other than the read that was clicked.
        if (!seen.names.some(n => n!.startsWith('ctgA_'))) {
          throw new Error(`unexpected feature names: ${seen.names.join(', ')}`)
        }
      },
    },
  ],
}

export default suite
