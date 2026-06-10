import {
  findByTestId,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { dualSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'HiC Track',
  tests: [
    {
      name: 'HiC rendering',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'hg19',
                loc: 'chr1:1..10,000,000',
                tracks: ['hic_test'],
              },
            ],
          },
          'extra_test_data/hic_integration_test.json',
        )

        await findByTestId(page, 'hic-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'hic-rendering-canvas',
          '[data-testid="hic_canvas"]',
        )
      },
    },
  ],
}

export default suite
