import {
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForDataLoaded
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
              tracks: ['volvox_sv_cram']
},
          ]
})

        await findByText(page, 'ctgA')
        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'session-spec-display-snapshot-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      }
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
              tracks: ['volvox_test_vcf_jexl']
},
          ]
})

        await page.waitForSelector('[data-testid^="display-"]', {
          timeout: 60000
})
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'session-spec-jexl-canvas',
          '[data-testid$="-done"] canvas',
        )
      }
},
  ]
}

export default suite
