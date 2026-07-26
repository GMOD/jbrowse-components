import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

import {
  assertCanvasHasContent,
  findByTestId,
  navigateToUrl,
  waitForDataLoaded,
} from '../helpers.ts'

import type { TestCase, TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

// Exercises the DisplayChrome force-load cycle (ADR-025): a too-large region
// early-returns TooLargeMessage instead of the canvas body, force-load remounts
// the body, and the GPU canvas must re-init and paint cleanly — proving the old
// `visibility:hidden` special-casing the variant displays used to need was
// artificial. jsdom can't render the variant GPU/canvas2d fallback (the
// equivalent StatsEstimation.test cases are `test.skip` for exactly that
// reason), so this lives in browser-tests.
//
// volvox.sv.vcf.gz is tiny (~66Kb estimate) so the gate never trips on its own,
// and the trigger has to sit on the ADAPTER: `resolveByteLimit` prefers an
// adapter-declared `fetchSizeLimit` over the display config, so a display-level
// limit can't lower a VcfTabixAdapter's 5MB default. Hence a `sessionTracks`
// clone of the track carrying `fetchSizeLimit: 1`, rather than anything routed
// through `displaySnapshot`.
//
// (The previous `displaySnapshot: { userByteLimit: 1 }` could never have worked:
// `showTrackGeneric` keeps a displaySnapshot key only if it is a real MST prop or
// a config slot, and `userByteLimit` was a volatile — so it was dropped and the
// gate never tripped. Force-load is a track-wide boolean now, with no ceiling to
// preset at all.)
const TRACK_ID = 'volvox multi-sample sv force load'

// Same track as the config's 'volvox multi-sample sv', with a 1-byte adapter
// fetch budget so every region is over budget.
const gatedTrack = {
  type: 'VariantTrack',
  trackId: TRACK_ID,
  name: TRACK_ID,
  assemblyNames: ['volvox'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'volvox.sv.vcf.gz',
    samplesTsvLocation: {
      uri: 'volvox.sv.samples.tsv',
      locationType: 'UriLocation',
    },
    fetchSizeLimit: 1,
  },
}
async function waitForForceLoadButton(page: Page) {
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('button')].some(b =>
        b.textContent.includes('Force load'),
      ),
    { timeout: 30000 },
  )
}

async function clickForceLoad(page: Page) {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b =>
      b.textContent.includes('Force load'),
    )
    btn?.click()
  })
}

function forceLoadTest({
  name,
  displayType,
  doneTestId,
  canvasTestId,
}: {
  name: string
  displayType: string
  doneTestId: string
  canvasTestId: string
}): TestCase {
  return {
    name,
    fn: async (page: Page) => {
      const spec = encodeSessionSpec({
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'volvox',
            loc: 'ctgA:1..50,001',
            tracks: [
              { trackId: TRACK_ID, displaySnapshot: { type: displayType } },
            ],
          },
        ],
      })
      await navigateToUrl(
        page,
        `config=test_data/volvox/config.json&session=${spec}` +
          `&sessionTracks=${encodeURIComponent(JSON.stringify([gatedTrack]))}` +
          `&sessionName=Test%20Session`,
      )

      // Too-large early-return: TooLargeMessage is mounted, the canvas is not.
      await waitForForceLoadButton(page)
      const canvasBefore = await page.$(`[data-testid="${canvasTestId}"]`)
      if (canvasBefore) {
        throw new Error(
          `${canvasTestId} should be absent while region is too large`,
        )
      }

      // Force-load remounts the body; the GPU canvas re-inits and paints.
      await clickForceLoad(page)
      await findByTestId(page, doneTestId, 60000)
      await waitForDataLoaded(page)
      await assertCanvasHasContent(page, `[data-testid="${canvasTestId}"]`)
    },
  }
}

const suite: TestSuite = {
  name: 'Variant Force Load',
  tests: [
    forceLoadTest({
      name: 'multi-sample variant force-load re-renders canvas',
      displayType: 'LinearMultiSampleVariantDisplay',
      doneTestId: 'variant-display-done',
      canvasTestId: 'variant_canvas',
    }),
    forceLoadTest({
      name: 'variant matrix force-load re-renders canvas',
      displayType: 'LinearMultiSampleVariantMatrixDisplay',
      doneTestId: 'variant-matrix-display-done',
      canvasTestId: 'variant_matrix_canvas',
    }),
  ],
}

export default suite
