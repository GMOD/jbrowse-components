import { stripTrackIds, when } from '@jbrowse/core/util'

import {
  breakpointBpPerPx,
  getBreakendAssemblyRegions,
  makeTitle,
  splitRegionAtPosition,
} from './util.ts'

import type { BreakpointSplitView, Track } from './types.ts'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'

export async function navToMultiLevelBreak({
  stableViewId,
  feature,
  assemblyName,
  session,
  mirror,
  tracks: viewTracks = [],
  windowSize = 0,
}: {
  stableViewId?: string
  feature: Feature
  assemblyName: string
  windowSize?: number
  session: AbstractSessionModel
  mirror?: boolean
  tracks?: Track[]
}) {
  const {
    coverage,
    region: r1,
    mateRegion: r2,
  } = await getBreakendAssemblyRegions({
    feature,
    session,
    assemblyName,
  })
  const { refName, pos, mateRefName, matePos } = coverage

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
          tracks: stripTrackIds(viewTracks),
        },
        {
          type: 'LinearGenomeView',
          hideHeader: true,
          tracks: stripTrackIds(
            mirror === true ? [...viewTracks].reverse() : viewTracks,
          ),
        },
      ],
    }) as unknown as BreakpointSplitView
  } else {
    view.setDisplayName(makeTitle(feature))
  }
  await Promise.all([
    view.views[0]!.navToLocations(splitRegionAtPosition(r1, pos, assemblyName)),
    view.views[1]!.navToLocations(
      splitRegionAtPosition(r2, matePos, assemblyName),
    ),
  ])
  await when(() => view.views[1]!.initialized && view.views[0]!.initialized)

  const lgv0 = view.views[0]!
  const lgv1 = view.views[1]!
  const bpPerPx = breakpointBpPerPx(windowSize, lgv0.width)

  lgv0.zoomTo(bpPerPx)
  lgv1.zoomTo(bpPerPx)
  lgv0.centerAt(pos, refName)
  lgv1.centerAt(matePos, mateRefName)
}
