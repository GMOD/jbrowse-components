import {
  delay,
  findByTestId,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot, pageSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const config = 'test_data/config_multi_lgv_synteny.json'

const suite: TestSuite = {
  name: 'Multi-LGV Synteny Display',
  tests: [
    {
      name: 'multi-pair PIF in LGV shows genome rows',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'volvox',
                loc: 'ctgA:1-50000',
                tracks: [
                  {
                    trackId: 'volvox_multi_pif',
                    displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                  },
                ],
              },
            ],
          },
          config,
        )

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await delay(2000)
        await canvasSnapshot(
          page,
          'multi-lgv-synteny-genome-rows-canvas',
          '[data-testid="multi_synteny_canvas_done"]',
        )
      },
    },
    {
      name: 'multi-pair PIF full page screenshot',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'volvox',
                loc: 'ctgA:1-50000',
                tracks: [
                  {
                    trackId: 'volvox_multi_pif',
                    displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                  },
                ],
              },
            ],
          },
          config,
        )

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await delay(2000)
        await pageSnapshot(page, 'multi-lgv-synteny-fullpage')
      },
    },
    {
      name: 'N-way synteny view from PIF tracks',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearSyntenyView',
                tracks: [['volvox_ins_pif'], ['volvox_del_pif']],
                views: [
                  { loc: 'ctgA:1-50000', assembly: 'volvox_ins' },
                  { loc: 'ctgA:1-50000', assembly: 'volvox' },
                  { loc: 'ctgA:1-50000', assembly: 'volvox_del' },
                ],
              },
            ],
          },
          config,
        )

        await findByTestId(page, 'synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'nway-synteny-pif-canvas',
          '[data-testid="synteny_canvas_done"]',
        )
      },
    },
    {
      name: 'N-way synteny from PIF full page',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearSyntenyView',
                tracks: [['volvox_ins_pif'], ['volvox_del_pif']],
                views: [
                  { loc: 'ctgA:1-50000', assembly: 'volvox_ins' },
                  { loc: 'ctgA:1-50000', assembly: 'volvox' },
                  { loc: 'ctgA:1-50000', assembly: 'volvox_del' },
                ],
              },
            ],
          },
          config,
        )

        await findByTestId(page, 'synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await pageSnapshot(page, 'nway-synteny-pif-fullpage', 0.15)
      },
    },
  ],
}

export default suite
