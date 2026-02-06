import {
  delay,
  findByTestId,
  navigateWithSessionSpec,
  waitForLoadingToComplete,
} from '../helpers.ts'
import { snapshot } from '../snapshot.ts'

import type { TestCase, TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

function syntenyTest(
  name: string,
  snapshotName: string,
  peachLoc: string,
  grapeLoc: string,
  swapped = false,
): TestCase {
  return {
    name,
    fn: async (page: Page) => {
      const views = swapped
        ? [
            { loc: grapeLoc, assembly: 'grape' },
            { loc: peachLoc, assembly: 'peach' },
          ]
        : [
            { loc: peachLoc, assembly: 'peach' },
            { loc: grapeLoc, assembly: 'grape' },
          ]

      await navigateWithSessionSpec(
        page,
        {
          views: [
            {
              type: 'LinearSyntenyView',
              tracks: ['subset'],
              views,
            },
          ],
        },
        'test_data/grape_peach_synteny/config.json',
      )

      await findByTestId(page, 'synteny_canvas', 60000)
      await waitForLoadingToComplete(page)
      await delay(1000)
      await snapshot(page, snapshotName)
    },
  }
}

const suite: TestSuite = {
  name: 'Synteny Views',
  tests: [
    syntenyTest(
      'horizontally flipped inverted alignment',
      'synteny-flipped-inverted',
      'Pp01:28,845,211..28,845,272[rev]',
      'chr1:316,306..316,364',
    ),
    syntenyTest(
      'regular orientation inverted alignment',
      'synteny-regular-inverted',
      'Pp01:28,845,211..28,845,272',
      'chr1:316,306..316,364',
    ),
    {
      name: 'LGV synteny track',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:30,222..33,669',
              tracks: ['volvox_ins.paf'],
            },
          ],
        })

        await page.waitForSelector(
          '[data-testid^="prerendered_canvas"]',
          { timeout: 60000 },
        )
        await waitForLoadingToComplete(page)
        await delay(1000)
        await snapshot(page, 'synteny-lgv-paf')
      },
    },
  ],
}

export default suite
