import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { ConnectorLineOverlay } from '../../shared/ConnectorLines.tsx'
import VariantLabels from './VariantLabels.tsx'

import type { SharedLDModel } from '../shared.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const LinesConnectingMatrixToGenomicPosition = observer(
  function LinesConnectingMatrixToGenomicPosition({
    model,
    exportSVG,
  }: {
    model: SharedLDModel
    exportSVG?: boolean
  }) {
    const { lineZoneHeight, height, connectorLineCoords } = model
    const { width } = getContainingView(model) as LinearGenomeViewModel

    return (
      <ConnectorLineOverlay
        lineCoords={connectorLineCoords}
        lineZoneHeight={lineZoneHeight}
        height={height}
        width={width}
        strokeWidth={1}
        exportSVG={exportSVG}
        onResize={d => {
          model.setLineZoneHeight(lineZoneHeight + d)
        }}
      >
        <VariantLabels model={model} />
      </ConnectorLineOverlay>
    )
  },
)

export default LinesConnectingMatrixToGenomicPosition
