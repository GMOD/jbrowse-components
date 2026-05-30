import {
  findByTestId,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { dualSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const grapePeachConfig = 'test_data/grape_peach_synteny/config.json'

const suite: TestSuite = {
  name: 'Grape vs Peach Synteny',
  requiresRemote: true,
  tests: [
    {
      name: 'renders synteny view for grape chr18 vs peach Pp01 (minimap2 PAF)',
      fn: async page => {
        // chr18 (grape) vs Pp01 (peach) has strong synteny — a clear diagonal
        // ribbon at minlen=2k without hairballing. Grape-peach alignments are
        // generally small (<12kb) so minlen must stay low.
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearSyntenyView',
                tracks: ['peach_grape_minimap2'],
                minAlignmentLength: 2000,
                views: [
                  {
                    loc: 'chr18',
                    assembly: 'grape',
                  },
                  {
                    loc: 'Pp01',
                    assembly: 'peach',
                  },
                ],
              },
            ],
          },
          grapePeachConfig,
        )

        await findByTestId(page, 'synteny_canvas_done', 120000)
        await waitForDataLoaded(page, 120000)
        await dualSnapshot(
          page,
          'grape-peach-synteny-overview-canvas',
          '[data-testid="synteny_canvas_done"]',
        )
      },
    },
  ],
}

export default suite
