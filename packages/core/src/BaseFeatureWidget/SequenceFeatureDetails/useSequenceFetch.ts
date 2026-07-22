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
  const { sequence, error } = useFeatureSequence({
    assemblyName,
    session,
    start: feature.start,
    end: feature.end,
    refName: feature.refName,
    upDownBp,
    forceLoad,
  })
  // assembly-configured translation table for the feature's contig (e.g. a
  // mitochondrial contig = 2); the protein panel uses it as the fallback when
  // the feature itself carries no transl_table attribute
  const assembly = assemblyName
    ? session.assemblyManager.get(assemblyName)
    : undefined
  return {
    sequence,
    error,
    assemblyGeneticCodeId: assembly?.getGeneticCodeId(feature.refName),
    onForceLoad: () => {
      setForceLoad(true)
    },
  }
}
