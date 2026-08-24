// The linear genome view's header row against a narrow window.
//
// The row has one control with no equivalent anywhere else in the view — the
// search box — and flexbox used to take the whole shortfall out of it: below a
// 700px window it collapsed to 101px and the row overflowed regardless.
// `headerFit` now gives that width back by shedding the pieces that do have a
// fallback, and this is what keeps that true when the next button is added to
// the row: a new fixed-width child that nothing sheds fails these outright.
//
// Three properties, because the first two each pass through the other's failure:
// the row does not overflow, the box gets the width it asked for, and the
// locstring fits the room the box leaves it — the last being the only place the
// reserve constants meet the font the browser actually draws in.
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

// What the row costs with every sheddable piece gone. A row wider than this plus
// the box's ask can hold both, so the box being squeezed at all there is the
// failure `headerFit` exists to prevent — and the floor check above cannot see
// it, because 184px of an asked 210 is still comfortably above the floor. Under
// it the row overflows whatever it gives up and the box shrinks like any flex
// item, which is a floor and not a bug.
const SHED_ROW_PX = 238

// The box's ask follows the locstring, so a row that sheds against the box's
// floor instead of its ask holds one piece too many and squeezes it. This asks
// 224px against the default view's 194, and 800/700 are the two widths where
// that difference decides it: the row holds everything at 800 and sheds two
// pieces at 700, each by a margin narrower than 30px.
const LONG_LOC = 'ctgA:10000-20000'
const LONG_LOC_WIDTHS = [800, 700]

const spec = (loc: string) => ({
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc,
      tracks: ['volvox_alignments'],
    },
  ],
})

async function openNarrow(page: Page, width: number, loc = 'ctgA:1-20000') {
  await navigateWithSessionSpec(page, spec(loc))
  await findByTestId(page, 'zoom_out', 30000)
  await page.setViewport({ width, height: 800 })
  // two frames for the ResizeObserver to report and the shed level to paint
  await delay(600)
}

// The row, its natural content width, and the search box inside it — the width
// the box asked for as well as the width it got, and the locstring against the
// room the box leaves it, which is what the reserve constants are sized to.
function readRow(page: Page) {
  return page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>(
      'button[value="track_select"]',
    )!.parentElement!
    const search = document.querySelector<HTMLElement>(
      '[data-testid="autocomplete"]',
    )!
    const input = search.querySelector('input')!
    const cs = getComputedStyle(input)
    const px = (v: string) => Number.parseFloat(v) || 0
    const ctx = document.createElement('canvas').getContext('2d')!
    ctx.font = cs.font
    return {
      client: bar.clientWidth,
      scroll: bar.scrollWidth,
      search: Math.round(search.getBoundingClientRect().width),
      asked: Math.round(px(search.style.width)),
      margins: Math.round(
        px(getComputedStyle(search).marginLeft) +
          px(getComputedStyle(search).marginRight),
      ),
      locString: input.value,
      rendered: Math.round(ctx.measureText(input.value).width),
      textSpace: Math.round(
        input.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight),
      ),
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
    ...[
      ...WIDTHS.map(width => ({ width, loc: undefined as string | undefined })),
      ...LONG_LOC_WIDTHS.map(width => ({ width, loc: LONG_LOC })),
    ].map(({ width, loc }) => ({
      name: `keeps the search box usable and the row unbroken at ${width}px${loc ? ` on ${loc}` : ''}`,
      fn: async (page: Page) => {
        await openNarrow(page, width, loc)
        const row = await readRow(page)
        // every property, not the first that fails — these each pass through
        // one another's failure, and a report naming one invites a fix that
        // only moves it
        // `asked` is the box's own width, so the row has to hold its margins
        // too — the same total `headerFit` sheds against
        const roomy = row.client >= SHED_ROW_PX + row.asked + row.margins
        const broken = [
          row.scroll > row.client &&
            `row overflows: content ${row.scroll} in ${row.client}`,
          row.search < SEARCH_BOX_FLOOR_PX &&
            `search box squeezed to ${row.search}px, floor is ${SEARCH_BOX_FLOOR_PX}`,
          roomy &&
            row.asked - row.search > 1 &&
            `search box squeezed to ${row.search}px of the ${row.asked} it asked for`,
          roomy &&
            row.rendered > row.textSpace &&
            `"${row.locString}" draws ${row.rendered}px in the ${row.textSpace}px the box leaves it`,
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
