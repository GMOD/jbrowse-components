import { readConfObject } from '@jbrowse/core/configuration'
import { allSessionTracks, isSameAssemblyName } from '@jbrowse/core/util/tracks'

import { getMate } from '../syntenyMate.ts'
import { DEFAULT_WINDOW_SIZE } from './launchDefaults.ts'
import { paddedLocString } from './paddedLocString.ts'
import { resolvedMateSpan } from './resolvePanel.ts'
import { visibleSpanOnFeature } from './visibleSpanOnRefName.ts'

import type { RegionOfInterest } from './resolvePanel.ts'
import type {
  AbstractViewContainer,
  AssemblyHost,
  Feature,
  TrackCatalog,
} from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export type MateViewHost = AbstractViewContainer & AssemblyHost & TrackCatalog

const ANNOTATION_TRACK_TYPE = 'FeatureTrack'

// What the opened view turns on: the session's annotation for the mate
// assembly, which on a pangenome config is one gene track per strain. Only
// annotation, not everything configured for the assembly — an alignments track
// turned on behind the user's back fetches data nobody asked for, and a
// FeatureTrack over a few kb is one tabix range query. The graph genome view's
// launch out of a node makes the same choice, so a strain arrives the same way
// from either view.
function annotationTracks(host: MateViewHost, assemblyName: string) {
  return allSessionTracks(host).flatMap(track => {
    const assemblyNames = readConfObject(track, 'assemblyNames') as string[]
    return readConfObject(track, 'type') === ANNOTATION_TRACK_TYPE &&
      assemblyNames.some(name =>
        isSameAssemblyName(name, assemblyName, host.assemblyManager),
      )
      ? [readConfObject(track, 'trackId') as string]
      : []
  })
}

/**
 * The plain-linear-view way out of an alignment: open the mate assembly on its
 * own at the region this alignment says corresponds. Beside the synteny launch,
 * which is a comparison, this is a jump — the question it answers is "what is
 * over there", which a MAF row and a graph node already answer with the same
 * kind of item, so a strain reads the same way out of every view.
 *
 * Gated on the assembly being LOADED, not on the track declaring it: a mate
 * name comes out of the alignment file, and a PanSN sample the config carries
 * as an assembly under that name opens fine whether or not the track lists it.
 *
 * The locus is the mate side of `region` — the clicked block, or by default the
 * anchor view's visible window on the feature's contig — resolved the way the
 * launch resolves it: a CIGAR walk, or interpolation across a block that
 * carries none, padded by the launch's default window. One view per anchor
 * view and mate assembly, so following several alignments to one strain
 * re-navigates a view rather than stacking a new one each time, which is what
 * the MAF display's per-sample items do too.
 */
export function openMateInLinearView({
  host,
  feature,
  anchorView,
  region,
}: {
  host: MateViewHost
  feature: Feature
  anchorView: LinearGenomeViewModel
  region?: RegionOfInterest
}): { assemblyName: string; open: () => Promise<void> } | undefined {
  const mate = getMate(feature)
  if (!mate || !host.assemblyManager.has(mate.assemblyName)) {
    return undefined
  }
  const { assemblyName } = mate
  return {
    assemblyName,
    open: async () => {
      const span = resolvedMateSpan(
        feature,
        region ?? visibleSpanOnFeature(host, anchorView, feature),
      )
      if (!span) {
        return
      }
      const loc = paddedLocString({
        refName: span.refName,
        start: span.start,
        end: span.end,
        windowSize: DEFAULT_WINDOW_SIZE,
      })
      const id = `${anchorView.id}-mate-${assemblyName}`
      const view = host.views.find(v => v.id === id) as
        | LinearGenomeViewModel
        | undefined
      if (view) {
        await view.navToLocString(loc, assemblyName)
      } else {
        host.addView('LinearGenomeView', {
          id,
          assembly: assemblyName,
          loc,
          tracks: annotationTracks(host, assemblyName),
        })
      }
    },
  }
}

export function openMateLabel(assemblyName: string) {
  return `Open ${assemblyName} at the matching region`
}
