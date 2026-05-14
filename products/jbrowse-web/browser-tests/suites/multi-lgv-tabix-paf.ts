import {
  delay,
  findByTestId,
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
  ],
}

export default suite
