import { observer } from 'mobx-react'

import { ConnectorLineOverlay } from '../../shared/ConnectorLines.tsx'
import { LD_CONNECTOR_STROKE_PX } from '../../shared/constants.ts'
import VariantLabels from './VariantLabels.tsx'

import type { LDDisplayModel } from '../model.ts'

const LinesConnectingMatrixToGenomicPosition = observer(
  function LinesConnectingMatrixToGenomicPosition({
    model,
  }: {
    model: LDDisplayModel
  }) {
    return (
      <ConnectorLineOverlay model={model} strokeWidth={LD_CONNECTOR_STROKE_PX}>
        <VariantLabels model={model} />
      </ConnectorLineOverlay>
    )
  },
)

export default LinesConnectingMatrixToGenomicPosition
