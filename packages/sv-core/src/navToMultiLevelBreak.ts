import { stripTrackIds } from '@jbrowse/core/util'
import { when } from 'mobx'

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
  stops,
}: {
  stableViewId?: string
  feature: Feature
  assemblyName: string
  windowSize?: number
  session: AbstractSessionModel
  mirror?: boolean
  tracks?: Track[]
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

  // Regions come from getBreakendAssemblyRegions for the record's own two ends,
  // so the two-panel case resolves exactly as it always did; a longer chain
  // resolves its extra stops against the same assembly.
  const assembly = await session.assemblyManager.waitForAssembly(assemblyName)
  const chain =
    stops !== undefined && stops.length > 0
      ? stops
      : [
          { refName, pos },
          { refName: mateRefName, pos: matePos },
        ]
  const panels = chain.map((stop, idx) => {
    const region =
      idx === 0 && stop.refName === refName
        ? r1
        : idx === 1 && stop.refName === mateRefName
          ? r2
          : assembly?.regions?.find(r => r.refName === stop.refName)
    if (!region) {
      throw new Error(
        `region ${stop.refName} not found in assembly ${assemblyName}`,
      )
    }
    return { ...stop, region }
  })

  const found = session.views.find(f => f.id === stableViewId)
  let view = found as BreakpointSplitView | undefined
  // A view reused across launches was built for the panel count of whichever
  // record opened it first, so a chain of a different length has to rebuild it
  // rather than nav a panel that isn't there (or leave a stale one behind).
  if (found && view && view.views.length !== panels.length) {
    session.removeView(found)
    view = undefined
  }
  if (!view) {
    view = session.addView('BreakpointSplitView', {
      id: stableViewId,
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
          mirror === true && idx % 2 === 1
            ? [...viewTracks].reverse()
            : viewTracks,
        ),
      })),
    }) as unknown as BreakpointSplitView
  } else {
    view.setDisplayName(makeTitle(feature))
  }
  await Promise.all(
    panels.map((panel, idx) =>
      view.views[idx]!.navToLocations(
        splitRegionAtPosition(panel.region, panel.pos, assemblyName),
      ),
    ),
  )
  await when(() => view.views.every(v => v.initialized))

  const bpPerPx = breakpointBpPerPx(windowSize, view.views[0]!.width)
  for (const [idx, panel] of panels.entries()) {
    const lgv = view.views[idx]!
    lgv.zoomTo(bpPerPx)
    lgv.centerAt(panel.pos, panel.refName)
  }
}
