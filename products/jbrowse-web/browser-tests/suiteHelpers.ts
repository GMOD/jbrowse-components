import { navigateWithSessionSpec, waitForDataLoaded } from './helpers.ts'
import { dualSnapshot } from './snapshot.ts'

import type { TestCase } from './types.ts'
import type { Page } from 'puppeteer'

// A LinearGenomeView track entry: either a bare trackId or a spec object
// carrying a displaySnapshot. Mirrors what session-spec accepts.
export type LgvTrack = string | Record<string, unknown>

export interface LgvSnapshotOpts {
  name: string
  // base snapshot name; `targetted_`/`fullpage_` prefixes are added by
  // dualSnapshot, a trailing `-canvas` is stripped
  snapshot: string
  tracks: LgvTrack[]
  loc: string
  assembly?: string
  config?: string
  // when set, wait on (and snapshot) `[data-testid="<doneTestId>"] canvas`,
  // e.g. 'pileup-display-done'. Otherwise wait on the generic
  // `[data-testid$="-done"] canvas` that any single-display view exposes.
  doneTestId?: string
  threshold?: number
  // set false for a display that legitimately renders empty (skips the
  // shader-drew-something gate)
  assertContent?: boolean
}

// Collapses the overwhelmingly common "open a LinearGenomeView at <loc> with
// <tracks>, wait for paint, dual-snapshot the canvas" test into one
// declaration. Replaces ~15 hand-rolled copies per snapshot suite. For views
// whose `*_done` element IS the canvas (synteny/hic/dotplot), use the
// view-specific factories instead — this is LGV-display-shaped.
export function lgvSnapshotTest({
  name,
  snapshot,
  tracks,
  loc,
  assembly = 'volvox',
  config,
  doneTestId,
  threshold = 0.05,
  assertContent = true,
}: LgvSnapshotOpts): TestCase {
  const canvasSelector = doneTestId
    ? `[data-testid="${doneTestId}"] canvas`
    : '[data-testid$="-done"] canvas'
  return {
    name,
    fn: async (page: Page) => {
      await navigateWithSessionSpec(
        page,
        { views: [{ type: 'LinearGenomeView', assembly, loc, tracks }] },
        config,
      )
      await page.waitForSelector(canvasSelector, { timeout: 60000 })
      await waitForDataLoaded(page)
      await dualSnapshot(
        page,
        `${snapshot}-canvas`,
        canvasSelector,
        threshold,
        {
          assertContent,
        },
      )
    },
  }
}
