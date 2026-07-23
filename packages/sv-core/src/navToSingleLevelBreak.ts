import {
  gatherOverlaps,
  getSession,
  stripTrackIds,
  when,
} from '@jbrowse/core/util'

import {
  breakpointBpPerPx,
  getBreakendAssemblyRegions,
  makeTitle,
} from './util.ts'

import type { BreakpointSplitView, Track } from './types.ts'
import type { AbstractSessionModel, Feature, Region } from '@jbrowse/core/util'

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

export async function singleLevelFocusedSnapshotFromBreakendFeature({
  feature,
  session,
  assemblyName,
  windowSize = 0,
}: {
  feature: Feature
  session: AbstractSessionModel
  assemblyName: string
  windowSize?: number
}) {
  const { coverage, region, mateRegion } = await getBreakendAssemblyRegions({
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
  session: AbstractSessionModel
  assemblyName: string
}) {
  const { coverage, region, mateRegion } = await getBreakendAssemblyRegions({
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

export async function navToSingleLevelBreak({
  stableViewId,
  feature,
  assemblyName,
  session,
  tracks,
  windowSize = 0,
  focusOnBreakends,
}: {
  stableViewId?: string
  feature: Feature
  assemblyName: string
  windowSize?: number
  session: AbstractSessionModel
  tracks?: Track[]
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
  let view = session.views.find(f => f.id === stableViewId) as
    | BreakpointSplitView
    | undefined
  if (!view) {
    view = session.addView('BreakpointSplitView', {
      ...snap,
      id: stableViewId,
      views: [
        {
          ...snap.views[0],
          tracks: tracks ? stripTrackIds(tracks) : [],
        },
      ],
    }) as unknown as BreakpointSplitView
  } else {
    view.views[0]?.setDisplayedRegions(snap.views[0]!.displayedRegions)
    view.setDisplayName(snap.displayName)
  }
  const lgv = view.views[0]!
  await when(() => lgv.initialized)

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
      lgv.scrollTo(Math.round(midPx - lgv.width / 2))
    } else {
      getSession(lgv).notify('Unable to navigate to breakpoint')
    }
  } else {
    // for encompassing view, fit the whole range
    const l0 = lgv.bpToPx({
      coord: Math.max(0, startPos - windowSize),
      refName,
    })
    const r0 = lgv.bpToPx({ coord: endPos + windowSize, refName: mateRefName })
    if (l0 && r0) {
      lgv.moveTo({ ...l0, offset: l0.offsetPx }, { ...r0, offset: r0.offsetPx })
    } else {
      getSession(lgv).notify('Unable to navigate to breakpoint')
    }
  }
}
