import {
  buildReadVsRefNames,
  buildSyntheticAssembly,
} from '@jbrowse/alignments-core'
import { buildReadVsRefFeatures } from '@jbrowse/cigar-utils'
import { gatherOverlaps, sum } from '@jbrowse/core/util'

import type { SyntheticAssembly } from '@jbrowse/alignments-core'
import type { Feature } from '@jbrowse/core/util'

export interface DotplotReadVsRefSpec {
  temporaryAssembly: SyntheticAssembly
  viewSpec: {
    type: 'DotplotView'
    displayName: string
    assemblyNames: string[]
    hview: unknown
    vview: unknown
    tracks: unknown[]
  }
}

export interface BuildDotplotReadVsRefArgs {
  feature: Feature
  // Extra genomic context drawn either side of each aligned segment on the
  // horizontal axis, same meaning as the linear read-vs-ref launcher's.
  windowSize: number
  trackAssembly: string
  // Plot area the initial bpPerPx is sized against. The dotplot itself has not
  // been laid out yet, so the caller passes the geometry it will come up in.
  plotWidth: number
  plotHeight: number
  getCanonicalRefName: (refName: string) => string | undefined
  // Injected for testability. Production passes Date.now and Math.random.
  now: () => number
  rand: () => number
}

// Pure spec builder for "Dotplot of read vs ref". All session/MST side-effects
// (addTemporaryAssembly, addView) are performed by the caller against the
// returned spec, mirroring linear-comparative-view's buildReadVsRefSpec.
export function buildDotplotReadVsRefSpec({
  feature,
  windowSize,
  trackAssembly,
  plotWidth,
  plotHeight,
  getCanonicalRefName,
  now,
  rand,
}: BuildDotplotReadVsRefArgs): DotplotReadVsRefSpec {
  const { features, totalLength, readName } = buildReadVsRefFeatures(
    feature.toJSON(),
    getCanonicalRefName,
  )
  const {
    readAssembly,
    readAssemblyDisplayName,
    seqTrackId,
    syntenyTrackId,
    syntenyTrackName,
    displayName,
  } = buildReadVsRefNames({ readName, trackAssembly, now, rand })
  const assemblyNames = [trackAssembly, readAssembly]

  // Size hview's bpPerPx from the regions it actually draws, so overlap
  // merging and start-clamping in gatherOverlaps are reflected exactly.
  const hviewRegions = gatherOverlaps(
    features.map(f => ({
      start: Math.max(0, f.start - windowSize),
      end: f.end + windowSize,
      refName: f.refName,
      assemblyName: trackAssembly,
    })),
  )

  return {
    // The synthetic read assembly must be registered for the DotplotView to
    // initialize (assembliesInitialized gates on every assemblyName resolving);
    // it is torn down by DotplotView.beforeDestroy via removeTemporaryAssembly.
    temporaryAssembly: buildSyntheticAssembly({
      refName: readName,
      assemblyName: readAssembly,
      displayName: readAssemblyDisplayName,
      sequenceTrackName: 'Read sequence',
      totalLength,
      // No bases: a dotplot draws no sequence track, and the assembly's region
      // comes from the feature's start/end (mergeFeaturesToRegions), not from
      // the string. Carrying a whole ONT read's SEQ here would only bloat the
      // session snapshot. The linear launcher, which does render the read
      // sequence, passes it.
      seq: undefined,
      trackId: seqTrackId,
      uniqueId: seqTrackId,
    }),
    viewSpec: {
      type: 'DotplotView',
      displayName,
      assemblyNames,
      hview: {
        offsetPx: 0,
        bpPerPx: sum(hviewRegions.map(r => r.end - r.start)) / plotWidth,
        displayedRegions: hviewRegions,
      },
      vview: {
        offsetPx: 0,
        bpPerPx: totalLength / plotHeight,
        minimumBlockWidth: 0,
        displayedRegions: [
          {
            assemblyName: readAssembly,
            start: 0,
            end: totalLength,
            refName: readName,
          },
        ],
      },
      tracks: [
        {
          type: 'SyntenyTrack',
          configuration: {
            type: 'SyntenyTrack',
            assemblyNames,
            adapter: {
              type: 'FromConfigAdapter',
              features,
            },
            trackId: syntenyTrackId,
            name: syntenyTrackName,
          },
          displays: [
            {
              type: 'DotplotDisplay',
              configuration: `${syntenyTrackId}-DotplotDisplay`,
            },
          ],
        },
      ],
    },
  }
}
