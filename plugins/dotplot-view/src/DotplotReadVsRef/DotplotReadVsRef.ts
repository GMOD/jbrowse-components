import { getConf } from '@jbrowse/core/configuration'
import { getSession, gatherOverlaps } from '@jbrowse/core/util'
import { MismatchParser } from '@jbrowse/plugin-alignments'

// locals
import type { ReducedFeature } from '../util'
import type { Feature } from '@jbrowse/core/util'
import type { LinearPileupDisplayModel } from '@jbrowse/plugin-alignments'

const { featurizeSA, getClip, getLength, getLengthSansClipping } =
  MismatchParser

export function onClick(feature: Feature, self: LinearPileupDisplayModel) {
  const session = getSession(self)
  try {
    const cigar = feature.get('CIGAR')
    const clipPos = getClip(cigar, 1)
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

    const feat = feature.toJSON()
    feat.strand = 1
    feat.mate = {
      refName: readName,
      start: clipPos,
      end: clipPos + getLengthSansClipping(cigar),
    }

    // if secondary alignment or supplementary, calculate length from SA[0]'s
    // CIGAR which is the primary alignments. otherwise it is the primary
    // alignment just use seq.length if primary alignment
    const totalLength = getLength(flags & 2048 ? SA2[0]!.CIGAR : cigar)

    const features = [feat, ...SA2] as ReducedFeature[]

    features.sort((a, b) => a.clipPos - b.clipPos)

    const refLength = features.reduce((a, f) => a + f.end - f.start, 0)

    session.addView('DotplotView', {
      type: 'DotplotView',
      hview: {
        offsetPx: 0,
        bpPerPx: refLength / 800,
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
