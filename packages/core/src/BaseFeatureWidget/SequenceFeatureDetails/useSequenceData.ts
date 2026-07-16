import { revcom, revlist } from '../../util/seqUtils.ts'
import {
  calculateUTRs2,
  calculateUTRs,
  filterSuccessiveElementsWithSameStartAndEndCoord,
} from '../util.tsx'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { Feat, SeqState } from '../util.tsx'

interface FeatureData {
  sequence: SeqState
  cds: Feat[]
  exons: Feat[]
  utr: Feat[]
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
  // A UTR is by definition the exonic sequence outside the CDS, so derive it
  // rather than trust the annotation: the renderer stitches the transcript from
  // cds+utr and ignores exons once there is a CDS, so a transcript annotating
  // only one of its UTRs (a common GFF shape) would silently drop the other
  // side from the cDNA. Deriving covers both sides or neither. Annotated UTRs
  // are the fallback for when there is nothing to derive from, e.g. calculateUTRs
  // bails on a malformed exon/CDS pairing.
  const annotatedUtr = filterSuccessiveElementsWithSameStartAndEndCoord(
    children.filter(sub => /utr/i.test(sub.type ?? '')),
  )
  const derivedUtr = !cds.length
    ? []
    : exons.length
      ? calculateUTRs(cds, exons)
      : calculateUTRs2(cds, {
          start: 0,
          end: feature.end - feature.start,
          type: 'gene',
        })

  return { cds, exons, utr: derivedUtr.length ? derivedUtr : annotatedUtr }
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
      upstream: revcom(downstream),
      downstream: revcom(upstream),
    },
    cds: revlist(cds, seq.length),
    exons: revlist(exons, seq.length),
    utr: revlist(utr, seq.length),
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
  const { cds, exons, utr } = processFeatureData(children, feature)
  const {
    sequence: adjusted,
    cds: adjustedCds,
    exons: adjustedExons,
    utr: adjustedUtr,
  } = feature.strand === -1
    ? handleReverseStrand(sequence, cds, exons, utr)
    : { sequence, cds, exons, utr }

  return {
    ...adjusted,
    cds: adjustedCds,
    exons: adjustedExons,
    utr: adjustedUtr,
  }
}
