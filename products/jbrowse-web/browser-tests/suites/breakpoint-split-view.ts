import {
  delay,
  findByTestId,
  navigateToUrl,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { dualSnapshot, pageSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Breakpoint Split View',
  tests: [
    {
      name: 'breakpoint split view loads default session (hg19)',
      fn: async page => {
        await navigateToUrl(page, 'config=test_data/breakpoint/config.json')

        // BSV has two LGV sub-views with alignments tracks
        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await pageSnapshot(page, 'bsv-hg19-default-session')
      },
    },
    {
      name: 'breakpoint split view canvas screenshot',
      fn: async page => {
        await navigateToUrl(page, 'config=test_data/breakpoint/config.json')

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'bsv-hg19-pileup-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
    {
      name: 'volvox inversion breakpoint split view',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'BreakpointSplitView',
              views: [
                {
                  type: 'LinearGenomeView',
                  assembly: 'volvox',
                  loc: 'ctgA:1-50000',
                  tracks: ['volvox_sv'],
                },
                {
                  type: 'LinearGenomeView',
                  assembly: 'volvox',
                  loc: 'ctgA:1-50000',
                  tracks: ['volvox_sv'],
                },
              ],
            },
          ],
        })

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await delay(1000)
        await pageSnapshot(page, 'bsv-volvox-inversion')
      },
    },
  ],
}

export default suite
