import { observer } from 'mobx-react'

import { ConnectorLineOverlay } from '../../shared/ConnectorLines.tsx'
import VariantLabels from './VariantLabels.tsx'

import type { SharedLDModel } from '../shared.ts'

const LinesConnectingMatrixToGenomicPosition = observer(
  function LinesConnectingMatrixToGenomicPosition({
    model,
    exportSVG,
  }: {
    model: SharedLDModel
    exportSVG?: boolean
  }) {
    return (
      <ConnectorLineOverlay model={model} strokeWidth={1} exportSVG={exportSVG}>
        <VariantLabels model={model} />
      </ConnectorLineOverlay>
    )
  },
)

export default LinesConnectingMatrixToGenomicPosition
