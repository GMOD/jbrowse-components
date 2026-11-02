import { observer } from 'mobx-react'

import { ConnectorLineOverlay } from '../../shared/ConnectorLines.tsx'
import { MATRIX_CONNECTOR_STROKE_PX } from '../../shared/constants.ts'

import type {
  ConnectorCoord,
  ConnectorLinesModel,
} from '../../shared/ConnectorLines.tsx'
import type { VariantTopBands } from '../variantTopBands.ts'

// The matrix adds the crosshair column to what the shared overlay needs.
interface MatrixConnectorLinesModel extends ConnectorLinesModel {
  connectorLineAtScreenX: (screenX: number) => ConnectorCoord | undefined
  topBands: Pick<VariantTopBands, 'top'>
}

const LinesConnectingMatrixToGenomicPosition = observer(
  function LinesConnectingMatrixToGenomicPosition({
    model,
    crosshairX,
  }: {
    model: MatrixConnectorLinesModel
    crosshairX?: number
  }) {
    // the zone's lines, hit test and handle all measure from its own top
    return (
      <div
        style={{
          position: 'absolute',
          top: model.topBands.top.connectors,
          left: 0,
        }}
      >
        <ConnectorLineOverlay
          model={model}
          strokeWidth={MATRIX_CONNECTOR_STROKE_PX}
          highlight={
            crosshairX === undefined
              ? undefined
              : model.connectorLineAtScreenX(crosshairX)
          }
        />
      </div>
    )
  },
)

export default LinesConnectingMatrixToGenomicPosition
