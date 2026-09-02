import {
  annotationTrackIds,
  openAssemblyInLinearView,
} from '@jbrowse/core/util/tracks'

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
 * view and mate assembly, opened with the session's annotation for the mate —
 * the same view the MAF display's per-sample items and a multi-way lane give.
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
      await openAssemblyInLinearView({
        session: host,
        id: `${anchorView.id}-mate-${assemblyName}`,
        assemblyName,
        loc,
        tracks: annotationTrackIds(host, assemblyName),
      })
    },
  }
}
