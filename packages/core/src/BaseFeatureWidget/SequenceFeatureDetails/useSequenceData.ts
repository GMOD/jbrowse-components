import { revcom } from '../../util/index.ts'
import {
  calculateUTRs2,
  calculateUTRs,
  filterSuccessiveElementsWithSameStartAndEndCoord,
  revlist,
} from '../util.tsx'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { ErrorState, Feat, SeqState } from '../util.tsx'

interface FeatureData {
  sequence: SeqState
  cds: Feat[]
  exons: Feat[]
  utr: Feat[]
}

function prepareSubfeatures(feature: SimpleFeatureSerialized) {
  const { start, subfeatures } = feature
  return (
    [...(subfeatures ?? [])]
      .sort((a, b) => a.start - b.start)
      .map(sub => ({
        ...sub,
        start: sub.start - start,
        end: sub.end - start,
      })) ?? []
  )
}

function processFeatureData(
  children: Feat[],
  feature: SimpleFeatureSerialized,
) {
  // Filter duplicate entries in cds and exon lists. Duplicate entries may be
  // rare but were seen in Gencode v36 track NCList (produces broken protein
  // translations if included)
  const featureType = feature.type?.toLowerCase()
  const isMatureProteinRegion = featureType === 'mature_protein_region_of_cds'
  const cds = isMatureProteinRegion
    ? [{ start: 0, end: feature.end - feature.start, type: 'CDS' }]
    : filterSuccessiveElementsWithSameStartAndEndCoord(
        children.filter(sub => {
          const type = sub.type?.toLowerCase()
          return type === 'cds' || type === 'mature_protein_region_of_cds'
        }),
      )
  const exons = filterSuccessiveElementsWithSameStartAndEndCoord(
    children.filter(sub => sub.type === 'exon'),
  )
  let utr = filterSuccessiveElementsWithSameStartAndEndCoord(
    children.filter(sub => sub.type?.match(/utr/i)),
  )

  if (!utr.length && cds.length && exons.length) {
    utr = calculateUTRs(cds, exons)
  } else if (!utr.length && cds.length && !exons.length) {
    utr = calculateUTRs2(cds, {
      start: 0,
      end: feature.end - feature.start,
      type: 'gene',
    })
  }

  return { cds, exons, utr }
}

function handleReverseStrand(
  sequence: SeqState,
  cds: Feat[],
  exons: Feat[],
  utr: Feat[],
): FeatureData {
  const { seq, upstream = '', downstream = '' } = sequence
  return {
    sequence: {
      seq: revcom(seq),
      upstream: downstream ? revcom(downstream) : '',
      downstream: upstream ? revcom(upstream) : '',
    },
    cds: revlist(cds, seq.length),
    exons: revlist(exons, seq.length),
    utr: revlist(utr, seq.length),
  }
}

export function useSequenceData({
  feature,
  sequence,
}: {
  feature: SimpleFeatureSerialized
  sequence?: SeqState | ErrorState
}) {
  const children = prepareSubfeatures(feature)
  const { cds, exons, utr } = processFeatureData(children, feature)

  if (!sequence || 'error' in sequence) {
    return undefined
  } else {
    const {
      sequence: adjustedSequence,
      cds: adjustedCds,
      exons: adjustedExons,
      utr: adjustedUtr,
    } = feature.strand === -1
      ? handleReverseStrand(sequence, cds, exons, utr)
      : { sequence, cds, exons, utr }

    const { seq, upstream, downstream } = adjustedSequence
    return {
      seq,
      upstream,
      downstream,
      cds: adjustedCds,
      exons: adjustedExons,
      utr: adjustedUtr,
    }
  }
}
