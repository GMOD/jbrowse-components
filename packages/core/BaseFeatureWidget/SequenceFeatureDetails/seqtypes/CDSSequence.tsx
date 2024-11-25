import React from 'react'
import { observer } from 'mobx-react'

// locals
import { stitch } from '../../util'
import { cdsColor, splitString } from '../util'
import SequenceDisplay from './SequenceDisplay'
import type { Feat } from '../../util'
import type { SequenceFeatureDetailsModel } from '../model'

const CDSSequence = observer(function ({
  cds,
  sequence,
  model,
}: {
  cds: Feat[]
  sequence: string
  model: SequenceFeatureDetailsModel
}) {
  const { charactersPerRow, showCoordinates } = model
  const { segments } = splitString({
    str: stitch(cds, sequence),
    charactersPerRow,
    showCoordinates,
  })
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
