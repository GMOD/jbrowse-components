import { getConf } from '@jbrowse/core/configuration'
import { gatherOverlaps, getSession, sum } from '@jbrowse/core/util'
import {
  featurizeSA,
  getClip,
  getLength,
  getLengthSansClipping,
} from '@jbrowse/plugin-alignments'

import type { ReducedFeature } from '../util.ts'
import type { Feature } from '@jbrowse/core/util'
import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments'

export function onClick(feature: Feature, self: LinearAlignmentsDisplayModel) {
  const session = getSession(self)
  try {
    const cigar = feature.get('CIGAR')
    const clipLengthAtStartOfRead = getClip(cigar, 1)
    const flags = feature.get('flags')
    const strand = feature.get('strand')
    const readName = feature.get('name')
    const readAssembly = `${readName}_assembly_${Date.now()}`
    const { parentTrack } = self
    const [trackAssembly] = getConf(parentTrack, 'assemblyNames')
    const assemblyNames = [trackAssembly, readAssembly]
    const trackId = `track-${Date.now()}`
    const trackName = `${readName}_vs_${trackAssembly}`
    const SA = feature.get('tags')?.SA as string
    const SA2 = featurizeSA(SA, feature.id(), strand, readName, true)

    // if secondary alignment or supplementary, calculate length from SA[0]'s
    // CIGAR which is the primary alignments. otherwise it is the primary
    // alignment just use seq.length if primary alignment
    const totalLength = getLength(flags & 2048 ? SA2[0]!.CIGAR : cigar)

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
        interRegionPaddingWidth: 0,
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
