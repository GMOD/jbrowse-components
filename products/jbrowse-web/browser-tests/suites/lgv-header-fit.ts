// The linear genome view's header row against a narrow window.
//
// The row has one control with no equivalent anywhere else in the view — the
// search box — and flexbox used to take the whole shortfall out of it: below a
// 700px window it collapsed to 101px and the row overflowed regardless.
// `headerFit` now gives that width back by shedding the pieces that do have a
// fallback, and this is what keeps that true when the next button is added to
// the row: a new fixed-width child that nothing sheds fails these outright.
//
// Geometry only, no canvas — so it is rasterizer-independent and outside the
// cross-backend gate.

import { delay, findByTestId, navigateWithSessionSpec } from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

// Every width jbrowse-web can actually present the header at. The app stops
// narrowing at a 400px header, so nothing below that is reachable.
const WIDTHS = [900, 800, 700, 600, 500, 420]

// What the search box is protected down to. The measured floor across those
// widths is 158px at the narrowest; the gate sits under it with room for
// subpixel and font jitter, and far above the 101px the row used to leave.
const SEARCH_BOX_FLOOR_PX = 150

const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-20000',
      tracks: ['volvox_alignments'],
    },
  ],
}

async function openNarrow(page: Page, width: number) {
  await navigateWithSessionSpec(page, spec)
  await findByTestId(page, 'zoom_out', 30000)
  await page.setViewport({ width, height: 800 })
  // two frames for the ResizeObserver to report and the shed level to paint
  await delay(600)
}

// The row, its natural content width, and the search box inside it.
function readRow(page: Page) {
  return page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>(
      'button[value="track_select"]',
    )!.parentElement!
    const search = document.querySelector<HTMLElement>(
      '[data-testid="autocomplete"]',
    )!
    return {
      client: bar.clientWidth,
      scroll: bar.scrollWidth,
      search: Math.round(search.getBoundingClientRect().width),
      hasScrollZoomLabel: !!document
        .querySelector('button[value="scrollZoom"]')
        ?.textContent.trim(),
      hasSlider: !!bar.querySelector('.MuiSlider-root'),
      hasRegionWidth: !!bar.querySelector(
        '[data-testid="header_region_width"]',
      ),
    }
  })
}

const suite: TestSuite = {
  name: 'LGV Header Fit',
  tests: [
    ...WIDTHS.map(width => ({
      name: `keeps the search box usable and the row unbroken at ${width}px`,
      fn: async (page: Page) => {
        await openNarrow(page, width)
        const row = await readRow(page)
        // both, not the first — a row that overflows has also squeezed the
        // search box, and a report naming one of the two invites a fix that
        // only moves the failure
        const broken = [
          row.scroll > row.client &&
            `row overflows: content ${row.scroll} in ${row.client}`,
          row.search < SEARCH_BOX_FLOOR_PX &&
            `search box squeezed to ${row.search}px, floor is ${SEARCH_BOX_FLOOR_PX}`,
        ].filter(Boolean)
        if (broken.length) {
          throw new Error(`header at ${width}px: ${broken.join('; ')}`)
        }
      },
    })),
    {
      name: 'a wide header shows the label, the slider and the bp readout',
      fn: async page => {
        await openNarrow(page, 1200)
        const row = await readRow(page)
        if (!row.hasScrollZoomLabel || !row.hasSlider || !row.hasRegionWidth) {
          throw new Error(
            `a 1200px header should carry all three: ${JSON.stringify(row)}`,
          )
        }
      },
    },
    {
      name: 'a narrow header drops the label, the slider and the bp readout',
      fn: async page => {
        await openNarrow(page, 460)
        const row = await readRow(page)
        if (row.hasScrollZoomLabel || row.hasSlider || row.hasRegionWidth) {
          throw new Error(
            `a 460px header should have shed all three: ${JSON.stringify(row)}`,
          )
        }
      },
    },
  ],
}

export default suite
