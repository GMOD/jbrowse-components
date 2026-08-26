import { computeDisplayPhase } from '@jbrowse/render-core/displayPhase'

import { createPerRegionTestEnvironment } from './perRegionTestEnv.ts'

import type { LinearGenomeViewModel } from '../LinearGenomeView/model.ts'
import type { PerRegionTestDisplay } from './perRegionTestEnv.ts'

// Refusal is per region; the banner is per DISPLAY. The two scopes differ, and
// the gap between them is what a reader coming off `fetchEachRegion.test.ts`
// gets wrong: that file pins a mixed batch — one region refused, one committed —
// against a STUBBED `commitFetchBytes`, so it stops one link before the
// consequence. This file is that link.
//
// `commitFetchBytes` folds the batch to its max (the budget is what ONE region
// may cost, REGION_TOO_LARGE.md §"A budget has a scope"), so a single
// over-budget region carries the whole display over budget. `regionTooLarge` is
// one boolean, `computeDisplayPhase` turns it into `tooLarge`, and that phase
// early-`return`s its own root in `DisplayStatusChromeBase` — the canvas
// unmounts rather than being drawn over.
//
// So the region that fit is measured, downloaded, stored and marked loaded, and
// then not drawn, because the display it belongs to is showing a banner
// instead. Nothing here is a bug on its own; the point is that "the per-region
// family refuses region by region" is a statement about the FETCH, and reading
// it as one about the banner is the mistake this file exists to block. Making
// the banner per-region is a real change to the chrome, not a change here:
// agent-docs/ideas/per-region-banner-for-a-mixed-region-set.md.

const ASSEMBLY_END = 10_000_000

/**
 * Both fixtures are derived from the budget the display actually resolved,
 * never from the configured slot: the sub-floor tier multiplies it, and pinning
 * that arithmetic here would duplicate `RegionTooLargeMixin.test.ts` and break
 * this file whenever the dial moves. What matters is only that one region sits
 * under the budget and the other over it.
 */
function setup() {
  const env = createPerRegionTestEnvironment({
    gate: { gateEnabled: true },
    assemblyEnd: ASSEMBLY_END,
  })
  const { display, view } = env.createDisplay() as {
    display: PerRegionTestDisplay
    view: LinearGenomeViewModel
  }
  const limit = display.resolvedByteLimit()!
  return { display, view, fits: limit / 2, over: limit * 50 }
}

test('the budget is per region, so a batch commits its max', () => {
  const { display, fits, over } = setup()

  display.commitFetchBytes([fits, over], display.gateFetchState())

  expect(display.estimatedFetchBytes).toBe(over)
})

test('one over-budget region carries the whole display over budget', () => {
  const { display, fits, over } = setup()

  display.commitFetchBytes([fits, over], display.gateFetchState())

  expect(display.regionTooLarge).toBe(true)
  expect(display.regionTooLargeReason).not.toBe('')
})

// The link `fetchEachRegion.test.ts` stops short of: the phase that banner
// resolves to replaces the display subtree, so the region that FIT is not drawn
// either.
test('the mixed batch resolves to the subtree-replacing phase', () => {
  const { display, fits, over } = setup()

  display.commitFetchBytes([fits, over], display.gateFetchState())

  expect(
    computeDisplayPhase(
      {
        renderError: undefined,
        regionTooLarge: display.regionTooLarge,
        error: undefined,
      },
      () => false,
    ),
  ).toBe('tooLarge')
})

// The converse, so the max fold is pinned as a MAX and not as "any refusal
// banners": a batch where every region fits leaves the display drawing, however
// many regions it holds and whatever they add up to.
test('a batch whose regions each fit draws, even when the sum is over', () => {
  const { display, fits } = setup()

  display.commitFetchBytes([fits, fits, fits], display.gateFetchState())

  expect(display.estimatedFetchBytes).toBe(fits)
  expect(display.regionTooLarge).toBe(false)
  expect(
    computeDisplayPhase(
      {
        renderError: undefined,
        regionTooLarge: display.regionTooLarge,
        error: undefined,
      },
      () => false,
    ),
  ).toBe('ready')
})
