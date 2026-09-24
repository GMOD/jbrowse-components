import { observer } from 'mobx-react'

import { ConnectorLineOverlay } from '../../shared/ConnectorLines.tsx'

import type {
  ConnectorCoord,
  ConnectorLinesModel,
} from '../../shared/ConnectorLines.tsx'
import type { PaintLayerOpts } from '@jbrowse/core/util/paintLayer'

// The matrix adds the crosshair column to what the shared overlay needs, so the
// SVG-export path can declare it too rather than restating the fields.
export interface MatrixConnectorLinesModel extends ConnectorLinesModel {
  connectorLineAtScreenX: (screenX: number) => ConnectorCoord | undefined
}

const LinesConnectingMatrixToGenomicPosition = observer(
  function LinesConnectingMatrixToGenomicPosition({
    model,
    exportSVG,
    opts,
    crosshairX,
  }: {
    model: MatrixConnectorLinesModel
    exportSVG?: boolean
    opts?: PaintLayerOpts
    crosshairX?: number
  }) {
    return (
      <ConnectorLineOverlay
        model={model}
        strokeWidth={0.5}
        highlight={
          crosshairX === undefined
            ? undefined
            : model.connectorLineAtScreenX(crosshairX)
        }
        exportSVG={exportSVG}
        opts={opts}
      />
    )
  },
)

export default LinesConnectingMatrixToGenomicPosition
