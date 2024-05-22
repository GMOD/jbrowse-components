import React from 'react'
import { observer } from 'mobx-react'

// locals
import { Feat, stitch } from '../../util'
import { proteinColor } from '../util'
import SequenceDisplay, { splitString } from './util'
import { SequenceFeatureDetailsModel } from '../model'

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
  const { width } = model
  const str = stitch(cds, sequence)
  let protein = ''
  for (let i = 0; i < str.length; i += 3) {
    // use & symbol for undefined codon, or partial slice
    protein += codonTable[str.slice(i, i + 3)] || '&'
  }
  const { segments } = splitString(protein, width, 0)
  return (
    <pre>
      <SequenceDisplay
        model={model}
        color={proteinColor}
        chunks={segments}
        start={0}
      />
    </pre>
  )
})

export default ProteinSequence
