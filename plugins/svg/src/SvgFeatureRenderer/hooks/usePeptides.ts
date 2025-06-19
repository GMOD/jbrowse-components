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
}: {
  feature: Feature
  region: Region
  displayModel: unknown
  upDownBp?: number
  forceLoad?: boolean
}) {
  const session = displayModel ? getSession(displayModel) : undefined
  const { assemblyName } = region
  const { sequence } = useFeatureSequence({
    session,
    assemblyName,
    feature,
    upDownBp,
    forceLoad,
  })

  // If we don't have a valid sequence, return undefined
  if (!sequence || 'error' in sequence) {
    return undefined
  }

  // Get feature start position for relative positioning
  const start = feature.get('start')

  // Extract CDS features and adjust their positions relative to the parent feature
  const cds =
    feature
      .toJSON()
      .subfeatures?.filter(sub => sub.type?.toLowerCase() === 'cds')
      ?.sort((a, b) => a.start - b.start)
      .map(sub => ({
        ...sub,
        start: sub.start - start,
        end: sub.end - start,
      })) || []

  // Generate peptides from the coding sequence
  return convertCodingSequenceToPeptides({
    cds,
    sequence: sequence.seq,
    codonTable: generateCodonTable(defaultCodonTable),
  })
}
