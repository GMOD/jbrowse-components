import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import TrackBandCanvas from './TrackBandCanvas.tsx'
import { drawMafCoverage } from './drawMafCoverage.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * Coverage band at the top of the MAF display, delegating to the shared
 * `drawMafCoverage` per-block loop (alignments-core `drawCoverageBins` +
 * `drawSnpSegments`). The worker pre-packs both buffers in the layout alignments
 * uses, so this does no per-frame data massaging.
 */
const MafCoverageCanvas = observer(function MafCoverageCanvas({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const theme = useTheme()
  const { showCoverage, coverageHeight } = model
  return (
    <TrackBandCanvas
      model={model}
      top={0}
      height={coverageHeight}
      show={showCoverage}
      draw={ctx => {
        drawMafCoverage(ctx, model.renderBlocks, model.rpcDataMap, {
          coverageHeight,
          canvasWidth: model.lgv.width,
          domainMax: model.coverageDomain?.[1] ?? 0,
          theme,
        })
      }}
    />
  )
})

export default MafCoverageCanvas
