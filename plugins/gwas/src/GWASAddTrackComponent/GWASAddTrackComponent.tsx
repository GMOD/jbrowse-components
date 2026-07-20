import { useEffect } from 'react'

import { isAlive } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import ScoreColumnFields from '../GWASAdapter/ScoreColumnFields.tsx'
import {
  DEFAULT_SCORE_COLUMN,
  DEFAULT_SCORE_TRANSFORM,
  scoreAdapterFields,
} from '../GWASAdapter/configSchema.ts'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

interface GWASAddTrackComponentProps {
  model: IAnyStateTreeNode & {
    mixinData: { adapter?: { scoreColumn?: string; scoreTransform?: string } }
    setMixinData: (data: Record<string, unknown>) => void
  }
}

// The defaults live in the GWASAdapter schema, so accepting them still produces
// a working track; mixinData is only written once the user actually edits a
// field. It's retracted on unmount so switching to a non-GWAS adapter isn't
// left with a stale scoreColumn/scoreTransform.
const GWASAddTrackComponent = observer(function ({
  model,
}: GWASAddTrackComponentProps) {
  useEffect(() => {
    return () => {
      if (isAlive(model)) {
        model.setMixinData({})
      }
    }
  }, [model])

  const { adapter } = model.mixinData
  const scoreColumn = adapter?.scoreColumn ?? DEFAULT_SCORE_COLUMN
  const scoreTransform = adapter?.scoreTransform ?? DEFAULT_SCORE_TRANSFORM

  // Both fields live in one adapter object, so each edit rewrites the pair to
  // avoid dropping the other; fields at their schema default are omitted so
  // accepting the defaults writes no config noise.
  function update(next: { scoreColumn: string; scoreTransform: string }) {
    model.setMixinData({ adapter: scoreAdapterFields(next) })
  }

  return (
    <ScoreColumnFields
      scoreColumn={scoreColumn}
      setScoreColumn={val => {
        update({ scoreColumn: val, scoreTransform })
      }}
      scoreTransform={scoreTransform}
      setScoreTransform={val => {
        update({ scoreColumn, scoreTransform: val })
      }}
    />
  )
})

export default GWASAddTrackComponent
