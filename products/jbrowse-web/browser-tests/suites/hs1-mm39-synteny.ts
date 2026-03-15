import {
  findByTestId,
  navigateWithSessionSpec,
  waitForCanvasRendered,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot, pageSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const hs1Mm39Config = 'test_data/hs1_vs_mm39/config.json'

const suite: TestSuite = {
  name: 'Hs1 vs mm39 Synteny',
  requiresRemote: true,
  tests: [
    {
      name: 'renders synteny view for chr7 region (indexed PAF)',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearSyntenyView',
                tracks: ['hs1ToMm39.over.chain.pif'],
                views: [
                  {
                    loc: 'chr7:25,000,000..30,000,000',
                    assembly: 'hs1',
                  },
                  {
                    loc: 'chr6',
                    assembly: 'mm39',
                  },
                ],
              },
            ],
          },
          hs1Mm39Config,
        )

        await findByTestId(page, 'synteny_canvas', 120000)
        await waitForDataLoaded(page, 120000)
        await waitForCanvasRendered(
          page,
          '[data-testid="synteny_canvas"]',
          60000,
        )
        await canvasSnapshot(
          page,
          'hs1-mm39-synteny-chr7-canvas',
          '[data-testid="synteny_canvas"]',
        )
      },
    },
    {
      name: 'renders synteny view for chr1 region (large dataset, viewport culling)',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearSyntenyView',
                tracks: ['hs1ToMm39.over.chain.pif'],
                views: [
                  {
                    loc: 'chr1:50,000,000..100,000,000',
                    assembly: 'hs1',
                  },
                  {
                    loc: 'chr1',
                    assembly: 'mm39',
                  },
                ],
              },
            ],
          },
          hs1Mm39Config,
        )

        await findByTestId(page, 'synteny_canvas', 120000)
        await waitForDataLoaded(page, 120000)
        await waitForCanvasRendered(
          page,
          '[data-testid="synteny_canvas"]',
          60000,
        )
        await canvasSnapshot(
          page,
          'hs1-mm39-synteny-chr1-large-canvas',
          '[data-testid="synteny_canvas"]',
        )
      },
    },
    {
      name: 'full page screenshot of hs1 vs mm39 synteny',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearSyntenyView',
                tracks: ['hs1ToMm39.over.chain.pif'],
                views: [
                  {
                    loc: 'chr7:25,000,000..30,000,000',
                    assembly: 'hs1',
                  },
                  {
                    loc: 'chr6',
                    assembly: 'mm39',
                  },
                ],
              },
            ],
          },
          hs1Mm39Config,
        )

        await findByTestId(page, 'synteny_canvas', 120000)
        await waitForDataLoaded(page, 120000)
        await waitForCanvasRendered(
          page,
          '[data-testid="synteny_canvas"]',
          60000,
        )
        await pageSnapshot(page, 'hs1-mm39-synteny-fullpage')
      },
    },
  ],
}

export default suite
