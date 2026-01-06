import { observer } from 'mobx-react'

import { stitch } from '../../util.tsx'
import { cdsColor } from '../consts.ts'
import { splitString } from '../util.ts'
import SequenceDisplay from './SequenceDisplay.tsx'

import type { Feat } from '../../util.tsx'
import type { SequenceFeatureDetailsModel } from '../model.ts'

const CDSSequence = observer(function CDSSequence({
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
