import {
  delay,
  findByTestId,
  navigateWithSessionSpec,
  waitForLoadingToComplete,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

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
        await canvasSnapshot(
          page,
          'bigwig-gc-content-canvas',
          '[data-testid="wiggle-rendering-test"] canvas',
        )
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
          '[data-testid^="trackRenderingContainer"] canvas',
          { timeout: 60000 },
        )
        await waitForLoadingToComplete(page)
        await delay(3000)
        await canvasSnapshot(
          page,
          'bigwig-multibigwig-xyplot-canvas',
          '[data-testid^="trackRenderingContainer"] canvas',
        )
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

        await page.waitForSelector('[data-testid^="prerendered_canvas"]', {
          timeout: 60000,
        })
        await waitForLoadingToComplete(page)
        await delay(1000)
        await canvasSnapshot(
          page,
          'bigwig-multibigwig-multirowxy-canvas',
          '[data-testid^="prerendered_canvas"]',
        )
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

        await page.waitForSelector('[data-testid^="prerendered_canvas"]', {
          timeout: 60000,
        })
        await waitForLoadingToComplete(page)
        await delay(1000)
        await canvasSnapshot(
          page,
          'bigwig-multibigwig-multirowdensity-canvas',
          '[data-testid^="prerendered_canvas"]',
        )
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

        await page.waitForSelector('[data-testid^="prerendered_canvas"]', {
          timeout: 60000,
        })
        await waitForLoadingToComplete(page)
        await delay(1000)
        await canvasSnapshot(
          page,
          'bigwig-multibigwig-multirowline-canvas',
          '[data-testid^="prerendered_canvas"]',
        )
      },
    },
  ],
}

export default suite
