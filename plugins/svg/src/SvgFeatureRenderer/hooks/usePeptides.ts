import { useSequenceData } from '@jbrowse/core/BaseFeatureWidget/SequenceFeatureDetails/useSequenceData'
import {
  defaultCodonTable,
  generateCodonTable,
  getSession,
} from '@jbrowse/core/util'
import { convertCodingSequenceToPeptides } from '@jbrowse/core/util/convertCodingSequenceToPeptides'
import { useFeatureSequence } from '@jbrowse/core/util/useFeatureSequence'

import type { Feature, Region } from '@jbrowse/core/util'

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

  const { sequence } = useFeatureSequence({
    session,
    assemblyName: region.assemblyName,
    feature,
    upDownBp,
    forceLoad,
    shouldFetch,
  })

  const sequenceData = useSequenceData({
    feature: feature.toJSON(),
    sequence,
  })

  if (!sequenceData || !shouldFetch) {
    return undefined
  }

  return convertCodingSequenceToPeptides({
    cds: sequenceData.cds,
    sequence: sequenceData.seq,
    codonTable: generateCodonTable(defaultCodonTable),
  })
}
