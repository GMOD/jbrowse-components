import { stripTrackIds } from '@jbrowse/core/util'
import { whenViewSettled } from '@jbrowse/core/util/whenViewSettled'

import { openDefaultTracks, openOrReuseSplitView } from './openSplitView.ts'
import {
  breakpointBpPerPx,
  getBreakendAssemblyRegions,
  makeTitle,
  splitRegionAtPosition,
} from './util.ts'

import type { Track } from './types.ts'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'

export async function navToMultiLevelBreak({
  stableViewId,
  feature,
  assemblyName,
  session,
  mirror,
  tracks: viewTracks,
  defaultTrackIds,
  windowSize = 0,
  stops,
}: {
  stableViewId?: string
  feature: Feature
  assemblyName: string
  windowSize?: number
  session: AbstractSessionModel
  mirror?: boolean
  /**
   * The tracks every panel is built from. `undefined` — a launcher with no
   * source view to copy from — lets a relaunch re-navigate the view it already
   * opened rather than rebuild it; see `openOrReuseSplitView`.
   */
  tracks?: Track[]
  /**
   * Tracks every panel opens when the launcher has no source view — the SV
   * inspector's own callset, say. Separate from `tracks` because that one
   * doubles as "the reader expressed an opinion about tracks", which is what
   * `openOrReuseSplitView` reads to choose between re-navigating a view and
   * rebuilding it; passing these as `tracks` would rebuild on every chord click
   * and the reuse path exists to stop that flashing. So they are opened on a
   * view this call BUILT, and a reused one already has them.
   */
  defaultTrackIds?: string[]
  /**
   * The loci to open, one panel each, in the order the chain crosses them. Omit
   * for the record's own two ends, which is what a single BND describes.
   *
   * More than two comes from `walkBreakendChain`: a rearrangement whose
   * junctions leave from each other's loci is one shape across three or four
   * chromosomes, and a two-panel view of any one of its junctions shows a third
   * of it. The walk is the caller's, not this function's, so a caller with its
   * own idea of the chain (a spreadsheet row set, say) can pass that instead.
   */
  stops?: { refName: string; pos: number }[]
}) {
  const { assembly, coverage } = await getBreakendAssemblyRegions({
    feature,
    session,
    assemblyName,
  })
  const { refName, pos, mateRefName, matePos } = coverage

  const chain =
    stops !== undefined && stops.length > 0
      ? stops
      : [
          { refName, pos },
          { refName: mateRefName, pos: matePos },
        ]
  // Every stop resolves the same way, the record's own two ends included:
  // `getBreakendAssemblyRegions` found those by this exact lookup against this
  // exact assembly, so special-casing them here only said the same thing twice.
  const panels = chain.map(stop => {
    const region = assembly.getRegionForRefName(stop.refName)
    if (!region) {
      throw new Error(
        `region ${stop.refName} not found in assembly ${assemblyName}`,
      )
    }
    return { ...stop, region }
  })

  const tracks = viewTracks ?? []
  const { view, reused } = await openOrReuseSplitView({
    session,
    stableViewId,
    tracks: viewTracks,
    // A view reused across launches was built for the panel count of whichever
    // record opened it first, so a chain of a different length has to rebuild
    // it rather than nav a panel that isn't there (or leave a stale one behind).
    stillFits: v => v.views.length === panels.length,
    snapshot: {
      type: 'BreakpointSplitView',
      displayName: makeTitle(feature),
      views: panels.map((_panel, idx) => ({
        type: 'LinearGenomeView',
        hideHeader: true,
        // `mirror` reverses the copied track order on every panel after the
        // first, so a pileup meets the junction from the same side in the panel
        // above and the panel below. On a three-panel chain the middle panel is
        // read against both of its neighbours, and reversing it once is what
        // puts its reads next to the panel they connect to on each side.
        tracks: stripTrackIds(
          mirror === true && idx % 2 === 1 ? [...tracks].reverse() : tracks,
        ),
      })),
    },
  })
  if (reused) {
    view.setDisplayName(makeTitle(feature))
  } else {
    await openDefaultTracks(view.views, defaultTrackIds)
  }
  await Promise.all(
    panels.map((panel, idx) =>
      view.views[idx]!.navToLocations(
        splitRegionAtPosition(panel.region, panel.pos, assemblyName),
      ),
    ),
  )
  if (!(await whenViewSettled(view))) {
    throw new Error(`Cannot open breakpoint split view: ${view.error}`, {
      cause: view.error,
    })
  }

  const bpPerPx = breakpointBpPerPx(windowSize, view.views[0]!.width)
  for (const [idx, panel] of panels.entries()) {
    const lgv = view.views[idx]!
    lgv.zoomTo(bpPerPx)
    lgv.centerAt(panel.pos, panel.refName)
  }
}
