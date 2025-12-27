import { when } from '@jbrowse/core/util'

import {
  getBreakendCoveringRegions,
  makeTitle,
  splitRegionAtPosition,
  stripIds,
} from './util'

import type { BreakpointSplitView, Track } from './types'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export async function navToMultiLevelBreak({
  stableViewId,
  feature,
  assemblyName,
  session,
  mirror,
  tracks: viewTracks = [],
}: {
  stableViewId?: string
  feature: Feature
  assemblyName: string
  windowSize?: number
  session: AbstractSessionModel
  mirror?: boolean
  tracks?: Track[]
}) {
  const { assemblyManager } = session
  const assembly = await assemblyManager.waitForAssembly(assemblyName)
  if (!assembly) {
    throw new Error(`assembly ${assemblyName} not found`)
  }

  const { refName, pos, mateRefName, matePos } = getBreakendCoveringRegions({
    feature,
    assembly: assembly,
  })

  let view = session.views.find(f => f.id === stableViewId) as
    | BreakpointSplitView
    | undefined
  if (!view) {
    view = session.addView('BreakpointSplitView', {
      id: stableViewId,
      type: 'BreakpointSplitView',
      displayName: makeTitle(feature),
      views: [
        {
          type: 'LinearGenomeView',
          hideHeader: true,
          tracks: stripIds(viewTracks),
        },
        {
          type: 'LinearGenomeView',
          hideHeader: true,
          tracks: stripIds(mirror ? [...viewTracks].reverse() : viewTracks),
        },
      ],
    }) as unknown as { views: LinearGenomeViewModel[] }
  }
  // @ts-expect-error
  view.setDisplayName(makeTitle(feature))
  const r1 = assembly.regions!.find(r => r.refName === refName)
  const r2 = assembly.regions!.find(r => r.refName === mateRefName)
  if (!r1 || !r2) {
    throw new Error("can't find regions")
  }
  await Promise.all([
    view.views[0]!.navToLocations(splitRegionAtPosition(r1, pos, assemblyName)),
    view.views[1]!.navToLocations(
      splitRegionAtPosition(r2, matePos, assemblyName),
    ),
  ])
  await when(() => view.views[1]!.initialized && view.views[0]!.initialized)
  view.views[1]!.zoomTo(10)
  view.views[0]!.zoomTo(10)
  view.views[1]!.centerAt(matePos, mateRefName)
  view.views[0]!.centerAt(pos, refName)
}
