import { observer } from 'mobx-react'

import {
  ConnectorZone,
  ConnectorZoneResizeHandle,
} from '../../shared/ConnectorLines.tsx'
import VariantLabels from './VariantLabels.tsx'

import type { SharedLDModel } from '../shared.ts'

// Genomic-positions mode: the triangle already sits at each SNP's genomic x, so
// there is nothing to connect and the zone holds only the labels. The handle
// comes along so the room they need is draggable — `effectiveLineZoneHeight`
// reserves `lineZoneHeight` for them rather than measuring the rotated text.
const LDLabelZone = observer(function LDLabelZone({
  model,
  exportSVG,
}: {
  model: SharedLDModel
  exportSVG?: boolean
}) {
  const { height, showLabels, effectiveLineZoneHeight } = model
  const { width } = model.host

  return (
    <>
      <ConnectorZone exportSVG={exportSVG} width={width} height={height}>
        <VariantLabels model={model} />
      </ConnectorZone>
      {exportSVG || !showLabels ? null : (
        <ConnectorZoneResizeHandle
          model={model}
          top={effectiveLineZoneHeight}
        />
      )}
    </>
  )
})

export default LDLabelZone
