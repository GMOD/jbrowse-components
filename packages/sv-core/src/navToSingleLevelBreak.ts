import {
  gatherOverlaps,
  getNotificationSink,
  stripTrackIds,
} from '@jbrowse/core/util'
import { bpToOffset, compareBpOffsets } from '@jbrowse/core/util/Base1DUtils'

import {
  awaitSplitViewSettled,
  openDefaultTracks,
  openOrReuseSplitView,
} from './openSplitView.ts'
import {
  breakpointBpPerPx,
  getBreakendAssemblyRegions,
  makeFeaturePair,
  makeTitle,
  panelIsTurned,
} from './util.ts'

import type { Track } from './types.ts'
import type { FeatureEnd } from './util.ts'
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
 * lays them out and each turned the way the join reads across the seam.
 *
 * The turn is `panelIsTurned`, the rule the spreadsheet row menu's
 * `pairedEndsLocString` already applied to the same pair of panels: the end
 * keeping the sequence to its right is reversed on the left, the end keeping its
 * left is reversed on the right. Without it a fusion whose acceptor sits on the
 * minus strand reads outwards from the join in the panel that receives it, which
 * is the picture the row menu was turning panels to avoid.
 *
 * Only across two contigs. This row is sorted into genomic order below and its
 * windows merge where they touch, so on one contig which panel an end lands on
 * is not the record's to say — `pairedEndsLocString` turns such a pair only
 * because it keeps the record's own order and never merges.
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
  const {
    coverage,
    region: ownRegion,
    mateRegion: farRegion,
  } = await getBreakendAssemblyRegions(args)
  const { refName, pos, mateRefName, matePos } = coverage
  const { k1, k2 } = makeFeaturePair(
    args.feature,
    (args.feature.get('ALT') as string[] | undefined)?.[0],
  )
  const turn = (r: Region, end: FeatureEnd, side: 'left' | 'right') => ({
    ...r,
    reversed: refName !== mateRefName && panelIsTurned(end, side),
  })
  const region = turn(ownRegion, k1, 'left')
  const mateRegion = turn(farRegion, k2, 'right')
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
  // Each region keeps the side of its breakend that faces the seam: the high
  // side for the left region and the low side for the right one, swapped when
  // the region is turned.
  const { pos, matePos } = coverage
  const through = (at: number) => at + 1 + windowSize
  const from = (at: number) => Math.max(0, at - windowSize)
  return {
    coverage,
    snap: singleLevelSnap(feature, [
      region.reversed
        ? { ...region, start: from(pos), assemblyName }
        : { ...region, end: Math.min(region.end, through(pos)), assemblyName },
      mateRegion.reversed
        ? {
            ...mateRegion,
            end: Math.min(mateRegion.end, through(matePos)),
            assemblyName,
          }
        : { ...mateRegion, start: from(matePos), assemblyName },
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
 * Frame both breakends with `pad` bp of their region outside each, on the
 * screen side away from the other end. Which coordinate direction that is
 * depends on the region: a turned one runs high to low, so its screen-left
 * padding is the higher coordinate.
 *
 * Resolved to `BpOffset`s — `moveTo`'s units — and clamped into the region
 * holding each breakend: near a contig's end the padded coordinate otherwise
 * names a coordinate no displayed region holds.
 */
function frameBreakends({
  view,
  refName,
  startPos,
  mateRefName,
  endPos,
  pad,
}: {
  view: LinearGenomeViewModel
  refName: string
  startPos: number
  mateRefName: string
  endPos: number
  pad: number
}) {
  const { displayedRegions } = view
  const outside = (name: string, coord: number, screenLeft: boolean) => {
    const r = displayedRegions.find(
      r => r.refName === name && coord >= r.start && coord <= r.end,
    )
    const padded =
      screenLeft !== (r?.reversed === true) ? coord - pad : coord + pad
    return bpToOffset({
      refName: name,
      coord: r ? Math.min(Math.max(padded, r.start), r.end) : padded,
      displayedRegions,
    })
  }
  const l0 = outside(refName, startPos, true)
  const r0 = outside(mateRefName, endPos, false)
  if (l0 && r0) {
    const [a, b] = compareBpOffsets(l0, r0) <= 0 ? [l0, r0] : [r0, l0]
    view.moveTo(a, b)
  } else {
    getNotificationSink(view).notify('Unable to navigate to breakpoint')
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
  const { view, reused } = await openOrReuseSplitView({
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
    await openDefaultTracks(view.views, defaultTrackIds)
  }
  await awaitSplitViewSettled(view)
  const lgv = view.views[0]!
  const defaultPad = (breakpointBpPerPx(0, lgv.width) * lgv.width) / 2
  frameBreakends({
    view: lgv,
    refName,
    startPos,
    mateRefName,
    endPos,
    pad:
      focusOnBreakends === true && windowSize === 0 ? defaultPad : windowSize,
  })
}
