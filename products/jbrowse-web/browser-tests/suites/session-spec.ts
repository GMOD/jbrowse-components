import {
  delay,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForLoadingToComplete,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Session Spec URL Parameters',
  tests: [
    {
      name: 'displaySnapshot type opens alignments track',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-10000',
              tracks: ['volvox_sv_cram'],
            },
          ],
        })

        await findByText(page, 'ctgA')
        await findByTestId(page, 'pileup-display', 60000)
        await waitForLoadingToComplete(page)
        await delay(1000)
        await canvasSnapshot(
          page,
          'session-spec-display-snapshot-canvas',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
    {
      name: 'jexl',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:2,707..8,600',
              tracks: ['volvox_test_vcf_jexl'],
            },
          ],
        })

        await page.waitForSelector('[data-testid^="display-"]', {
          timeout: 60000,
        })
        await waitForLoadingToComplete(page)
        await delay(1000)
        await canvasSnapshot(
          page,
          'session-spec-jexl-canvas',
          '[data-testid^="display-"] canvas',
        )
      },
    },
  ],
}

export default suite
