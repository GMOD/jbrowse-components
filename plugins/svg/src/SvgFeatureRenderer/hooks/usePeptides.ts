import { useSequenceData } from '@jbrowse/core/BaseFeatureWidget/SequenceFeatureDetails/useSequenceData'
import {
  defaultCodonTable,
  generateCodonTable,
  getSession,
} from '@jbrowse/core/util'
import { convertCodingSequenceToPeptides } from '@jbrowse/core/util/convertCodingSequenceToPeptides'
import { useFeatureSequence } from '@jbrowse/core/util/useFeatureSequence'

import type { Feature, Region } from '@jbrowse/core/util'

/**
 * A hook that extracts peptide sequences from a feature
 * @param options - The options for getting peptides
 * @returns The peptide sequence or undefined if unable to generate
 */
export function usePeptides({
  feature,
  region,
  displayModel,
  upDownBp = 0,
  forceLoad = true,
  shouldFetch = true,
}: {
  feature: Feature
  region: Region
  displayModel: unknown
  upDownBp?: number
  forceLoad?: boolean
  shouldFetch?: boolean
}) {
  const session = displayModel ? getSession(displayModel) : undefined
  const { assemblyName } = region

  const { sequence } = useFeatureSequence({
    session,
    assemblyName,
    feature,
    upDownBp,
    forceLoad,
    shouldFetch,
  })
  const sequenceData = useSequenceData({
    feature: feature.toJSON(),
    sequence,
  })

  // If we don't have a valid sequence or should not fetch, return undefined
  return !sequenceData || !shouldFetch
    ? undefined
    : convertCodingSequenceToPeptides({
        cds: sequenceData.cds,
        sequence: sequenceData.seq,
        codonTable: generateCodonTable(defaultCodonTable),
      })
}
