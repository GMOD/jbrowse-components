import assert from 'node:assert/strict'

import {
  delay,
  findByTestId,
  navigateToUrl,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { dualSnapshot, pageSnapshot } from '../snapshot.ts'

import type { Page } from 'puppeteer'
import type { TestSuite } from '../types.ts'

// Leading x of every overlay connector path (the `M <x> <y> ...` moveto).
async function overlayPathStartXs(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('svg path[data-testid]')].map(p =>
      Number.parseFloat((p.getAttribute('d') ?? '').split(' ')[1] ?? 'NaN'),
    ),
  )
}

const suite: TestSuite = {
  name: 'Breakpoint Split View',
  tests: [
    {
      name: 'breakpoint split view loads default session (hg19)',
      fn: async page => {
        await navigateToUrl(page, 'config=test_data/breakpoint/config.json')

        // BSV has two LGV sub-views with alignments tracks
        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await pageSnapshot(page, 'bsv-hg19-default-session')
      },
    },
    {
      name: 'breakpoint split view canvas screenshot',
      fn: async page => {
        await navigateToUrl(page, 'config=test_data/breakpoint/config.json')

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'bsv-hg19-pileup-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
    {
      name: 'volvox inversion breakpoint split view',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'BreakpointSplitView',
              views: [
                {
                  type: 'LinearGenomeView',
                  assembly: 'volvox',
                  loc: 'ctgA:1-50000',
                  tracks: ['volvox_sv'],
                },
                {
                  type: 'LinearGenomeView',
                  assembly: 'volvox',
                  loc: 'ctgA:1-50000',
                  tracks: ['volvox_sv'],
                },
              ],
            },
          ],
        })

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await delay(1000)
        await pageSnapshot(page, 'bsv-volvox-inversion')
      },
    },
    {
      // Regression: the overlay's per-level offsetPx/scrollTop/height snapshot
      // used to be read in a react-compiler-memoized hook keyed on (model,
      // trackId, domYOffsets) — none of which change when a view pans or zooms.
      // The frozen snapshot combined with a live bpToPx put the connectors
      // millions of px off-screen on zoom, and pinned them in place on pan.
      name: 'overlay connectors track pan and zoom',
      fn: async page => {
        await navigateToUrl(page, 'config=test_data/breakpoint/config.json')
        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await delay(2000)

        const initial = await overlayPathStartXs(page)
        assert.ok(initial.length > 0, 'expected overlay connectors to render')

        await page.evaluate(() => {
          // @ts-expect-error debug handle exposed by JBrowse.tsx
          for (const v of window.JBrowseRootModel.session.views[0].views) {
            v.horizontalScroll(100)
          }
        })
        await delay(2000)
        const panned = await overlayPathStartXs(page)
        for (const [i, x] of panned.entries()) {
          assert.ok(
            Math.abs(x - (initial[i]! - 100)) < 1,
            `connector ${i} must follow a 100px pan: ${initial[i]} -> ${x}`,
          )
        }

        await page.evaluate(() => {
          // @ts-expect-error debug handle exposed by JBrowse.tsx
          for (const v of window.JBrowseRootModel.session.views[0].views) {
            v.zoomTo(v.bpPerPx * 4)
          }
        })
        await delay(3000)
        const width = await page.evaluate(() => window.innerWidth)
        for (const [i, x] of (await overlayPathStartXs(page)).entries()) {
          assert.ok(
            x > -width && x < 2 * width,
            `connector ${i} must stay near the viewport after zoom out, got ${x}`,
          )
        }
      },
    },
  ],
}

export default suite
