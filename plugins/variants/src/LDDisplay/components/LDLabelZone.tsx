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
// reserves `connectorsHeight` for them rather than measuring the rotated text.
const LDLabelZone = observer(function LDLabelZone({
  model,
}: {
  model: LDDisplayModel
}) {
  const { height, connectorsHeight, matrixTop } = model
  const { width } = model.host

  return (
    <>
      <ConnectorZone width={width} height={height}>
        <VariantLabels model={model} />
      </ConnectorZone>
      {connectorsHeight > 0 ? (
        <ConnectorZoneResizeHandle model={model} top={matrixTop} />
      ) : null}
    </>
  )
})

export default LDLabelZone
