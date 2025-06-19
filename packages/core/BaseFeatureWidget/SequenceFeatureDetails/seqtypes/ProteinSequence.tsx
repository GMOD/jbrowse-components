import { observer } from 'mobx-react'

import { proteinColor, splitString } from '../util'
import SequenceDisplay from './SequenceDisplay'
import { convertCodingSequenceToPeptides } from './convertCodingSequenceToPeptides'

import type { Feat } from '../../util'
import type { SequenceFeatureDetailsModel } from '../model'

const ProteinSequence = observer(function ({
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
