import { observer } from 'mobx-react'

import { stitch } from '../../../util/seqUtils.ts'
import { cdsColor } from '../consts.ts'
import { coordLabelWidth, splitString } from '../util.ts'
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
  const str = stitch(cds, sequence)
  const { segments } = splitString({ str, charactersPerRow, showCoordinates })
  return (
    <SequenceDisplay
      model={model}
      color={cdsColor}
      chunks={segments}
      coordStart={0}
      labelWidth={coordLabelWidth({
        firstCoord: 0,
        totalLength: str.length,
        charactersPerRow,
        strand: 1,
      })}
    />
  )
})

export default CDSSequence
