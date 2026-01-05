import { observer } from 'mobx-react'

import { convertCodingSequenceToPeptides } from '../../../util/convertCodingSequenceToPeptides'
import { proteinColor } from '../consts'
import { splitString } from '../util'
import SequenceDisplay from './SequenceDisplay'

import type { Feat } from '../../util'
import type { SequenceFeatureDetailsModel } from '../model'

const ProteinSequence = observer(function ProteinSequence({
  cds,
  sequence,
  codonTable,
  model,
}: {
  cds: Feat[]
  sequence: string
  codonTable: Record<string, string>
  model: SequenceFeatureDetailsModel
}) {
  const { charactersPerRow, showCoordinates } = model
  const str = convertCodingSequenceToPeptides({
    cds,
    sequence,
    codonTable,
  })
  const { segments } = splitString({
    str,
    charactersPerRow,
    showCoordinates,
  })
  return (
    <SequenceDisplay
      model={model}
      color={proteinColor}
      chunks={segments}
      start={0}
    />
  )
})

export default ProteinSequence
