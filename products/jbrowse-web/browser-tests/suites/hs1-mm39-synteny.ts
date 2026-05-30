import {
  findByTestId,
  navigateWithSessionSpec,
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
      name: 'whole-genome overview hs1 vs mm39 (100k minlen)',
      fn: async page => {
        // whole-genome human vs mouse — omitting loc shows all chromosomes;
        // 100k minlen keeps the syntenic ribbons legible instead of a hairball
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearSyntenyView',
                tracks: ['hs1ToMm39.over.chain.pif'],
                minAlignmentLength: 100000,
                views: [{ assembly: 'hs1' }, { assembly: 'mm39' }],
              },
            ],
          },
          hs1Mm39Config,
        )

        await findByTestId(page, 'synteny_canvas_done', 120000)
        await waitForDataLoaded(page, 120000)
        await canvasSnapshot(
          page,
          'hs1-mm39-synteny-wholegenome-canvas',
          '[data-testid="synteny_canvas_done"]',
        )
      },
    },
    {
      name: 'renders synteny view for chr7 vs chr6 (indexed PAF, 100k minlen)',
      fn: async page => {
        // full chr7 vs chr6 with 100k minlen shows clear diagonal syntenic bands
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearSyntenyView',
                tracks: ['hs1ToMm39.over.chain.pif'],
                minAlignmentLength: 100000,
                views: [
                  {
                    loc: 'chr7',
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

        await findByTestId(page, 'synteny_canvas_done', 120000)
        await waitForDataLoaded(page, 120000)
        await canvasSnapshot(
          page,
          'hs1-mm39-synteny-chr7-canvas',
          '[data-testid="synteny_canvas_done"]',
        )
      },
    },
    {
      name: 'renders synteny view for chr1 region (large dataset, viewport culling)',
      fn: async page => {
        // hs1:chr1:50-100M maps to scattered positions across all of mm39:chr1
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

        await findByTestId(page, 'synteny_canvas_done', 120000)
        await waitForDataLoaded(page, 120000)
        await canvasSnapshot(
          page,
          'hs1-mm39-synteny-chr1-large-canvas',
          '[data-testid="synteny_canvas_done"]',
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
                minAlignmentLength: 100000,
                views: [
                  {
                    loc: 'chr7',
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

        await findByTestId(page, 'synteny_canvas_done', 120000)
        await waitForDataLoaded(page, 120000)
        await pageSnapshot(page, 'hs1-mm39-synteny-fullpage')
      },
    },
  ],
}

export default suite
