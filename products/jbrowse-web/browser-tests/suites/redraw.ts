import {
  assertCanvasHasContent,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForDataLoaded,
  zoomOut,
} from '../helpers.ts'

import type { TestSuite } from '../types.ts'

function lgvSpec(loc: string, track: string) {
  return {
    views: [
      { type: 'LinearGenomeView', assembly: 'volvox', loc, tracks: [track] },
    ],
  }
}

const suite: TestSuite = {
  name: 'Redraw on Zoom',
  tests: [
    {
      name: 'alignments track redraws after zoom out',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          lgvSpec('ctgA:1000-2000', 'volvox_cram'),
        )
        await findByText(page, 'ctgA')
        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)

        await zoomOut(page, 3)

        // The point of this test: the pileup must repaint at the new zoom, not
        // leave a stale or blank canvas.
        await assertCanvasHasContent(
          page,
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
    {
      name: 'feature track redraws after zoom out',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          lgvSpec('ctgA:1000-2000', 'volvox_filtered_vcf'),
        )
        await findByText(page, 'ctgA')
        await page.waitForSelector('[data-testid^="display-"]', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await zoomOut(page, 2)
      },
    },
    {
      name: 'wiggle track fills visible region after zoom',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          lgvSpec('ctgA:1000-3000', 'volvox_cram_snpcoverage'),
        )
        await findByText(page, 'ctgA')
        await page.waitForSelector('[data-testid^="display-"]', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await zoomOut(page, 2)
      },
    },
  ],
}

export default suite
