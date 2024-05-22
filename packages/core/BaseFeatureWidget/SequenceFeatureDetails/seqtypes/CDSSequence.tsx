import React from 'react'
import { observer } from 'mobx-react'

// locals
import { cdsColor, splitString } from '../util'
import { Feat, stitch } from '../../util'
import { SequenceFeatureDetailsModel } from '../model'
import SequenceDisplay from './SequenceDisplay'

const CDSSequence = observer(function ({
  cds,
  sequence,
  model,
}: {
  cds: Feat[]
  sequence: string
  model: SequenceFeatureDetailsModel
}) {
  const { width } = model
  const { segments } = splitString(stitch(cds, sequence), width, 0)
  return (
    <SequenceDisplay
      model={model}
      color={cdsColor}
      chunks={segments}
      start={0}
    />
  )
})

export default CDSSequence
