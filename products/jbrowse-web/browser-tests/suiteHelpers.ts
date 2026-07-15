import { navigateWithSessionSpec, waitForDataLoaded } from './helpers.ts'
import { dualSnapshot } from './snapshot.ts'

import type { TestCase } from './types.ts'
import type { Page } from 'puppeteer'

// A LinearGenomeView track entry: either a bare trackId or a spec object
// carrying a displaySnapshot. Mirrors what session-spec accepts.
export type LgvTrack = string | Record<string, unknown>

interface SnapshotTestCommon {
  name: string
  // base snapshot name; `targeted_`/`fullpage_` prefixes are added by
  // dualSnapshot, a trailing `-canvas` is stripped
  snapshot: string
  config?: string
  threshold?: number
  // set false for a display that legitimately renders empty (skips the
  // shader-drew-something gate)
  assertContent?: boolean
  // gates the test behind --include-remote (data fetched from S3/UCSC)
  requiresRemote?: boolean
  // wait + data-loaded timeout; raise for whole-genome remote renders
  timeout?: number
}

// Navigate to a session spec, wait for the renderer's paint-complete element,
// then dual-snapshot. The shared body behind both factories below.
async function snapshotViewBody(
  page: Page,
  spec: Record<string, unknown>,
  {
    config,
    waitSelector,
    snapshotSelector,
    snapshot,
    threshold = 0.05,
    assertContent = true,
    timeout = 60000,
  }: {
    config?: string
    waitSelector: string
    snapshotSelector: string
    snapshot: string
    threshold?: number
    assertContent?: boolean
    timeout?: number
  },
) {
  await navigateWithSessionSpec(page, spec, config)
  await page.waitForSelector(waitSelector, { timeout })
  await waitForDataLoaded(page, timeout)
  await dualSnapshot(page, `${snapshot}-canvas`, snapshotSelector, threshold, {
    assertContent,
  })
}

export interface LgvSnapshotOpts extends SnapshotTestCommon {
  tracks: LgvTrack[]
  // omit for a whole-genome view (triggers showAllRegionsInAssembly)
  loc?: string
  assembly?: string
  // when set, wait on (and snapshot) `[data-testid="<doneTestId>"] canvas`,
  // e.g. 'pileup-display-done'. Otherwise wait on the generic
  // `[data-testid$="-done"] canvas` that any single-display view exposes.
  doneTestId?: string
  // override the snapshot target when it isn't the `<doneTestId> canvas` child
  // (e.g. a paired-arc display whose `*-done` element IS the canvas)
  snapshotSelector?: string
}

// Collapses the overwhelmingly common "open a LinearGenomeView at <loc> with
// <tracks>, wait for paint, dual-snapshot the canvas" test into one
// declaration. Replaces ~15 hand-rolled copies per snapshot suite. For views
// whose `*_done` element IS the canvas (synteny/hic/dotplot), use
// `viewSnapshotTest` instead — this is LGV-display-shaped.
export function lgvSnapshotTest({
  name,
  snapshot,
  tracks,
  loc,
  assembly = 'volvox',
  config,
  doneTestId,
  snapshotSelector,
  threshold,
  assertContent,
  requiresRemote,
  timeout,
}: LgvSnapshotOpts): TestCase {
  const canvasSelector = doneTestId
    ? `[data-testid="${doneTestId}"] canvas`
    : '[data-testid$="-done"] canvas'
  return {
    name,
    requiresRemote,
    fn: page =>
      snapshotViewBody(
        page,
        { views: [{ type: 'LinearGenomeView', assembly, loc, tracks }] },
        {
          config,
          waitSelector: snapshotSelector ?? canvasSelector,
          snapshotSelector: snapshotSelector ?? canvasSelector,
          snapshot,
          threshold,
          assertContent,
          timeout,
        },
      ),
  }
}

export interface ViewSnapshotOpts extends SnapshotTestCommon {
  // a single view spec object (its `type` plus the view-specific fields, e.g.
  // a LinearSyntenyView with nested `views`)
  view: Record<string, unknown>
  // data-testid of the paint-complete element to wait on and (by default)
  // snapshot, e.g. 'synteny_canvas_done'
  waitTestId: string
  // override when the snapshot target differs from the wait element, e.g. hic
  // waits on 'hic-display-done' but snapshots 'hic_canvas'
  snapshotSelector?: string
}

// Snapshot a whole-view render (synteny/dotplot/hic, or any view whose
// paint-complete element is itself the canvas) where the wait element and the
// snapshot target are the `*_done` element directly, not a `canvas` child.
export function viewSnapshotTest({
  name,
  snapshot,
  view,
  config,
  waitTestId,
  snapshotSelector,
  threshold,
  assertContent,
  requiresRemote,
  timeout,
}: ViewSnapshotOpts): TestCase {
  const waitSelector = `[data-testid="${waitTestId}"]`
  return {
    name,
    requiresRemote,
    fn: page =>
      snapshotViewBody(
        page,
        { views: [view] },
        {
          config,
          waitSelector,
          snapshotSelector: snapshotSelector ?? waitSelector,
          snapshot,
          threshold,
          assertContent,
          timeout,
        },
      ),
  }
}
