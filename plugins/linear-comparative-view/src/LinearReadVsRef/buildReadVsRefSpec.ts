import { buildReadVsRefFeatures } from '@jbrowse/alignments-core'
import { gatherOverlaps } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'

export interface ReadVsRefSpec {
  temporaryAssembly: {
    name: string
    sequence: {
      type: 'ReferenceSequenceTrack'
      name: string
      trackId: string
      assemblyNames: string[]
      adapter: {
        type: 'FromConfigSequenceAdapter'
        noAssemblyManager: true
        features: {
          start: number
          end: number
          seq: string
          refName: string
          uniqueId: string
        }[]
      }
    }
  }
  viewSpec: {
    type: 'LinearSyntenyView'
    displayName: string
    views: unknown[]
    viewTrackConfigs: unknown[]
    tracks: unknown[]
  }
}

export interface BuildReadVsRefArgs {
  primaryFeature: Feature
  windowSize: number
  viewWidth: number
  trackAssembly: string
  getCanonicalRefName: (refName: string) => string | undefined
  sequenceTrackConf: { trackId: string }
  // Injected for testability. Production passes Date.now and Math.random.
  now: () => number
  rand: () => number
}

// Pure spec builder for the "Linear read vs ref" dialog. All session/MST
// side-effects (addTemporaryAssembly, addView) are performed by the caller
// against the returned spec. Inputs are pre-resolved primitives + injected
// `now`/`rand` so the result is fully deterministic for tests.
export function buildReadVsRefSpec(args: BuildReadVsRefArgs): ReadVsRefSpec {
  const {
    primaryFeature: feature,
    windowSize,
    viewWidth,
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
  } = buildReadVsRefFeatures(feature)

  const stamp = now()
  const readAssembly = `${readName}_assembly_${stamp}`
  const syntenyTrackId = `track-${stamp}`
  const syntenyTrackName = `${readName}_vs_${trackAssembly}`
  const seqTrackId = `${readName}_${stamp}`

  // features are already sorted along the read; assign canonical refNames and
  // pair each alignment with its mate via a shared syntenyId.
  for (const [idx, f] of features.entries()) {
    f.refName = getCanonicalRefName(f.refName) ?? f.refName
    f.syntenyId = idx
    f.mate.syntenyId = idx
    f.mate.uniqueId = `${f.uniqueId}_mate`
  }

  // The synteny adapter feature store carries both sides of each alignment
  // so the read assembly can be drawn against itself in the lower panel.
  const configFeatureStore = [...features, ...features.map(f => f.mate)]

  const expand = 2 * windowSize
  const refLen = features.reduce((a, f) => a + f.end - f.start + expand, 0)

  const lgvRegions = gatherOverlaps(
    features.map(f => ({
      refName: f.refName,
      start: Math.max(0, f.start - windowSize),
      end: f.end + windowSize,
      assemblyName: trackAssembly,
    })),
  )

  return {
    temporaryAssembly: {
      name: readAssembly,
      sequence: {
        type: 'ReferenceSequenceTrack',
        name: 'Read sequence',
        trackId: seqTrackId,
        assemblyNames: [readAssembly],
        adapter: {
          type: 'FromConfigSequenceAdapter',
          noAssemblyManager: true,
          features: [
            {
              start: 0,
              end: totalLength,
              seq: featSeq ?? '',
              refName: readName,
              uniqueId: `${rand()}`,
            },
          ],
        },
      },
    },
    viewSpec: {
      type: 'LinearSyntenyView',
      displayName: `${readName} vs ${trackAssembly}`,
      views: [
        {
          type: 'LinearGenomeView',
          hideHeader: true,
          offsetPx: 0,
          bpPerPx: refLen / viewWidth,
          displayedRegions: lgvRegions,
          tracks: [
            buildSequenceTrack(
              rand,
              [trackAssembly],
              sequenceTrackConf.trackId,
            ),
          ],
        },
        {
          type: 'LinearGenomeView',
          hideHeader: true,
          offsetPx: 0,
          bpPerPx: totalLength / viewWidth,
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
      viewTrackConfigs: [
        {
          type: 'SyntenyTrack',
          assemblyNames: [trackAssembly, readAssembly],
          adapter: {
            type: 'FromConfigAdapter',
            features: configFeatureStore,
          },
          trackId: syntenyTrackId,
          name: syntenyTrackName,
        },
      ],
      tracks: [
        {
          configuration: syntenyTrackId,
          type: 'SyntenyTrack',
          displays: [
            {
              type: 'LinearSyntenyDisplay',
              configuration: `${syntenyTrackId}-LinearSyntenyDisplay`,
            },
          ],
        },
      ],
    },
  }
}

function buildSequenceTrack(
  rand: () => number,
  assemblyNames: string[] | undefined,
  trackId: string,
) {
  return {
    id: `${rand()}`,
    type: 'ReferenceSequenceTrack',
    ...(assemblyNames ? { assemblyNames } : {}),
    configuration: trackId,
    displays: [
      {
        id: `${rand()}`,
        type: 'LinearReferenceSequenceDisplay',
        showReverse: true,
        showTranslation: false,
        height: 35,
        configuration: `${trackId}-LinearReferenceSequenceDisplay`,
      },
    ],
  }
}
