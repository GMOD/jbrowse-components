import {
  navigateWithSessionSpec,
  waitForCanvasRendered,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

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
              loc: 'ctgA:1..50,001',
              tracks: ['volvox_filtered_vcf_assembly_alias'],
            },
          ],
        })

        await page.waitForSelector('[data-testid^="display-"]', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'variants-assembly-aliases-canvas',
          '[data-testid^="display-"] canvas',
        )
      },
    },
  ],
}

export default suite
