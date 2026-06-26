import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import TrackBandCanvas from './TrackBandCanvas.tsx'
import { drawConservation } from './drawConservation.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * Conservation (percent identity) band, stacked directly below the coverage
 * band at `top: coverageDisplayHeight`, between the coverage band and the
 * per-sample rows.
 */
const MafConservationCanvas = observer(function MafConservationCanvas({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const theme = useTheme()
  const { showConservation, conservationHeight, coverageDisplayHeight } = model
  return (
    <TrackBandCanvas
      model={model}
      top={coverageDisplayHeight}
      height={conservationHeight}
      show={showConservation}
      draw={ctx => {
        drawConservation(ctx, model.renderBlocks, model.rpcDataMap, {
          conservationHeight,
          canvasWidth: model.lgv.width,
          theme,
        })
      }}
    />
  )
})

export default MafConservationCanvas
