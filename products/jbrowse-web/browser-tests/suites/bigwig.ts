import {
  delay,
  findByTestId,
  navigateWithSessionSpec,
  waitForLoadingToComplete,
} from '../helpers.ts'
import { snapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'BigWig Tracks',
  tests: [
    {
      name: 'GC content track',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:39,433..39,804',
              tracks: ['volvox_gc'],
            },
          ],
        })

        await findByTestId(page, 'wiggle-rendering-test', 60000)
        await waitForLoadingToComplete(page)
        await delay(1000)
        await snapshot(page, 'bigwig-gc-content')
      },
    },
    {
      name: 'MultiBigWig xyplot',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-4000',
              tracks: ['volvox_microarray_multi'],
            },
          ],
        })

        await page.waitForSelector(
          '[data-testid^="prerendered_canvas"]',
          { timeout: 60000 },
        )
        await waitForLoadingToComplete(page)
        await delay(1000)
        await snapshot(page, 'bigwig-multibigwig-xyplot')
      },
    },
    {
      name: 'MultiBigWig multirowxy',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-4000',
              tracks: ['volvox_microarray_multi_multirowxy'],
            },
          ],
        })

        await page.waitForSelector(
          '[data-testid^="prerendered_canvas"]',
          { timeout: 60000 },
        )
        await waitForLoadingToComplete(page)
        await delay(1000)
        await snapshot(page, 'bigwig-multibigwig-multirowxy')
      },
    },
    {
      name: 'MultiBigWig multirowdensity',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-4000',
              tracks: ['volvox_microarray_multi_multirowdensity'],
            },
          ],
        })

        await page.waitForSelector(
          '[data-testid^="prerendered_canvas"]',
          { timeout: 60000 },
        )
        await waitForLoadingToComplete(page)
        await delay(1000)
        await snapshot(page, 'bigwig-multibigwig-multirowdensity')
      },
    },
    {
      name: 'MultiBigWig multirowline',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-4000',
              tracks: ['volvox_microarray_multi_multirowline'],
            },
          ],
        })

        await page.waitForSelector(
          '[data-testid^="prerendered_canvas"]',
          { timeout: 60000 },
        )
        await waitForLoadingToComplete(page)
        await delay(1000)
        await snapshot(page, 'bigwig-multibigwig-multirowline')
      },
    },
  ],
}

export default suite
