import {
  findByText,
  navigateWithSessionSpec,
  waitForCanvasRendered,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Arcs and BEDPE Displays',
  tests: [
    {
      name: 'arc track renders',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: ['arc_test'],
            },
          ],
        })

        await findByText(page, 'ctgA')
        await waitForDataLoaded(page)
        await page.waitForSelector('[data-testid^="display-"] canvas', {
          timeout: 60000,
        })
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'arcs-arc-test-canvas',
          '[data-testid^="display-"] canvas',
        )
      },
    },
    {
      name: 'BEDPE arc track renders',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: ['volvox_bedpe'],
            },
          ],
        })

        await findByText(page, 'ctgA')
        await waitForDataLoaded(page)
        await page.waitForSelector('[data-testid^="display-"] canvas', {
          timeout: 60000,
        })
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'arcs-bedpe-canvas',
          '[data-testid^="display-"] canvas',
        )
      },
    },
    {
      name: 'paired-end stranded RNA-seq arcs',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-10000',
              tracks: ['paired_end_stranded_rnaseq'],
            },
          ],
        })

        await page.waitForSelector('[data-testid^="display-"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'arcs-paired-end-rnaseq-canvas',
          '[data-testid^="display-"] canvas',
        )
      },
    },
  ],
}

export default suite
