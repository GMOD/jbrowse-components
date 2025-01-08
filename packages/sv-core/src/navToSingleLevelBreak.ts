import { gatherOverlaps, getSession, when } from '@jbrowse/core/util'
import { getSnapshot } from 'mobx-state-tree'

import { getBreakendCoveringRegions } from './util'

import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Track } from './types'

function stripIds(arr: Track[]) {
  return arr.map(({ id, displays, ...rest }) => ({
    ...rest,
    displays: displays.map(({ id, ...rest }) => rest),
  }))
}

export function singleLevelSnapshotFromBreakendFeature({
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
      displayName: `${
        feature.get('name') || feature.get('id') || 'breakend'
      } split detail`,
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
}: {
  stableViewId?: string
  feature: Feature
  assemblyName: string
  windowSize?: number
  session: AbstractSessionModel
  tracks?: any
}) {
  const { snap, coverage } = singleLevelSnapshotFromBreakendFeature({
    feature,
    assemblyName,
    session,
  })
  const { refName, pos: startPos, mateRefName, matePos: endPos } = coverage
  let viewInStack = session.views.find(f => f.id === stableViewId) as
    | { views: any[] }
    | undefined

  if (!viewInStack) {
    viewInStack = session.addView('BreakpointSplitView', {
      ...snap,
      views: [
        {
          ...snap.views[0],
          tracks: tracks ? stripIds(getSnapshot(tracks)) : [],
        },
      ],
    }) as unknown as { views: LinearGenomeViewModel[] }
  } else {
    viewInStack.views[0]?.setDisplayedRegions(snap.views[0]!.displayedRegions)
    // @ts-expect-error
    viewInStack.setDisplayName(snap.displayName)
  }
  const lgv = viewInStack.views[0]!
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
    lgv.moveTo({ ...l0, offset: l0.offsetPx }, { ...r0, offset: r0.offsetPx })
  } else {
    getSession(lgv).notify('Unable to navigate to breakpoint')
  }
}
