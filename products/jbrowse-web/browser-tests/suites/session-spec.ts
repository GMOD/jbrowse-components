import {
  delay,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForLoadingToComplete,
} from '../helpers.ts'
import { snapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Session Spec URL Parameters',
  tests: [
    {
      name: 'displaySnapshot type opens track with specific display type',
      fn: async page => {
        const sessionSpec = {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-10000',
              tracks: [
                {
                  trackId: 'volvox_sv_cram',
                  displaySnapshot: {
                    type: 'LinearReadCloudDisplay',
                  },
                },
              ],
            },
          ],
        }

        await navigateWithSessionSpec(page, sessionSpec)
        await findByText(page, 'ctgA')
        await findByTestId(page, 'cloud-canvas', 60000)
        await waitForLoadingToComplete(page)
        await delay(1000)
        await snapshot(page, 'session-spec-display-snapshot-type')
      },
    },
    {
      name: 'jexl',
      fn: async page => {
        const sessionSpec = {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:2,707..8,600',
              tracks: ['volvox_test_vcf_jexl'],
            },
          ],
        }

        await navigateWithSessionSpec(page, sessionSpec)
        await findByTestId(page, 'canvas-feature-overlay', 60000)
        await waitForLoadingToComplete(page)
        await delay(1000)
        await snapshot(page, 'session-spec-jexl')
      },
    },
  ],
}

export default suite
