import { gatherOverlaps, getSession, when } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { getBreakendCoveringRegions, makeTitle, stripIds } from './util'

import type { BreakpointSplitView } from './types'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function singleLevelFocusedSnapshotFromBreakendFeature({
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
  const { assemblyManager } = session
  const assembly = assemblyManager.get(assemblyName)
  if (!assembly) {
    throw new Error(`assembly ${assemblyName} not found`)
  }
  if (!assembly.regions) {
    throw new Error(`assembly ${assemblyName} regions not loaded`)
  }
  const coverage = getBreakendCoveringRegions({
    feature,
    assembly,
  })
  const { refName, mateRefName } = coverage
  const topRegion = assembly.regions.find(f => f.refName === refName)!
  const bottomRegion = assembly.regions.find(f => f.refName === mateRefName)!
  return {
    coverage,
    snap: {
      type: 'BreakpointSplitView',
      views: [
        {
          type: 'LinearGenomeView',
          displayedRegions: gatherOverlaps([
            {
              ...topRegion,
              end: coverage.pos + 1 + windowSize,
              assemblyName,
            },
            {
              ...bottomRegion,
              start: coverage.matePos - windowSize,
              assemblyName,
            },
          ]),
        },
      ],
      displayName: makeTitle(feature),
    },
  }
}

export function singleLevelEncompassingSnapshotFromBreakendFeature({
  feature,
  session,
  assemblyName,
}: {
  feature: Feature
  session: AbstractSessionModel
  assemblyName: string
}) {
  const { assemblyManager } = session
  const assembly = assemblyManager.get(assemblyName)
  if (!assembly) {
    throw new Error(`assembly ${assemblyName} not found`)
  }
  if (!assembly.regions) {
    throw new Error(`assembly ${assemblyName} regions not loaded`)
  }
  const coverage = getBreakendCoveringRegions({
    feature,
    assembly,
  })
  const { refName, mateRefName } = coverage
  const topRegion = assembly.regions.find(f => f.refName === refName)!
  const bottomRegion = assembly.regions.find(f => f.refName === mateRefName)!
  return {
    coverage,
    snap: {
      type: 'BreakpointSplitView',
      views: [
        {
          type: 'LinearGenomeView',
          displayedRegions: gatherOverlaps([
            { ...topRegion, assemblyName },
            { ...bottomRegion, assemblyName },
          ]),
        },
      ],
      displayName: makeTitle(feature),
    },
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
  tracks?: any
  focusOnBreakends?: boolean
}) {
  const { snap, coverage } = focusOnBreakends
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
      })
  const { refName, pos: startPos, mateRefName, matePos: endPos } = coverage
  let view = session.views.find(f => f.id === stableViewId) as
    | BreakpointSplitView
    | undefined
  if (!view) {
    view = session.addView('BreakpointSplitView', {
      ...snap,
      views: [
        {
          ...snap.views[0],
          tracks: tracks ? stripIds(getSnapshot(tracks)) : [],
        },
      ],
    }) as unknown as { views: LinearGenomeViewModel[] }
  } else {
    view.views[0]?.setDisplayedRegions(snap.views[0]!.displayedRegions)
    // @ts-expect-error
    view.setDisplayName(snap.displayName)
  }
  const lgv = view.views[0]!
  await when(() => lgv.initialized)

  const l0 = lgv.bpToPx({
    coord: Math.max(0, startPos - windowSize),
    refName,
  })
  const r0 = lgv.bpToPx({
    coord: endPos + windowSize,
    refName: mateRefName,
  })
  if (l0 && r0) {
    lgv.moveTo(
      {
        ...l0,
        offset: l0.offsetPx,
      },
      {
        ...r0,
        offset: r0.offsetPx,
      },
    )
  } else {
    getSession(lgv).notify('Unable to navigate to breakpoint')
  }
}
