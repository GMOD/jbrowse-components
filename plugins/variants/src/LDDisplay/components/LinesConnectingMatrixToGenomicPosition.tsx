import { observer } from 'mobx-react'

import { ConnectorLineOverlay } from '../../shared/ConnectorLines.tsx'
import VariantLabels from './VariantLabels.tsx'

import type { SharedLDModel } from '../shared.ts'
import type { PaintLayerOpts } from '@jbrowse/core/util/paintLayer'

const LinesConnectingMatrixToGenomicPosition = observer(
  function LinesConnectingMatrixToGenomicPosition({
    model,
    exportSVG,
    opts,
  }: {
    model: SharedLDModel
    exportSVG?: boolean
    opts?: PaintLayerOpts
  }) {
    return (
      <ConnectorLineOverlay
        model={model}
        strokeWidth={1}
        exportSVG={exportSVG}
        opts={opts}
      >
        <VariantLabels model={model} />
      </ConnectorLineOverlay>
    )
  },
)

export default LinesConnectingMatrixToGenomicPosition
