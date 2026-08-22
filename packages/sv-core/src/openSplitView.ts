import { launchOrReplaceView } from '@jbrowse/core/util'

import type { BreakpointSplitView, Track } from './types.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'

/**
 * The view a launch should land in: the one `stableViewId` already names, when
 * that view can simply be re-navigated, or a freshly built one in the slot the
 * old one occupied.
 *
 * Re-navigating is the cheap path and keeps whatever the reader has done to the
 * view since, but it can only carry what a navigation sets — the regions and
 * the display name. "Copy tracks" and "Mirror the copied tracks" are decisions
 * about how the panels were BUILT, so a relaunch that re-navigates drops them
 * with nothing said: ticking "Copy tracks" and launching a second time into the
 * same view did nothing at all, and neither did unticking it. A launch that has
 * a track list to apply therefore rebuilds.
 *
 * `tracks === undefined` is a launcher with no opinion — a chord click, a
 * spreadsheet row, neither of which has a source view to copy from — and is
 * what keeps the SV inspector's chord-after-chord flow off the rebuild path,
 * where a remount would flash. `[]` is the reader asking for no tracks, which
 * is a construction choice like any other and rebuilds.
 *
 * Rebuilding goes through `launchOrReplaceView` rather than remove-then-add so the
 * view keeps the slot it already had, along with the focus, instead of
 * reappearing at the bottom of the session below whatever the reader was
 * looking at.
 */
/**
 * Open a launcher's default tracks on every panel of a view it just built.
 *
 * Only on a built view: a reused one already has them, and re-showing would put
 * back a track the reader had closed. A trackId the session cannot resolve
 * throws, and one stale id should not cost the reader the whole launch.
 */
export function openDefaultTracks(
  views: { showTrack: (trackId: string) => unknown }[],
  trackIds: string[] = [],
) {
  for (const view of views) {
    for (const trackId of trackIds) {
      try {
        view.showTrack(trackId)
      } catch (e) {
        console.error(e)
      }
    }
  }
}

export async function openOrReuseSplitView({
  session,
  stableViewId,
  tracks,
  stillFits,
  snapshot,
}: {
  session: AbstractSessionModel
  stableViewId?: string
  tracks?: Track[]
  /**
   * The per-shape half of "can this view be re-navigated" — for the stacked
   * shape, whether it has a panel per stop. Not asked when there is no view to
   * reuse.
   */
  stillFits?: (view: BreakpointSplitView) => boolean
  /** what to build when reuse is declined; `id` is filled in from here */
  snapshot: Record<string, unknown>
}): Promise<{ view: BreakpointSplitView; reused: boolean }> {
  const found = session.views.find(f => f.id === stableViewId)
  const existing = found as BreakpointSplitView | undefined
  if (
    existing !== undefined &&
    tracks === undefined &&
    (stillFits?.(existing) ?? true)
  ) {
    return { view: existing, reused: true }
  }
  return {
    view: (await launchOrReplaceView({
      session,
      typeName: 'BreakpointSplitView',
      initialState: { ...snapshot, id: stableViewId },
      replacing: found,
    })) as unknown as BreakpointSplitView,
    reused: false,
  }
}
