import { observer } from 'mobx-react'

import {
  ConnectorZone,
  ConnectorZoneResizeHandle,
} from '../../shared/ConnectorLines.tsx'
import VariantLabels from './VariantLabels.tsx'

import type { LDDisplayModel } from '../model.ts'

// Genomic-positions mode: the triangle already sits at each SNP's genomic x, so
// there is nothing to connect and the zone holds only the labels. The handle
// comes along so the room they need is draggable — `matrixTop`
// reserves `lineZoneHeight` for them rather than measuring the rotated text.
const LDLabelZone = observer(function LDLabelZone({
  model,
}: {
  model: LDDisplayModel
}) {
  const { height, showLabels, matrixTop } = model
  const { width } = model.host

  return (
    <>
      <ConnectorZone width={width} height={height}>
        <VariantLabels model={model} />
      </ConnectorZone>
      {!showLabels ? null : (
        <ConnectorZoneResizeHandle model={model} top={matrixTop} />
      )}
    </>
  )
})

export default LDLabelZone
