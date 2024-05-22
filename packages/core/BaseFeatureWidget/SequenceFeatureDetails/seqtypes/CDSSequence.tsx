import React from 'react'
import { observer } from 'mobx-react'

// locals
import { cdsColor } from '../util'
import { Feat, stitch } from '../../util'
import SequenceDisplay, { splitString } from './util'
import { SequenceFeatureDetailsModel } from '../model'

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
    <pre>
      <SequenceDisplay
        model={model}
        color={cdsColor}
        chunks={segments}
        start={0}
      />
    </pre>
  )
})

export default CDSSequence
