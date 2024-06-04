import React from 'react'
import { observer } from 'mobx-react'

// locals
import { Feat, stitch } from '../../util'
import { proteinColor, splitString } from '../util'
import { SequenceFeatureDetailsModel } from '../model'
import SequenceDisplay from './SequenceDisplay'

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
  const { width, showCoordinates } = model
  const str = stitch(cds, sequence)
  let protein = ''
  for (let i = 0; i < str.length; i += 3) {
    // use & symbol for undefined codon, or partial slice
    protein += codonTable[str.slice(i, i + 3)] || '&'
  }
  const { segments } = splitString({
    str: protein,
    width,
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
