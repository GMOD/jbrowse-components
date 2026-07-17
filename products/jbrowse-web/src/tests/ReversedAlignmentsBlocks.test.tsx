import { fireEvent, waitFor } from '@testing-library/react'

import { createView, doBeforeEach, hts, setup } from './util.tsx'

import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

// `view.tracks[0].displays[0]` is untyped, so a renamed/removed getter reads as
// `any` and only fails as a waitFor timeout. Annotating with the real model type
// makes that a typecheck error instead.
function alignmentsDisplay(
  view: LinearGenomeViewModel,
): LinearAlignmentsDisplayModel {
  return view.tracks[0].displays[0]
}

/**
 * The wiring seam above the renderer.
 *
 * `renderers/reversedMirror.test.ts` proves the draw path, handed a
 * `reversed: true` block, paints the mirror image of the forward block — but it
 * constructs that block itself, so it can't prove the model actually delivers
 * one. This test closes that link.
 *
 * `display.renderBlocks` (from `MultiRegionDisplayMixin`,
 * `buildRenderBlocks(view.visibleRegions)`) is the exact array
 * `startRenderingBackend` passes to `b.renderBlocks(...)` on screen, and the
 * same source `renderSvg.tsx` builds its export blocks from. Asserting the flag
 * it carries after a real `navToLocString('…[rev]')` is asserting what the
 * renderer receives in production.
 *
 * A property, not a snapshot: orientation is read straight off the block, so
 * (unlike a snapshot of the drawn pixels) this can't silently record an
 * off-by-one draw as the expected output — that's `reversedMirror`'s job, and
 * the two compose to cover displayedRegion → renderBlocks → draw end to end.
 */
test('alignments display delivers reversed render blocks after a [rev] nav', async () => {
  const { view, findByTestId } = await createView()

  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), ...opts),
  )

  // Forward first — the flag must track the region, not read true regardless.
  await view.navToLocString('ctgA:1..4000', 'volvox')
  await findByTestId('pileup-display-done', ...opts)

  const forward = alignmentsDisplay(view).renderBlocks
  expect(forward.length).toBeGreaterThan(0)
  expect(forward.every(b => !b.reversed)).toBe(true)
  // non-vacuous: each block actually spans an on-screen region
  expect(forward.every(b => b.screenEndPx > b.screenStartPx)).toBe(true)

  // Same span reversed. renderBlocks derives synchronously from visibleRegions,
  // so poll it directly rather than a canvas-paint signal.
  await view.navToLocString('ctgA:1..4000[rev]', 'volvox')
  await waitFor(() => {
    const reversed = alignmentsDisplay(view).renderBlocks
    expect(reversed.length).toBe(forward.length)
    expect(reversed.every(b => b.reversed)).toBe(true)
    expect(reversed.every(b => b.screenEndPx > b.screenStartPx)).toBe(true)
  }, delay)
}, 45000)
