import { observer } from 'mobx-react'

import LDLabelZone from './LDLabelZone.tsx'
import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition.tsx'

import type { LDDisplayModel } from '../model.ts'

// The band above the triangle, in whichever form the loaded matrix calls for:
// genomic-positions mode already draws each column at its own genomic x, so
// there is nothing to connect and the zone holds only the labels; index mode
// draws the connector lines, with the labels riding along inside them. Read
// off what loaded, not the config slot, which is a request.
const LDColumnZone = observer(function LDColumnZone({
  model,
}: {
  model: LDDisplayModel
}) {
  return model.effectiveUseGenomicPositions ? (
    <LDLabelZone model={model} />
  ) : (
    <LinesConnectingMatrixToGenomicPosition model={model} />
  )
})

export default LDColumnZone
