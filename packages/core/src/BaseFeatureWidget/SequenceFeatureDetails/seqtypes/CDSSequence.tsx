import { observer } from 'mobx-react'

import { stitch } from '../../../util/seqUtils.ts'
import { cdsColor } from '../consts.ts'
import PlainSequence from './PlainSequence.tsx'

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
  return (
    <PlainSequence model={model} color={cdsColor} str={stitch(cds, sequence)} />
  )
})

export default CDSSequence
