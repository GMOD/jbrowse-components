/* eslint-disable no-console */
import {
  assertCanvasHasContent,
  delay,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot, pageSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

// TabixPAFAdapter: a plain bgzipped+tabix-indexed PAF (the odgi untangle
// output shape) feeding MultiLGVSyntenyDisplay. The volvox fixture
// (test_data/volvox/volvox.untangle.paf.gz) has two PanSN query genomes
// (hap1#1, hap2#1) projected onto the volvox ctgA/ctgB reference.
const suite: TestSuite = {
  name: 'MultiLGV Synteny — TabixPAFAdapter (volvox untangle)',
  tests: [
    {
      name: 'TabixPAFAdapter renders synteny rows per PanSN genome',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-3000',
              tracks: [
                {
                  trackId: 'volvox_untangle_tabix_paf',
                  displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                },
              ],
            },
          ],
        })

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await delay(2000)
        // gate against a blank render — canvasSnapshot treats blank as a pass
        await assertCanvasHasContent(
          page,
          '[data-testid="multi_synteny_canvas_done"]',
        )
        await canvasSnapshot(
          page,
          'multi-lgv-tabix-paf-volvox-canvas',
          '[data-testid="multi_synteny_canvas_done"]',
        )
      },
    },
    {
      name: 'TabixPAFAdapter full page',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-3000',
              tracks: [
                {
                  trackId: 'volvox_untangle_tabix_paf',
                  displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                },
              ],
            },
          ],
        })

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await delay(2000)
        await pageSnapshot(page, 'multi-lgv-tabix-paf-volvox-fullpage')
      },
    },
    {
      // TabixPAFAdapter is synteny-only — a plain untangle PAF has no graph
      // topology, so it has no getSubgraph. The "Launch -> Graph genome view"
      // menu entry still exists (it's built unconditionally), so this pins
      // the graceful boundary: GetSubgraph returns '' and the display shows a
      // "does not support" warning instead of crashing. Graph views need a
      // graph-aware adapter (GfaTabixAdapter / GfaServerAdapter).
      name: 'launching a graph view from a TabixPAFAdapter track warns gracefully',
      fn: async page => {
        const errors: string[] = []
        page.on('pageerror', (e: unknown) => errors.push(String(e)))

        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-3000',
              tracks: [
                {
                  trackId: 'volvox_untangle_tabix_paf',
                  displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                },
              ],
            },
          ],
        })
        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)

        const trackMenu = await findByTestId(page, 'track_menu_icon', 10000)
        await trackMenu?.click()
        await delay(300)
        await (await findByText(page, /Launch/i, 10000))?.click()
        await delay(300)
        await (
          await findByText(page, /Graph genome view \(local\)/i, 10000)
        )?.click()

        // graceful warning notification, no new view, no crash
        await findByText(page, /does not support graph subgraph/i, 15000)
        if (errors.length > 0) {
          throw new Error(`Uncaught page errors: ${errors.join('; ')}`)
        }
      },
    },
    {
      name: 'TabixPAFAdapter renders ctgB (subwalk-suffixed PanSN target)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgB:1-5000',
              tracks: [
                {
                  trackId: 'volvox_untangle_tabix_paf',
                  displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                },
              ],
            },
          ],
        })

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await delay(1000)
        await canvasSnapshot(
          page,
          'multi-lgv-tabix-paf-ctgB-canvas',
          '[data-testid="multi_synteny_canvas_done"]',
        )
      },
    },
    {
      name: 'TabixPAFAdapter renders wide ctgA view within 20 seconds',
      fn: async page => {
        const t0 = Date.now()
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: [
                {
                  trackId: 'volvox_untangle_tabix_paf',
                  displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                },
              ],
            },
          ],
        })

        await findByTestId(page, 'multi_synteny_canvas_done', 20000)
        await waitForDataLoaded(page)
        await delay(500)
        console.log(`[perf] ctgA:1-50000 first render: ${Date.now() - t0}ms`)
        await canvasSnapshot(
          page,
          'multi-lgv-tabix-paf-wide-view-canvas',
          '[data-testid="multi_synteny_canvas_done"]',
        )
      },
    },
    {
      name: 'TabixPAFAdapter color-by identity renders differently from strand',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-3000',
              tracks: [
                {
                  trackId: 'volvox_untangle_tabix_paf',
                  displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                },
              ],
            },
          ],
        })

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await (await findByTestId(page, 'track_menu_icon', 10000))?.click()
        await delay(300)
        await (await findByText(page, /Color by/i, 5000))?.click()
        await delay(300)
        await (await findByText(page, /^identity$/i, 5000))?.click()
        await delay(1500)
        await canvasSnapshot(
          page,
          'multi-lgv-tabix-paf-color-identity-canvas',
          '[data-testid="multi_synteny_canvas_done"]',
        )
      },
    },
    {
      name: 'TabixPAFAdapter coverage toggle hides coverage bar',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-3000',
              tracks: [
                {
                  trackId: 'volvox_untangle_tabix_paf',
                  displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                },
              ],
            },
          ],
        })

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await (await findByTestId(page, 'track_menu_icon', 10000))?.click()
        await delay(300)
        await (await findByText(page, /Show coverage/i, 5000))?.click()
        await delay(1500)
        await canvasSnapshot(
          page,
          'multi-lgv-tabix-paf-no-coverage-canvas',
          '[data-testid="multi_synteny_canvas_done"]',
        )
      },
    },
  ],
}

export default suite
