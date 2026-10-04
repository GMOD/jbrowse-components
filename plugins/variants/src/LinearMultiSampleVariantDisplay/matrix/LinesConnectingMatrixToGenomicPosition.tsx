import { observer } from 'mobx-react'

import { ConnectorLineOverlay } from '../../shared/ConnectorLines.tsx'
import { MATRIX_CONNECTOR_STROKE_PX } from '../../shared/constants.ts'

import type {
  ConnectorCoord,
  ConnectorLinesModel,
} from '../../shared/ConnectorLines.tsx'

// The matrix adds the crosshair column to what the shared overlay needs.
export interface MatrixConnectorLinesModel extends ConnectorLinesModel {
  connectorLineAtScreenX: (screenX: number) => ConnectorCoord | undefined
}

const LinesConnectingMatrixToGenomicPosition = observer(
  function LinesConnectingMatrixToGenomicPosition({
    model,
    crosshairX,
  }: {
    model: MatrixConnectorLinesModel
    crosshairX?: number
  }) {
    return (
      <ConnectorLineOverlay
        model={model}
        strokeWidth={MATRIX_CONNECTOR_STROKE_PX}
        highlight={
          crosshairX === undefined
            ? undefined
            : model.connectorLineAtScreenX(crosshairX)
        }
      />
    )
  },
)

export default LinesConnectingMatrixToGenomicPosition
