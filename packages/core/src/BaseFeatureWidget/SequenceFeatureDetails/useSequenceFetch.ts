import { useState } from 'react'

import { getSession } from '../../util/index.ts'
import { useFeatureSequence } from '../../util/useFeatureSequence.ts'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { BaseFeatureWidgetModel } from '../stateModelFactory.ts'

// shared between the inline panel and the "open in dialog" view: fetches the
// feature sequence and exposes a force-load trigger for over-limit regions
export function useSequenceFetch({
  model,
  feature,
  upDownBp,
}: {
  model: BaseFeatureWidgetModel
  feature: SimpleFeatureSerialized
  upDownBp: number
}) {
  const [forceLoad, setForceLoad] = useState(false)
  const session = getSession(model)
  const assemblyName = model.view?.assemblyNames?.[0]
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
    assemblyName,
    assemblyGeneticCodeId: assembly?.getGeneticCodeId(feature.refName),
    onForceLoad: () => {
      setForceLoad(true)
    },
  }
}
