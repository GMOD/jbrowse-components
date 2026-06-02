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
  const { sequence, error } = useFeatureSequence({
    assemblyName: model.view?.assemblyNames?.[0],
    session: getSession(model),
    start: feature.start,
    end: feature.end,
    refName: feature.refName,
    upDownBp,
    forceLoad,
  })
  return {
    sequence,
    error,
    onForceLoad: () => {
      setForceLoad(true)
    },
  }
}
