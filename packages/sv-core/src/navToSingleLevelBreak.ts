import {
  gatherOverlaps,
  getNotificationSink,
  stripTrackIds,
} from '@jbrowse/core/util'
import { bpToOffset, compareBpOffsets } from '@jbrowse/core/util/Base1DUtils'
import { whenViewSettled } from '@jbrowse/core/util/whenViewSettled'

import { openDefaultTracks, openOrReuseSplitView } from './openSplitView.ts'
import {
  breakpointBpPerPx,
  getBreakendAssemblyRegions,
  makeTitle,
} from './util.ts'

import type { Track } from './types.ts'
import type {
  AbstractViewContainer,
  AssemblyHost,
  Feature,
  Region,
} from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

function singleLevelSnap(feature: Feature, regions: Region[]) {
  return {
    type: 'BreakpointSplitView',
    views: [
      {
        type: 'LinearGenomeView',
        displayedRegions: gatherOverlaps(regions),
      },
    ],
    displayName: makeTitle(feature),
  }
}

/**
 * `getBreakendAssemblyRegions`, with the two ends put in the order a single row
 * lays them out.
 *
 * `gatherOverlaps` groups by refName and, within a refName, sorts by start — so
 * the row reads left to right in genomic order. A BND may name a mate *upstream*
 * of itself (`chr1:2000000  ]chr1:1000000]`, which is the other half of every
 * reciprocal pair), and then the record's own end is the right-hand one. Taken
 * in record order, the two windows below are built backwards: they overlap,
 * merge into everything between the breakends, and the view frames the middle of
 * the deletion rather than either end of it.
 *
 * Only a same-contig pair can be out of order. Across two contigs the row order
 * is the order the regions are handed to `gatherOverlaps`, which is the record's
 * own end first.
 */
async function orderedBreakendEnds(args: {
  feature: Feature
  session: AbstractViewContainer & AssemblyHost
  assemblyName: string
}) {
  const { coverage, region, mateRegion } =
    await getBreakendAssemblyRegions(args)
  const { refName, pos, mateRefName, matePos } = coverage
  return refName === mateRefName && matePos < pos
    ? {
        // refName === mateRefName here, so swapping the positions is the whole
        // of the swap and `region`/`mateRegion` are the same region anyway
        coverage: { ...coverage, pos: matePos, matePos: pos },
        region,
        mateRegion,
      }
    : { coverage, region, mateRegion }
}

export async function singleLevelFocusedSnapshotFromBreakendFeature({
  feature,
  session,
  assemblyName,
  windowSize = 0,
}: {
  feature: Feature
  session: AbstractViewContainer & AssemblyHost
  assemblyName: string
  windowSize?: number
}) {
  const { coverage, region, mateRegion } = await orderedBreakendEnds({
    feature,
    session,
    assemblyName,
  })
  return {
    coverage,
    snap: singleLevelSnap(feature, [
      {
        ...region,
        end: Math.min(region.end, coverage.pos + 1 + windowSize),
        assemblyName,
      },
      {
        ...mateRegion,
        start: Math.max(0, coverage.matePos - windowSize),
        assemblyName,
      },
    ]),
  }
}

export async function singleLevelEncompassingSnapshotFromBreakendFeature({
  feature,
  session,
  assemblyName,
}: {
  feature: Feature
  session: AbstractViewContainer & AssemblyHost
  assemblyName: string
}) {
  const { coverage, region, mateRegion } = await orderedBreakendEnds({
    feature,
    session,
    assemblyName,
  })
  return {
    coverage,
    snap: singleLevelSnap(feature, [
      { ...region, assemblyName },
      { ...mateRegion, assemblyName },
    ]),
  }
}

/**
 * Frame the whole breakend span, padded by `windowSize`, across the view.
 *
 * Both ends are resolved to `BpOffset`s — `moveTo`'s units, bp within a
 * displayed region — rather than to the pixel offsets `bpToPx` reports, and
 * clamped into their region first: a breakend within `windowSize` of a contig's
 * end otherwise names a coordinate no displayed region holds, which reads back
 * as "unable to navigate" for a locus the view is perfectly able to show.
 */
function moveToEncompass({
  lgv,
  refName,
  startPos,
  mateRefName,
  endPos,
  windowSize,
}: {
  lgv: LinearGenomeViewModel
  refName: string
  startPos: number
  mateRefName: string
  endPos: number
  windowSize: number
}) {
  const { displayedRegions } = lgv
  const clamped = (name: string, coord: number) => {
    const r = displayedRegions.find(r => r.refName === name)
    return r ? Math.min(Math.max(coord, r.start), r.end) : coord
  }
  const l0 = bpToOffset({
    refName,
    coord: clamped(refName, startPos - windowSize),
    displayedRegions,
  })
  const r0 = bpToOffset({
    refName: mateRefName,
    coord: clamped(mateRefName, endPos + windowSize),
    displayedRegions,
  })
  if (l0 && r0) {
    // `orderedBreakendEnds` has already put the ends in row order, but the two
    // windows can still cross once padded — a pair closer together than
    // `windowSize` — and moveTo computes a negative bpPerPx from a backwards
    // pair rather than refusing
    const [a, b] = compareBpOffsets(l0, r0) <= 0 ? [l0, r0] : [r0, l0]
    lgv.moveTo(a, b)
  } else {
    getNotificationSink(lgv).notify('Unable to navigate to breakpoint')
  }
}

export async function navToSingleLevelBreak({
  stableViewId,
  feature,
  assemblyName,
  session,
  tracks,
  defaultTrackIds,
  windowSize = 0,
  focusOnBreakends,
}: {
  stableViewId?: string
  feature: Feature
  assemblyName: string
  windowSize?: number
  session: AbstractViewContainer & AssemblyHost
  /**
   * The panel's tracks. `undefined` — a launcher with no source view to copy
   * from — lets a relaunch re-navigate the view it already opened rather than
   * rebuild it; see `openOrReuseSplitView`.
   */
  tracks?: Track[]
  /**
   * Tracks the panel opens when the launcher has no source view. Separate from
   * `tracks` for the reason `navToMultiLevelBreak` spells out: that one doubles
   * as the reuse-vs-rebuild signal, so these are opened on a view this call
   * BUILT and a reused one already has them.
   */
  defaultTrackIds?: string[]
  focusOnBreakends?: boolean
}) {
  const { snap, coverage } = await (focusOnBreakends === true
    ? singleLevelFocusedSnapshotFromBreakendFeature({
        feature,
        assemblyName,
        session,
        windowSize,
      })
    : singleLevelEncompassingSnapshotFromBreakendFeature({
        feature,
        assemblyName,
        session,
      }))
  const { refName, pos: startPos, mateRefName, matePos: endPos } = coverage
  const { view, reused } = openOrReuseSplitView({
    session,
    stableViewId,
    tracks,
    snapshot: {
      ...snap,
      views: [{ ...snap.views[0], tracks: stripTrackIds(tracks ?? []) }],
    },
  })
  if (reused) {
    view.views[0]?.setDisplayedRegions(snap.views[0]!.displayedRegions)
    view.setDisplayName(snap.displayName)
  } else {
    openDefaultTracks(view.views, defaultTrackIds)
  }
  if (!(await whenViewSettled(view))) {
    throw new Error(`Cannot open breakpoint split view: ${view.error}`, {
      cause: view.error,
    })
  }
  const lgv = view.views[0]!

  if (focusOnBreakends === true) {
    // zoom to show the breakpoints with windowSize padding, centered between
    // them (matches navToMultiLevelBreak: windowSize bp on each side across the
    // view width)
    lgv.zoomTo(breakpointBpPerPx(windowSize, lgv.width))

    // center between the two breakpoints in the displayed regions
    const l0 = lgv.bpToPx({ coord: startPos, refName })
    const r0 = lgv.bpToPx({ coord: endPos, refName: mateRefName })
    if (l0 && r0) {
      const midPx = (l0.offsetPx + r0.offsetPx) / 2
      // setNewView rather than scrollTo: the zoom above had to land before
      // bpToPx could answer, and a bare scroll is one of the continuous paths
      // that deliberately leaves the coarse blocks where they were
      lgv.setNewView(lgv.bpPerPx, Math.round(midPx - lgv.width / 2))
    } else {
      getNotificationSink(lgv).notify('Unable to navigate to breakpoint')
    }
  } else {
    // for encompassing view, fit the whole range
    moveToEncompass({
      lgv,
      refName,
      startPos,
      mateRefName,
      endPos,
      windowSize,
    })
  }
}
