import { genomeToTranscriptSeqMapping } from 'g2p_mapper'

import { aggregateAminos } from './aggregateAminoAcids'

import type { Feature } from '@jbrowse/core/util'

export interface AggregatedAminoAcid {
  aminoAcid: string
  startIndex: number
  endIndex: number
  length: number
  proteinIndex: number
}

export function prepareAminoAcidData(
  parent: Feature,
  protein: string,
  featureStart: number,
  featureEnd: number,
  strand: number,
) {
  return aggregateAminos(
    protein,
    // @ts-expect-error - g2p_mapper types
    genomeToTranscriptSeqMapping(parent.toJSON()).g2p,
    featureStart,
    featureEnd,
    strand,
  )
}
