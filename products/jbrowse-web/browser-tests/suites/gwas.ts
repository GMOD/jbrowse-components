import {
  findByTestId,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'GWAS Tracks',
  tests: [
    {
      name: 'Manhattan plot renders',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: ['volvox_gwas'],
            },
          ],
        })

        await findByTestId(page, 'manhattan-gpu-done', 60000)
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'gwas-manhattan-canvas',
          '[data-testid="manhattan-gpu-done"] canvas',
        )
      },
    },
  ],
}

export default suite
