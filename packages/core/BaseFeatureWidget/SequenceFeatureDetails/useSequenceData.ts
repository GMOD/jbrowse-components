import { revcom } from '../../util'
import {
  calculateUTRs2,
  calculateUTRs,
  filterSuccessiveElementsWithSameStartAndEndCoord,
  revlist,
} from '../util'

import type { SimpleFeatureSerialized } from '../../util'
import type { ErrorState, SeqState } from '../util'

/**
 * Handles sequence orientation for reverse strand features
 */
interface FeatureData {
  sequence: SeqState
  cds: any[]
  exons: any[]
  utr: any[]
} /**
 * Prepares feature subfeatures for display by sorting and adjusting coordinates
 * relative to the parent feature start position
 */
function prepareSubfeatures(feature: SimpleFeatureSerialized) {
  const { start, subfeatures } = feature
  return (
    subfeatures
      ?.sort((a, b) => a.start - b.start)
      .map(sub => ({
        ...sub,
        start: sub.start - start,
        end: sub.end - start,
      })) || []
  )
}

/**
 * Processes feature data to extract and deduplicate CDS, UTR, and exon features
 */
function processFeatureData(children: any[], feature: SimpleFeatureSerialized) {
  // Filter duplicate entries in cds and exon lists Duplicate entries may be
  // rare but were seen in Gencode v36 track NCList (produces broken protein
  // translations if included)
  const cds = filterSuccessiveElementsWithSameStartAndEndCoord(
    children.filter(sub => sub.type?.toLowerCase() === 'cds'),
  )
  const exons = filterSuccessiveElementsWithSameStartAndEndCoord(
    children.filter(sub => sub.type === 'exon'),
  )
  let utr = filterSuccessiveElementsWithSameStartAndEndCoord(
    children.filter(sub => sub.type?.match(/utr/i)),
  )

  // Calculate UTRs if not present but we have CDS and exons
  if (!utr.length && cds.length && exons.length) {
    utr = calculateUTRs(cds, exons)
  } else if (!utr.length && cds.length && !exons.length) {
    utr = calculateUTRs2(cds, {
      start: 0,
      end: feature.end - feature.start,
      type: 'gene',
    })
  }

  return {
    cds,
    exons,
    utr,
  }
}

function handleReverseStrand(
  sequence: SeqState,
  cds: any[],
  exons: any[],
  utr: any[],
): FeatureData {
  const { seq = '', upstream = '', downstream = '' } = sequence

  // For reverse strand, reverse complement the sequence and swap
  // upstream/downstream
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
  // Prepare subfeatures relative to parent feature start position
  const children = prepareSubfeatures(feature)

  // Process feature data to extract CDS, exons, and UTRs
  const { cds, exons, utr } = processFeatureData(children, feature)

  if (!sequence || 'error' in sequence) {
    return undefined
  } else {
    // Handle reverse strand orientation if needed
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
