import { observer } from 'mobx-react'

import { convertCodingSequenceToPeptides } from '../../../util/convertCodingSequenceToPeptides.ts'
import { proteinColor } from '../consts.ts'
import { splitString } from '../util.ts'
import SequenceDisplay from './SequenceDisplay.tsx'

import type { Feat } from '../../util.tsx'
import type { SequenceFeatureDetailsModel } from '../model.ts'

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
