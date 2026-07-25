import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { ConnectorLineOverlay } from '../../shared/ConnectorLines.tsx'

import type { ConnectorCoord } from '../../shared/ConnectorLines.tsx'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// What the connector lines need off the matrix display, so the SVG-export path
// can declare it too rather than restating the fields.
export interface ConnectorLinesModel {
  setLineZoneHeight: (arg: number) => void
  height: number
  lineZoneHeight: number
  connectorLineCoords: ConnectorCoord[]
  connectorLineAtScreenX: (screenX: number) => ConnectorCoord | undefined
}

const LinesConnectingMatrixToGenomicPosition = observer(
  function LinesConnectingMatrixToGenomicPosition({
    model,
    exportSVG,
    crosshairX,
  }: {
    model: ConnectorLinesModel
    exportSVG?: boolean
    crosshairX?: number
  }) {
    const { lineZoneHeight, height, connectorLineCoords } = model
    const { width } = getContainingView(model) as LinearGenomeViewModel

    return (
      <ConnectorLineOverlay
        lineCoords={connectorLineCoords}
        lineZoneHeight={lineZoneHeight}
        height={height}
        width={width}
        strokeWidth={0.5}
        highlight={
          crosshairX === undefined
            ? undefined
            : model.connectorLineAtScreenX(crosshairX)
        }
        exportSVG={exportSVG}
        onResize={d => {
          model.setLineZoneHeight(lineZoneHeight + d)
        }}
      />
    )
  },
)

export default LinesConnectingMatrixToGenomicPosition
