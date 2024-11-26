import { parseBreakend } from '@gmod/vcf'
import { gatherOverlaps, getSession, when } from '@jbrowse/core/util'
// types
import { transaction } from 'mobx'
import { getSnapshot } from 'mobx-state-tree'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface Display {
  id: string
  [key: string]: unknown
}

export interface Track {
  id: string
  displays: Display[]
  [key: string]: unknown
}

function stripIds(arr: Track[]) {
  return arr.map(({ id, displays, ...rest }) => ({
    ...rest,
    displays: displays.map(({ id, ...rest }) => rest),
  }))
}

export function getBreakendCoveringRegions({
  feature,
  assembly,
}: {
  feature: Feature
  assembly: Assembly
}) {
  const alt = feature.get('ALT')?.[0]
  const bnd = alt ? parseBreakend(alt) : undefined
  const startPos = feature.get('start')
  const refName = feature.get('refName')
  const f = (ref: string) => assembly.getCanonicalRefName(ref) || ref

  if (alt === '<TRA>') {
    const INFO = feature.get('INFO')
    return {
      pos: startPos,
      refName: f(refName),
      mateRefName: f(INFO.CHR2[0]),
      matePos: INFO.END[0] - 1,
    }
  } else if (bnd?.MatePosition) {
    const matePosition = bnd.MatePosition.split(':')
    return {
      pos: startPos,
      refName: f(refName),
      mateRefName: f(matePosition[0]!),
      matePos: +matePosition[1]! - 1,
    }
  } else if (feature.get('mate')) {
    const mate = feature.get('mate')
    return {
      pos: startPos,
      refName: f(refName),
      mateRefName: f(mate.refName),
      matePos: mate.start,
    }
  } else {
    return {
      pos: startPos,
      refName: f(refName),
      mateRefName: f(refName),
      matePos: feature.get('end'),
    }
  }
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

export async function navToMultiLevelBreak({
  stableViewId,
  feature,
  assemblyName,
  session,
  tracks,
}: {
  stableViewId?: string
  feature: Feature
  assemblyName: string
  windowSize?: number
  session: AbstractSessionModel
  tracks?: any
}) {
  const bpPerPx = 10

  const { assemblyManager } = session
  const assembly = assemblyManager.get(assemblyName)
  if (!assembly) {
    throw new Error(`assembly ${assemblyName} not found`)
  }
  if (!assembly.regions) {
    throw new Error(`assembly ${assemblyName} regions not loaded`)
  }
  const {
    refName,
    pos: startPos,
    mateRefName,
    matePos: endPos,
  } = getBreakendCoveringRegions({
    feature,
    assembly,
  })

  const topRegion = assembly.regions.find(f => f.refName === refName)!
  const bottomRegion = assembly.regions.find(f => f.refName === mateRefName)!
  const topMarkedRegion = [{ ...topRegion }, { ...topRegion }]
  const bottomMarkedRegion = [{ ...bottomRegion }, { ...bottomRegion }]
  topMarkedRegion[0]!.end = startPos
  topMarkedRegion[1]!.start = startPos
  bottomMarkedRegion[0]!.end = endPos
  bottomMarkedRegion[1]!.start = endPos
  const snap = {
    type: 'BreakpointSplitView',
    views: [
      {
        type: 'LinearGenomeView',
        displayedRegions: topMarkedRegion,
        hideHeader: true,
        bpPerPx,
        offsetPx: (topRegion.start + feature.get('start')) / bpPerPx,
      },
      {
        type: 'LinearGenomeView',
        displayedRegions: bottomMarkedRegion,
        hideHeader: true,
        bpPerPx,
        tracks,
        offsetPx: (bottomRegion.start + endPos) / bpPerPx,
      },
    ],
    displayName: `${
      feature.get('name') || feature.get('id') || 'breakend'
    } split detail`,
  }

  let viewInStack = session.views.find(f => f.id === stableViewId) as
    | { views: any[] }
    | undefined

  if (!viewInStack) {
    viewInStack = session.addView('BreakpointSplitView', {
      ...snap,
      id: stableViewId,
      views: [
        {
          ...snap.views[0],
          tracks: tracks ? stripIds(getSnapshot(tracks)) : [],
        },
        {
          ...snap.views[1],
          tracks: (tracks ? stripIds(getSnapshot(tracks)) : []).reverse(),
        },
      ],
    }) as unknown as { views: LinearGenomeViewModel[] }
  } else {
    // re-nav existing view
    transaction(() => {
      for (let i = 0; i < viewInStack!.views.length; i++) {
        const s = snap.views[i]
        if (s) {
          viewInStack!.views[i].setDisplayedRegions(s.displayedRegions)
          viewInStack!.views[i].scrollTo(s.offsetPx - 800)
          viewInStack!.views[i].zoomTo(s.bpPerPx)
        }
      }
      // @ts-expect-error
      viewInStack!.setDisplayName(snap.displayName)
    })
  }
}
