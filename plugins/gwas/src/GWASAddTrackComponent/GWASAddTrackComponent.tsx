import { useEffect } from 'react'

import { isAlive } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import ScoreColumnFields from '../GWASAdapter/ScoreColumnFields.tsx'
import {
  DEFAULT_SCORE_COLUMN,
  DEFAULT_SCORE_TRANSFORM,
  scoreAdapterFields,
} from '../GWASAdapter/configSchema.ts'

import type { AddTrackComponentProps } from '@jbrowse/core/util'

interface ScoreAdapterFields {
  scoreColumn?: string
  scoreTransform?: string
}

// this component owns mixinData's `adapter` key
function readScoreFields(mixinData: Record<string, unknown>) {
  const { adapter } = mixinData
  return (
    typeof adapter === 'object' && adapter !== null ? adapter : {}
  ) as ScoreAdapterFields
}

const GWASAddTrackComponent = observer(function ({
  model,
}: AddTrackComponentProps) {
  // a switch to another adapter type must not carry these fields over
  useEffect(() => {
    return () => {
      if (isAlive(model)) {
        model.setMixinData({})
      }
    }
  }, [model])

  const adapter = readScoreFields(model.mixinData)
  const scoreColumn = adapter.scoreColumn ?? DEFAULT_SCORE_COLUMN
  const scoreTransform = adapter.scoreTransform ?? DEFAULT_SCORE_TRANSFORM

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
