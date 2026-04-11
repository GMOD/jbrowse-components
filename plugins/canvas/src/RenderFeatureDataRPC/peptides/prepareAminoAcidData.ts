import { genomeToTranscriptSeqMapping } from 'g2p_mapper'

import { aggregateAminos } from './aggregateAminoAcids.ts'

import type { Feature } from '@jbrowse/core/util'

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
