import { useState } from 'react'

import { useFeatureSequence } from '../../util/useFeatureSequence.ts'

import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '../../util/index.ts'

// shared between the inline panel and the "open in dialog" view: fetches the
// feature sequence and exposes a force-load trigger for over-limit regions
export function useSequenceFetch({
  session,
  assemblyName,
  feature,
  upDownBp,
}: {
  session: AbstractSessionModel
  assemblyName: string | undefined
  feature: SimpleFeatureSerialized
  upDownBp: number
}) {
  const [forceLoad, setForceLoad] = useState(false)
  const assembly = assemblyName
    ? session.assemblyManager.get(assemblyName)
    : undefined
  const sequenceLength = assembly?.getRegionForRefName(
    assembly.getCanonicalRefName2(feature.refName),
  )?.end
  // only an adapter that knows the sequence is circular writes an end past it
  const { sequence, error, status } = useFeatureSequence({
    assemblyName,
    session,
    start: feature.start,
    end: feature.end,
    refName: feature.refName,
    upDownBp,
    forceLoad,
    circularLength:
      sequenceLength !== undefined && feature.end > sequenceLength
        ? sequenceLength
        : undefined,
  })
  // assembly-configured translation table for the feature's contig (e.g. a
  // mitochondrial contig = 2); the protein panel uses it as the fallback when
  // the feature itself carries no transl_table attribute
  return {
    sequence,
    error,
    status,
    assemblyGeneticCodeId: assembly?.getGeneticCodeId(feature.refName),
    onForceLoad: () => {
      setForceLoad(true)
    },
  }
}
