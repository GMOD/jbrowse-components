import {
  delay,
  findByTestId,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot, pageSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'MultiLGV Synteny volvox/volvox_del',
  tests: [
    {
      name: 'volvox perspective shows volvox_del synteny',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: [
                {
                  trackId: 'volvox_del_gfa_multi',
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
          'multi-lgv-volvox-perspective-canvas',
          '[data-testid="multi_synteny_canvas_done"]',
        )
      },
    },
    {
      name: 'volvox perspective full page',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: [
                {
                  trackId: 'volvox_del_gfa_multi',
                  displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                },
              ],
            },
          ],
        })

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await delay(2000)
        await pageSnapshot(page, 'multi-lgv-volvox-perspective-fullpage')
      },
    },
    {
      name: 'volvox_del perspective shows volvox synteny',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox_del',
              loc: 'ctgA:1-50000',
              tracks: [
                {
                  trackId: 'volvox_del_gfa_multi',
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
          'multi-lgv-volvox-del-perspective-canvas',
          '[data-testid="multi_synteny_canvas_done"]',
        )
      },
    },
    {
      name: 'volvox_del perspective full page',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox_del',
              loc: 'ctgA:1-50000',
              tracks: [
                {
                  trackId: 'volvox_del_gfa_multi',
                  displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                },
              ],
            },
          ],
        })

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await delay(2000)
        await pageSnapshot(page, 'multi-lgv-volvox-del-perspective-fullpage')
      },
    },
  ],
}

export default suite
