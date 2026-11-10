import {
  buildReadVsRefNames,
  buildSyntheticAssembly,
} from '@jbrowse/alignments-core'
import { buildReadVsRefFeatures } from '@jbrowse/cigar-utils'
import { withAdapterId } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { gatherOverlaps } from '@jbrowse/core/util'

import { buildSequenceTrack } from '../syntenyLaunchSequenceTrack.ts'

import type { ViewSnapshotInput } from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

export interface BuildReadVsRefArgs {
  primaryFeature: Feature
  windowSize: number
  trackAssembly: string
  getCanonicalRefName: (refName: string) => string | undefined
  sequenceTrackConf: { trackId: string }
  // Injected for testability. Production passes Date.now and Math.random.
  now: () => number
  rand: () => number
}

// Pure spec builder for the "Linear read vs ref" dialog; the caller adds the
// view. Inputs are pre-resolved primitives + injected
// `now`/`rand` so the result is fully deterministic for tests.
export function buildReadVsRefSpec(
  args: BuildReadVsRefArgs,
): ViewSnapshotInput<'LinearSyntenyView'> {
  const {
    primaryFeature: feature,
    windowSize,
    trackAssembly,
    getCanonicalRefName,
    sequenceTrackConf,
    now,
    rand,
  } = args

  const {
    features,
    totalLength,
    readName,
    seq: featSeq,
  } = buildReadVsRefFeatures(feature.toJSON(), getCanonicalRefName)

  const {
    readAssembly,
    readAssemblyDisplayName,
    seqTrackId,
    syntenyTrackId,
    syntenyTrackName,
    displayName,
  } = buildReadVsRefNames({ readName, trackAssembly, now, rand })

  // The synteny adapter feature store carries both sides of each alignment
  // so the read assembly can be drawn against itself in the lower panel.
  const configFeatureStore = [...features, ...features.map(f => f.mate)]

  const lgvRegions = gatherOverlaps(
    features.map(f => ({
      refName: f.refName,
      start: Math.max(0, f.start - windowSize),
      end: f.end + windowSize,
      assemblyName: trackAssembly,
    })),
  )

  // Size the top (ref) view's bpPerPx from the regions it actually draws, so
  // overlap-merging and start-clamping in gatherOverlaps are reflected exactly.
  const refLen = lgvRegions.reduce((a, r) => a + r.end - r.start, 0)

  return {
    type: 'LinearSyntenyView',
    syntheticAssemblies: [
      buildSyntheticAssembly({
        refName: readName,
        assemblyName: readAssembly,
        displayName: readAssemblyDisplayName,
        sequenceTrackName: 'Read sequence',
        totalLength,
        seq: featSeq,
        trackId: seqTrackId,
        uniqueId: `${rand()}`,
      }),
    ],
    displayName,
    views: [
      {
        type: 'LinearGenomeView',
        hideHeader: true,
        windowWidthBp: refLen,
        displayedRegions: lgvRegions,
        tracks: [
          buildSequenceTrack(rand, [trackAssembly], sequenceTrackConf.trackId),
        ],
      },
      {
        type: 'LinearGenomeView',
        hideHeader: true,
        windowWidthBp: totalLength,
        displayedRegions: [
          {
            assemblyName: readAssembly,
            start: 0,
            end: totalLength,
            refName: readName,
          },
        ],
        tracks: [buildSequenceTrack(rand, undefined, seqTrackId)],
      },
    ],
    // the band between the two rows. `tracks` on the view means trackIds to
    // open, so a built track snapshot written there is a launch recipe and
    // never becomes a band.
    levels: [
      {
        tracks: [
          {
            type: 'SyntenyTrack',
            configuration: {
              type: 'SyntenyTrack',
              assemblyNames: [trackAssembly, readAssembly],
              adapter: withAdapterId({
                type: 'FromConfigAdapter',
                features: configFeatureStore,
              }),
              trackId: syntenyTrackId,
              name: syntenyTrackName,
            },
            displays: [
              {
                type: 'LinearSyntenyDisplay',
                configuration: `${syntenyTrackId}-LinearSyntenyDisplay`,
              },
            ],
          },
        ],
      },
    ],
  }
}
