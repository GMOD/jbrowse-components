import {
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForCanvasRendered,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

function alignmentsSpec(loc: string, colorBySetting: Record<string, unknown>) {
  return {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc,
        tracks: [
          {
            trackId: 'volvox_alignments',
            displaySnapshot: { colorBySetting },
          },
        ],
      },
    ],
  }
}

const suite: TestSuite = {
  name: 'Alignments Color Schemes',
  tests: [
    {
      name: 'color by strand',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          alignmentsSpec('ctgA:1000-2000', { type: 'strand' }),
        )
        await findByText(page, 'ctgA')
        await findByTestId(page, 'pileup-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="pileup-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'color-by-strand',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
    {
      name: 'color by mapping quality',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          alignmentsSpec('ctgA:1000-2000', { type: 'mappingQuality' }),
        )
        await findByText(page, 'ctgA')
        await findByTestId(page, 'pileup-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="pileup-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'color-by-mapping-quality',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
    {
      name: 'color by insert size and orientation',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          alignmentsSpec('ctgA:1000-2000', {
            type: 'insertSizeAndOrientation',
          }),
        )
        await findByText(page, 'ctgA')
        await findByTestId(page, 'pileup-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="pileup-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'color-by-insert-size-orientation',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
    {
      name: 'color by HP tag renders colored reads',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          alignmentsSpec('ctgA:39,800..40,000', { type: 'tag', tag: 'HP' }),
        )
        await findByText(page, 'ctgA')
        await findByTestId(page, 'pileup-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="pileup-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'color-by-tag-hp',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
  ],
}

export default suite
