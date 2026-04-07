import {
  findByTestId,
  findByText,
  navigateWithSessionSpec,
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
        await page.waitForSelector('[data-testid$="-done"] canvas', {
          timeout: 60000,
        })
        await canvasSnapshot(
          page,
          'arcs-arc-test-canvas',
          '[data-testid$="-done"] canvas',
        )
      },
    },
    {
      name: 'RNA-seq sashimi arcs (spliced alignments)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-10000',
              tracks: ['spliced'],
            },
          ],
        })

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'arcs-rnaseq-sashimi-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
    {
      name: 'paired-end stranded RNA-seq',
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

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'arcs-paired-end-rnaseq-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
  ],
}

export default suite
