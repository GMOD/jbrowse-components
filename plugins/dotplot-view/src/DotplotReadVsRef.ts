import {
  getClip,
  getTag,
  getLengthOnRef,
  getLength,
  getLengthSansClipping,
  gatherOverlaps,
  ReducedFeature,
} from './util'
import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { LinearPileupDisplayModel } from '@jbrowse/plugin-alignments'

export function onClick(feature: Feature, self: LinearPileupDisplayModel) {
  const session = getSession(self)
  try {
    const cigar = feature.get('CIGAR')
    const clipPos = getClip(cigar, 1)
    const flags = feature.get('flags')
    const origStrand = feature.get('strand')
    const readName = feature.get('name')
    const readAssembly = `${readName}_assembly_${Date.now()}`
    const { parentTrack } = self
    const [trackAssembly] = getConf(parentTrack, 'assemblyNames')
    const assemblyNames = [trackAssembly, readAssembly]
    const trackId = `track-${Date.now()}`
    const trackName = `${readName}_vs_${trackAssembly}`
    const SA: string = getTag(feature, 'SA') || ''
    const SAs = SA.split(';')
      .filter(aln => !!aln)
      .map((aln, index) => {
        const [saRef, saStart, saStrand, saCigar] = aln.split(',')
        const saLengthOnRef = getLengthOnRef(saCigar)
        const saLength = getLength(saCigar)
        const saLengthSansClipping = getLengthSansClipping(saCigar)
        const saStrandNormalized = saStrand === '-' ? -1 : 1
        const saClipPos = getClip(saCigar, saStrandNormalized * origStrand)
        const saRealStart = +saStart - 1
        return {
          refName: saRef,
          start: saRealStart,
          end: saRealStart + saLengthOnRef,
          seqLength: saLength,
          clipPos: saClipPos,
          CIGAR: saCigar,
          assemblyName: trackAssembly,
          strand: origStrand * saStrandNormalized,
          uniqueId: `${feature.id()}_SA${index}`,
          mate: {
            start: saClipPos,
            end: saClipPos + saLengthSansClipping,
            refName: readName,
          },
        }
      })

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
    const totalLength = getLength(flags & 2048 ? SAs[0].CIGAR : cigar)

    const features = [feat, ...SAs] as ReducedFeature[]

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
    session.notify(`${e}`, 'error')
  }
}
