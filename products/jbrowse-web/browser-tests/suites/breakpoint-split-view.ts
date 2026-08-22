import assert from 'node:assert/strict'

import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  delay,
  findDisplayPainted,
  navigateToUrl,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { dualSnapshot, pageSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

// Leading x of every overlay connector path (the `M <x> <y> ...` moveto).
async function overlayPathStartXs(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('svg path[data-testid]')].map(p =>
      Number.parseFloat((p.getAttribute('d') ?? '').split(' ')[1] ?? 'NaN'),
    ),
  )
}

// Points along connector `index`, in page coordinates. The connector is 1px wide
// until it is hovered, so the pointer has to land on the curve itself rather
// than on the bounding-box centre page.hover() would aim at, and one sampled
// point can still fall under another element.
async function pointsOnConnector(page: Page, index: number) {
  return page.evaluate(i => {
    const el = [...document.querySelectorAll('svg path[data-testid="r1"]')][
      i
    ] as SVGPathElement | undefined
    if (!el) {
      return []
    }
    const svg = el.ownerSVGElement!.getBoundingClientRect()
    const len = el.getTotalLength()
    return [0.5, 0.35, 0.65, 0.2, 0.8].map(f => {
      const p = el.getPointAtLength(len * f)
      return { x: svg.left + p.x, y: svg.top + p.y }
    })
  }, index)
}

async function chainHighlightRects(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('rect[data-testid="chain-highlight"]')].map(
      r => ({
        y: Number(r.getAttribute('y')),
        width: Number(r.getAttribute('width')),
        height: Number(r.getAttribute('height')),
      }),
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
        await findDisplayPainted(page, 'pileup-display', 60000)
        await waitForDataLoaded(page)
        await pageSnapshot(page, 'bsv-hg19-default-session')
      },
    },
    {
      name: 'breakpoint split view canvas screenshot',
      fn: async page => {
        await navigateToUrl(page, 'config=test_data/breakpoint/config.json')

        await findDisplayPainted(page, 'pileup-display', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'bsv-hg19-pileup-canvas',
          `${displayPainted('pileup-display')} canvas`,
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

        await findDisplayPainted(page, 'pileup-display', 60000)
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
        await findDisplayPainted(page, 'pileup-display', 60000)
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
    {
      // The overlay could say a junction existed and not which reads it joined,
      // which is the whole of GMOD/jbrowse-components#4757. The fixture's chain
      // is three segments over two panels, so it also covers the multi-hop half:
      // a hover on either junction has to box all three, not just the two ends
      // of the junction under the pointer.
      name: 'hovering a connector boxes the whole read chain',
      fn: async page => {
        await navigateToUrl(page, 'config=test_data/breakpoint/config.json')
        await findDisplayPainted(page, 'pileup-display', 60000)
        await waitForDataLoaded(page)
        await delay(2000)

        assert.deepEqual(
          await chainHighlightRects(page),
          [],
          'nothing is boxed until something is hovered',
        )

        const points = await pointsOnConnector(page, 0)
        assert.ok(points.length > 0, 'expected a connector to hover')
        let rects: Awaited<ReturnType<typeof chainHighlightRects>> = []
        for (const p of points) {
          await page.mouse.move(p.x, p.y)
          await delay(400)
          rects = await chainHighlightRects(page)
          if (rects.length > 0) {
            break
          }
        }

        assert.ok(
          rects.length >= 2,
          `a hovered junction must box the reads at both of its ends, got ${rects.length}`,
        )
        for (const r of rects) {
          assert.ok(
            r.width > 0 && r.height > 0,
            `a box must have area, got ${JSON.stringify(r)}`,
          )
        }
        const dividerY = await page.evaluate(
          () =>
            // @ts-expect-error debug handle exposed by JBrowse.tsx
            window.JBrowseRootModel.session.views[0].views[0].height as number,
        )
        assert.ok(
          rects.some(r => r.y < dividerY) && rects.some(r => r.y > dividerY),
          `the chain crosses the panels, so its boxes must too: ${JSON.stringify(rects)}`,
        )
        assert.ok(
          rects.length > 2,
          `this fixture's chain has a third segment the hovered junction does not touch, and multi-hop means boxing it too: ${JSON.stringify(rects)}`,
        )

        // both junctions of the chain, not just the hovered one
        const emphasized = await page.evaluate(
          () =>
            [...document.querySelectorAll('svg path[data-testid="r1"]')].filter(
              e => e.getAttribute('stroke-width') === '5',
            ).length,
        )
        assert.equal(
          emphasized,
          2,
          'every junction of the hovered chain reads as hovered',
        )

        await page.mouse.move(5, 5)
        await delay(400)
        assert.deepEqual(
          await chainHighlightRects(page),
          [],
          'the boxes go when the pointer leaves the connector',
        )
      },
    },
  ],
}

export default suite
