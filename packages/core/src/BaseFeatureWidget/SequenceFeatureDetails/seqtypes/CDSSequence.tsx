import { observer } from 'mobx-react'

import { stitch } from '../../../util/seqUtils.ts'
import { cdsColor } from '../consts.ts'
import PlainSequence from './PlainSequence.tsx'

import type { SequenceFeatureDetailsModel } from '../model.ts'
import type { Feat } from '../types.ts'

const CDSSequence = observer(function CDSSequence({
  cds,
  sequence,
  model,
}: {
  cds: Feat[]
  sequence: string
  model: SequenceFeatureDetailsModel
}) {
  return (
    <PlainSequence model={model} color={cdsColor} str={stitch(cds, sequence)} />
  )
})

export default CDSSequence
