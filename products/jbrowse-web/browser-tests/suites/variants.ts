import {
  delay,
  navigateWithSessionSpec,
  waitForLoadingToComplete,
} from '../helpers.ts'
import { snapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Variants Track',
  tests: [
    {
      name: 'assembly aliases VCF track',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:2,849..3,099',
              tracks: ['volvox_filtered_vcf_assembly_alias'],
            },
          ],
        })

        await page.waitForSelector(
          '[data-testid^="prerendered_canvas"]',
          { timeout: 60000 },
        )
        await waitForLoadingToComplete(page)
        await delay(1000)
        await snapshot(page, 'variants-assembly-aliases')
      },
    },
  ],
}

export default suite
