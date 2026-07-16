import { revcom, revlist } from '../../util/seqUtils.ts'
import { filterSuccessiveElementsWithSameStartAndEndCoord } from '../util.tsx'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { Feat, SeqState } from '../util.tsx'

interface FeatureData {
  sequence: SeqState
  cds: Feat[]
  exons: Feat[]
}

function prepareSubfeatures(feature: SimpleFeatureSerialized) {
  const { start, subfeatures } = feature
  return (
    subfeatures
      ?.toSorted((a, b) => a.start - b.start)
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
    children.filter(sub => sub.type?.toLowerCase() === 'exon'),
  )
  // annotated UTRs are deliberately not read: a UTR is just the exonic sequence
  // outside the CDS, so the renderer derives the split from cds+exons. Trusting
  // the annotation meant a transcript that named only one of its UTRs lost the
  // other side from the cDNA entirely.
  return { cds, exons }
}

function handleReverseStrand(
  sequence: SeqState,
  cds: Feat[],
  exons: Feat[],
): FeatureData {
  const { seq, upstream = '', downstream = '' } = sequence
  return {
    sequence: {
      seq: revcom(seq),
      upstream: revcom(downstream),
      downstream: revcom(upstream),
    },
    cds: revlist(cds, seq.length),
    exons: revlist(exons, seq.length),
  }
}

export function getSequenceData({
  feature,
  sequence,
}: {
  feature: SimpleFeatureSerialized
  sequence: SeqState
}) {
  const children = prepareSubfeatures(feature)
  const { cds, exons } = processFeatureData(children, feature)
  const {
    sequence: adjusted,
    cds: adjustedCds,
    exons: adjustedExons,
  } = feature.strand === -1
    ? handleReverseStrand(sequence, cds, exons)
    : { sequence, cds, exons }

  return {
    ...adjusted,
    cds: adjustedCds,
    exons: adjustedExons,
  }
}
