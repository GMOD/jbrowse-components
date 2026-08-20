import { displayPainted, encodeSessionSpec } from '@jbrowse/browser-test-utils'

import {
  assertCanvasHasContent,
  findByTestId,
  navigateToUrl,
} from '../helpers.ts'

import type { TestCase, TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

// The OTHER end of the force-load cycle: a too-large banner that comes down
// because the reader zoomed, with nothing clicked.
//
// `variant-force-load.ts` covers the click — TooLargeMessage replaces the body,
// Force load remounts it, the GPU canvas re-inits and paints. The zoom path
// reaches the same remount from a different direction and had no coverage at
// all, which mattered when `loadedRegions` stopped being written from the
// request (the region-covered-freeze fix): the release now depends on the plan
// deciding to refetch a span the display already held data for, and on the
// verdict falling with `bpPerPx`.
//
// Why this cannot be a jest test. `loadedRegionCoverage.test.ts` carries the
// model half — both freeze symptoms and a seeded walk over zoom and pan — and it
// runs in jsdom, which has no WebGL2. So the one thing it cannot see is the half
// this file exists for: whether the canvas that was UNMOUNTED while the banner
// was up comes back and paints. The same gap `variant-force-load.ts` names.
//
// WHAT THIS DOES NOT COVER, so nobody reads it as the freeze's regression test.
// The freeze is that a refused region claimed a span it never stored, so a later
// viewport read as `covered` and never refetched. On the density axis that left
// the previous, NARROWER payload painted across a wider viewport — and this file
// cannot tell that apart from a correct paint, because `assertCanvasHasContent`
// answers over the whole canvas rather than about where the content is. The
// freeze is pinned in jest, where the display's own data map is readable; what
// is pinned here is the remount.
//
// The density axis, not bytes, and that is load-bearing. Density per pixel is
// features over pixels, so it falls as you zoom in and the verdict releases on
// its own — a property of the viewport, not of a file's block layout. The byte
// axis releases only when a re-measure happens to quote less, and an index
// quotes whole blocks, so on a test file the estimate is a step function that
// may not step at all between two zooms (REGION_TOO_LARGE.md §"Measurement
// follows the viewport"). Gating this on bytes would be a test whose passing
// depended on tabix block boundaries.
const TRACK_ID = 'gff3tabix genes density gated'

// The config's `gff3tabix_genes`, with a density budget low enough that the
// whole contig is over it. Root-relative uris, unlike the config's bare
// filenames: `addRelativeUris` resolves those against the config's own location
// and a spec's `sessionTracks` never pass through it — the same trap
// `variant-force-load.ts` documents.
//
// The budget rides on a `displays` entry rather than a `displaySnapshot`,
// because it is a config slot on the display rather than a model prop, and this
// is the shape a real track config would use for it.
const DENSITY_LIMIT = 0.01

const gatedTrack = {
  type: 'FeatureTrack',
  trackId: TRACK_ID,
  name: TRACK_ID,
  assemblyNames: ['volvox'],
  adapter: {
    type: 'Gff3TabixAdapter',
    gffGzLocation: {
      uri: '/test_data/volvox/volvox.sort.gff3.gz',
      locationType: 'UriLocation',
    },
    index: {
      location: {
        uri: '/test_data/volvox/volvox.sort.gff3.gz.tbi',
        locationType: 'UriLocation',
      },
    },
  },
  displays: [
    {
      displayId: `${TRACK_ID}-LinearBasicDisplay`,
      type: 'LinearBasicDisplay',
      maxFeatureScreenDensity: DENSITY_LIMIT,
    },
  ],
}

function forceLoadButton(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('button')].some(b =>
      b.textContent.includes('Force load'),
    ),
  )
}

async function clickZoom(page: Page, dir: 'zoom_in' | 'zoom_out') {
  const button = await findByTestId(page, dir, 10000)
  await button.click()
}

// Zoom until `want` is what the banner is doing, or give up. Self-calibrating on
// purpose: how many clicks it takes to cross the budget is a function of the
// fixture's gene count and the runner's window width, and a hard-coded count is
// a test that starts failing when either moves — silently passing for the wrong
// reason if it lands the same way by luck.
async function zoomUntilBanner(
  page: Page,
  dir: 'zoom_in' | 'zoom_out',
  want: boolean,
) {
  for (let i = 0; i < 8; i++) {
    if ((await forceLoadButton(page)) === want) {
      return i
    }
    await clickZoom(page, dir)
    // the fetch autorun debounces 600ms before it even plans
    await new Promise(res => setTimeout(res, 1500))
  }
  if ((await forceLoadButton(page)) !== want) {
    throw new Error(
      `banner never became ${want ? 'visible' : 'hidden'} after 8 ${dir} clicks`,
    )
  }
  return 8
}

const test: TestCase = {
  name: 'canvas density banner releases on zoom-in and the canvas repaints',
  fn: async (page: Page) => {
    const spec = encodeSessionSpec({
      sessionTracks: [gatedTrack],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1..2,000',
          tracks: [{ trackId: TRACK_ID }],
        },
      ],
    })
    await navigateToUrl(
      page,
      `config=test_data/volvox/config.json&session=${spec}` +
        `&sessionName=Test%20Session`,
    )

    // Warm: a window narrow enough to be under budget paints normally. This is
    // the state the freeze needed — a region the display already holds data for
    // — so the zoom-out below is the one that used to poison it.
    await findByTestId(page, 'feature-display', 60000)
    await page.waitForSelector(displayPainted('feature-display'), {
      timeout: 60000,
    })

    // Out until the density verdict trips. The body unmounts with it.
    await zoomUntilBanner(page, 'zoom_out', true)
    if (await page.$(displayPainted('feature-display'))) {
      throw new Error(
        'canvas should be unmounted while the region is too large',
      )
    }

    // Back in: the verdict falls with bpPerPx, the body remounts, and the GPU
    // canvas has to re-init and paint — which is the assertion, and the whole
    // reason this is not a jest test.
    await zoomUntilBanner(page, 'zoom_in', false)
    await findByTestId(page, 'feature-display', 60000)
    await page.waitForSelector(displayPainted('feature-display'), {
      timeout: 60000,
    })
    await assertCanvasHasContent(
      page,
      `${displayPainted('feature-display')} canvas`,
    )
  },
}

const suite: TestSuite = {
  name: 'Canvas Gate Release',
  tests: [test],
}

export default suite
