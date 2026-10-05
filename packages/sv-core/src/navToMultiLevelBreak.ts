import { stripTrackIds } from '@jbrowse/core/util'

import { awaitSplitViewSettled, openOrReuseSplitView } from './openSplitView.ts'
import {
  breakpointBpPerPx,
  getBreakendAssemblyRegions,
  makeTitle,
  splitRegionAtPosition,
  toCanonicalRefName,
} from './util.ts'

import type { Track } from './types.ts'
import type {
  AbstractViewContainer,
  AssemblyHost,
  Feature,
} from '@jbrowse/core/util'

/** A locus a stacked launch opens a panel at. */
export interface PanelStop {
  refName: string
  pos: number
}

/**
 * The stops in the order given, each folded into the nearest earlier stop on
 * its contig within `withinBp`, so two ends one window apart share a panel and
 * the route keeps its order: a read that leaves a locus and returns a few
 * hundred bases away is one panel, not two. A folded stop sits midway between
 * the ends it holds.
 */
export function mergeStopsWithin(
  stops: PanelStop[],
  withinBp: number,
): PanelStop[] {
  const kept: { refName: string; min: number; max: number }[] = []
  for (const { refName, pos } of stops) {
    const near = kept.find(
      k =>
        k.refName === refName &&
        pos >= k.min - withinBp &&
        pos <= k.max + withinBp,
    )
    if (near) {
      near.min = Math.min(near.min, pos)
      near.max = Math.max(near.max, pos)
    } else {
      kept.push({ refName, min: pos, max: pos })
    }
  }
  return kept.map(k => ({
    refName: k.refName,
    pos: Math.round((k.min + k.max) / 2),
  }))
}

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
  session: AbstractViewContainer & AssemblyHost
  mirror?: boolean
  /**
   * The tracks every panel is built from. `undefined` — a launcher with no
   * source view to copy from — lets a relaunch re-navigate the view it already
   * opened rather than rebuild it; see `openOrReuseSplitView`.
   */
  tracks?: Track[]
  /**
   * Tracks every panel opens when the launcher has no source view — the SV
   * inspector's callset and the reader's evidence tracks. Separate from
   * `tracks`, which `openOrReuseSplitView` reads as the rebuild signal: passing
   * these there would rebuild, and flash, on every chord click.
   */
  defaultTrackIds?: string[]
  /**
   * The loci to open, one panel each, in the order the chain crosses them. Omit
   * for the record's own two ends, the two a single BND describes.
   *
   * More than two comes from `walkBreakendChain`: a rearrangement whose
   * junctions leave from each other's loci is one shape across three or four
   * chromosomes, and a two-panel view of any one of its junctions shows a third
   * of it. The walk is the caller's, not this function's, so a caller with its
   * own idea of the chain (a spreadsheet row set, or a split read's own
   * junctions) can pass that instead.
   */
  stops?: PanelStop[]
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
  // A stop arrives in its file's spelling (a read's SA tag names `chr3` where
  // the assembly keeps `3`), so it is canonicalized the way the record's own
  // ends are.
  const canonical = toCanonicalRefName(assembly)
  const panels = chain.map(stop => {
    const refName = canonical(stop.refName)
    const region = assembly.getRegionForRefName(refName)
    if (!region) {
      throw new Error(
        `region ${stop.refName} not found in assembly ${assemblyName}`,
      )
    }
    return { ...stop, refName, region }
  })

  const { view, reused } = await openOrReuseSplitView({
    session,
    stableViewId,
    tracks: viewTracks,
    defaultTrackIds,
    // A view reused across launches was built for the panel count of whichever
    // record opened it first, so a chain of a different length has to rebuild
    // it rather than nav a panel that isn't there (or leave a stale one behind).
    stillFits: v => v.views.length === panels.length,
    snapshot: tracks => ({
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
    }),
  })
  if (reused) {
    view.setDisplayName(makeTitle(feature))
  }
  await Promise.all(
    panels.map((panel, idx) =>
      view.views[idx]!.navToLocations(
        splitRegionAtPosition(panel.region, panel.pos, assemblyName),
      ),
    ),
  )
  await awaitSplitViewSettled(view)

  const bpPerPx = breakpointBpPerPx(windowSize, view.views[0]!.width)
  for (const [idx, panel] of panels.entries()) {
    const lgv = view.views[idx]!
    lgv.zoomTo(bpPerPx)
    lgv.centerAt(panel.pos, panel.refName)
  }
}
