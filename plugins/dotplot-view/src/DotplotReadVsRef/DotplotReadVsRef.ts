import { getConf } from '@jbrowse/core/configuration'
import { getSession, Feature, gatherOverlaps } from '@jbrowse/core/util'
import {
  LinearPileupDisplayModel,
  MismatchParser,
} from '@jbrowse/plugin-alignments'

// locals
import { ReducedFeature } from '../util'

const { featurizeSA, getClip, getTag, getLength, getLengthSansClipping } =
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
    const SA = (getTag(feature, 'SA') as string) || ''
    const SA2 = featurizeSA(SA, feature.id(), strand, readName, true)

    const feat = feature.toJSON()
    feat.strand = 1
    feat.mate = {
      end: clipPos + getLengthSansClipping(cigar),
      refName: readName,
      start: clipPos,
    }

    // if secondary alignment or supplementary, calculate length from SA[0]'s
    // CIGAR which is the primary alignments. otherwise it is the primary
    // alignment just use seq.length if primary alignment
    const totalLength = getLength(flags & 2048 ? SA2[0].CIGAR : cigar)

    const features = [feat, ...SA2] as ReducedFeature[]

    features.sort((a, b) => a.clipPos - b.clipPos)

    const refLength = features.reduce((a, f) => a + f.end - f.start, 0)

    session.addView('DotplotView', {
      assemblyNames,
      displayName: `${readName} vs ${trackAssembly}`,
      hview: {
        bpPerPx: refLength / 800,
        displayedRegions: gatherOverlaps(
          features.map((f, index) => {
            const { start, end, refName } = f
            return {
              assemblyName: trackAssembly,
              end,
              index,
              refName,
              start,
            }
          }),
        ),
        offsetPx: 0,
      },

      tracks: [
        {
          configuration: trackId,
          displays: [
            {
              configuration: `${trackId}-DotplotDisplay`,
              type: 'DotplotDisplay',
            },
          ],
          type: 'SyntenyTrack',
        },
      ],
      type: 'DotplotView',
      viewTrackConfigs: [
        {
          adapter: {
            features,
            type: 'FromConfigAdapter',
          },
          assemblyNames,
          name: trackName,
          trackId,
          type: 'SyntenyTrack',
        },
      ],

      vview: {
        bpPerPx: totalLength / 400,
        displayedRegions: [
          {
            assemblyName: readAssembly,
            end: totalLength,
            refName: readName,
            start: 0,
          },
        ],
        interRegionPaddingWidth: 0,
        minimumBlockWidth: 0,
        offsetPx: 0,
      },
    })
  } catch (e) {
    console.error(e)
    session.notifyError(`${e}`, e)
  }
}
