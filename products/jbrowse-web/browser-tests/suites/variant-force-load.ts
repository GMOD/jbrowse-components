import {
  assertCanvasHasContent,
  findByTestId,
  navigateWithSessionSpec,
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
// volvox.sv.vcf.gz is tiny so the byte-estimate gate never trips on its own;
// presetting `userByteLimit: 1` (first in the effective-limit precedence,
// ahead of the adapter's own limit) forces the too-large state deterministically
// — the estimate (~66Kb) exceeds 1. forceLoad then raises `userByteLimit` to
// ~1.5× the estimated bytes, clearing the gate.
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
      await navigateWithSessionSpec(page, {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'volvox',
            loc: 'ctgA:1..50,001',
            tracks: [
              {
                trackId: 'volvox multi-sample sv',
                displaySnapshot: { type: displayType, userByteLimit: 1 },
              },
            ],
          },
        ],
      })

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
