import {
  delay,
  findByTestId,
  navigateWithSessionSpec,
  waitForCanvasRendered,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot, pageSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const config = 'test_data/config_multi_lgv_synteny.json'
const arabConfig = 'test_data/arabidopsis_synteny/config.json'

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

        await findByTestId(page, 'multi_synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await delay(2000)
        await canvasSnapshot(
          page,
          'multi-lgv-synteny-genome-rows-canvas',
          '[data-testid="multi_synteny_canvas"]',
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

        await findByTestId(page, 'multi_synteny_canvas', 60000)
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

        await findByTestId(page, 'synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid="synteny_canvas"]')
        await canvasSnapshot(
          page,
          'nway-synteny-pif-canvas',
          '[data-testid="synteny_canvas"]',
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

        await findByTestId(page, 'synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid="synteny_canvas"]')
        await pageSnapshot(page, 'nway-synteny-pif-fullpage', 0.15)
      },
    },
    {
      name: 'Arabidopsis 4-way synteny (Col-0 Chr1)',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearSyntenyView',
                tracks: [
                  ['arabidopsis_4way_synteny'],
                  ['arabidopsis_4way_synteny'],
                  ['arabidopsis_4way_synteny'],
                ],
                views: [
                  { loc: 'Chr1', assembly: 'Col-0' },
                  { loc: 'Chr1', assembly: 'Ler' },
                  { loc: 'Chr1', assembly: 'Cvi' },
                  { loc: 'Chr1', assembly: 'Eri' },
                ],
              },
            ],
          },
          arabConfig,
        )

        await findByTestId(page, 'synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid="synteny_canvas"]')
        await canvasSnapshot(
          page,
          'arabidopsis-4way-synteny-chr1-canvas',
          '[data-testid="synteny_canvas"]',
        )
      },
    },
    {
      name: 'Arabidopsis 4-way synteny full page',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearSyntenyView',
                tracks: [
                  ['arabidopsis_4way_synteny'],
                  ['arabidopsis_4way_synteny'],
                  ['arabidopsis_4way_synteny'],
                ],
                views: [
                  { loc: 'Chr1', assembly: 'Col-0' },
                  { loc: 'Chr1', assembly: 'Ler' },
                  { loc: 'Chr1', assembly: 'Cvi' },
                  { loc: 'Chr1', assembly: 'Eri' },
                ],
              },
            ],
          },
          arabConfig,
        )

        await findByTestId(page, 'synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid="synteny_canvas"]')
        await pageSnapshot(page, 'arabidopsis-4way-synteny-fullpage')
      },
    },
    {
      name: 'Arabidopsis multi-genome LGV display',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'Col-0',
                loc: 'Chr1:1-30000000',
                tracks: [
                  {
                    trackId: 'arabidopsis_4way_synteny',
                    displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                  },
                ],
              },
            ],
          },
          arabConfig,
        )

        await findByTestId(page, 'multi_synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await delay(2000)
        await canvasSnapshot(
          page,
          'arabidopsis-multi-lgv-canvas',
          '[data-testid="multi_synteny_canvas"]',
        )
      },
    },
  ],
}

export default suite
