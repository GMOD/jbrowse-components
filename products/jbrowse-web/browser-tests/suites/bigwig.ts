import {
  findByTestId,
  navigateWithSessionSpec,
  waitForCanvasRendered,
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

        await findByTestId(page, 'wiggle-display', 60000)
        await waitForLoadingToComplete(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="wiggle-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'bigwig-gc-content-canvas',
          '[data-testid="wiggle-display"] canvas',
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

        await findByTestId(page, 'multi-wiggle-display', 60000)
        await waitForLoadingToComplete(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="multi-wiggle-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'bigwig-multibigwig-xyplot-canvas',
          '[data-testid="multi-wiggle-display"] canvas',
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

        await findByTestId(page, 'multi-wiggle-display', 60000)
        await waitForLoadingToComplete(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="multi-wiggle-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'bigwig-multibigwig-multirowxy-canvas',
          '[data-testid="multi-wiggle-display"] canvas',
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

        await findByTestId(page, 'multi-wiggle-display', 60000)
        await waitForLoadingToComplete(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="multi-wiggle-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'bigwig-multibigwig-multirowdensity-canvas',
          '[data-testid="multi-wiggle-display"] canvas',
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

        await findByTestId(page, 'multi-wiggle-display', 60000)
        await waitForLoadingToComplete(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="multi-wiggle-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'bigwig-multibigwig-multirowline-canvas',
          '[data-testid="multi-wiggle-display"] canvas',
        )
      },
    },
  ],
}

export default suite
