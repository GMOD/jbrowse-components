import { SAM_FLAG_SUPPLEMENTARY } from '@jbrowse/alignments-core'
import {
  featurizeSA,
  getClip,
  getLength,
  getLengthSansClipping,
} from '@jbrowse/cigar-utils'
import { getConf } from '@jbrowse/core/configuration'
import { gatherOverlaps, getSession, sum } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'
import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments'

interface ReducedFeature {
  refName: string
  start: number
  end: number
  clipLengthAtStartOfRead: number
  [key: string]: unknown
}

export function onClick(feature: Feature, self: LinearAlignmentsDisplayModel) {
  const session = getSession(self)
  try {
    const cigar = feature.get('CIGAR') as string
    const clipLengthAtStartOfRead = getClip(cigar, 1)
    const flags = feature.get('flags') as number
    const strand = feature.get('strand')!
    const readName = feature.get('name')!
    const readAssembly = `${readName}_assembly_${Date.now()}`
    const { parentTrack } = self
    const [trackAssembly] = getConf(parentTrack, 'assemblyNames')
    const assemblyNames = [trackAssembly, readAssembly]
    const trackId = `track-${Date.now()}`
    const trackName = `${readName}_vs_${trackAssembly}`
    const SA = (feature.get('tags') as { SA?: string } | undefined)?.SA
    const SA2 = featurizeSA(SA, feature.id(), strand, readName, true)

    // For supplementary alignments the full read length must come from the
    // primary's CIGAR (carried in SA[0]), since `cigar` here only covers this
    // alignment's slice of the read.
    const totalLength = getLength(
      flags & SAM_FLAG_SUPPLEMENTARY ? SA2[0]!.CIGAR : cigar,
    )

    const features = (
      [
        {
          ...feature.toJSON(),
          strand: 1,
          mate: {
            refName: readName,
            start: clipLengthAtStartOfRead,
            end: clipLengthAtStartOfRead + getLengthSansClipping(cigar),
          },
        },
        ...SA2,
      ] as ReducedFeature[]
    ).sort((a, b) => a.clipLengthAtStartOfRead - b.clipLengthAtStartOfRead)

    session.addView('DotplotView', {
      type: 'DotplotView',
      hview: {
        offsetPx: 0,
        bpPerPx: sum(features.map(a => a.end - a.start)) / 800,
        displayedRegions: gatherOverlaps(
          features.map((f, index) => {
            const { start, end, refName } = f
            return {
              start,
              end,
              refName,
              index,
              assemblyName: trackAssembly,
            }
          }),
        ),
      },
      vview: {
        offsetPx: 0,
        bpPerPx: totalLength / 400,
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

      viewTrackConfigs: [
        {
          type: 'SyntenyTrack',
          assemblyNames,
          adapter: {
            type: 'FromConfigAdapter',
            features,
          },
          trackId,
          name: trackName,
        },
      ],
      assemblyNames,
      tracks: [
        {
          configuration: trackId,
          type: 'SyntenyTrack',
          displays: [
            {
              type: 'DotplotDisplay',
              configuration: `${trackId}-DotplotDisplay`,
            },
          ],
        },
      ],

      displayName: `${readName} vs ${trackAssembly}`,
    })
  } catch (e) {
    console.error(e)
    session.notifyError(`${e}`, e)
  }
}
