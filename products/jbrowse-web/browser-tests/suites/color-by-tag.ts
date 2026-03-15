import {
  delay,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForCanvasRendered,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

async function openColorByMenu(page: Page) {
  const menuIcon = await findByTestId(page, 'track_menu_icon', 10000)
  await menuIcon?.click()
  await delay(300)
  const colorByMenu = await findByText(page, 'Color by...', 10000)
  await colorByMenu?.click()
  await delay(300)
}

async function selectColorByOption(page: Page, optionText: string) {
  await openColorByMenu(page)
  const option = await findByText(page, optionText, 10000)
  await option?.click()
  await delay(1000)
  await waitForDataLoaded(page, 60000)
  await waitForCanvasRendered(
    page,
    '[data-testid="pileup-display"] canvas',
  )
}

async function loadAlignments(page: Page, loc = 'ctgA:1000-2000') {
  await navigateWithSessionSpec(page, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc,
        tracks: ['volvox_alignments'],
      },
    ],
  })
  await findByText(page, 'ctgA')
  await findByTestId(page, 'pileup-display', 60000)
  await waitForDataLoaded(page)
  await waitForCanvasRendered(
    page,
    '[data-testid="pileup-display"] canvas',
  )
}

const suite: TestSuite = {
  name: 'Alignments Color Schemes',
  tests: [
    {
      name: 'color by strand',
      fn: async page => {
        await loadAlignments(page)
        await selectColorByOption(page, 'Strand')
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
        await loadAlignments(page)
        await selectColorByOption(page, 'Mapping quality')
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
        await loadAlignments(page)
        await selectColorByOption(page, 'Insert size and orientation')
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
        await loadAlignments(page, 'ctgA:39,800..40,000')
        await canvasSnapshot(
          page,
          'color-by-tag-before',
          '[data-testid="pileup-display"] canvas',
        )

        await openColorByMenu(page)

        // Click "Color by tag..."
        const colorByTag = await findByText(page, 'Color by tag...', 10000)
        await colorByTag?.click()
        await delay(300)

        // Type HP tag
        const tagInput = await page.waitForSelector(
          'input[placeholder="Enter tag name"]',
          { timeout: 10000 },
        )
        await tagInput?.type('HP')
        await delay(300)

        // Submit
        const submitBtn = await findByText(page, 'Submit', 10000)
        await submitBtn?.click()

        // Wait for re-fetch with color tag map
        await delay(2000)
        await waitForDataLoaded(page, 60000)
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
