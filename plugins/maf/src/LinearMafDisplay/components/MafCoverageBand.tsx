import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import MafBand from './MafBand.tsx'
import { drawMafCoverage } from './drawMafCoverage.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * Depth + SNP coverage band at the top of the display, delegating to the shared
 * `drawMafCoverage` per-block loop (alignments-core `drawCoverageBins` +
 * `drawSnpSegments`). The worker pre-packs both buffers in the layout alignments
 * uses, so this does no per-frame data massaging. Its axis is data-driven
 * (`coverageTicks`) and absent until the domain resolves.
 */
const MafCoverageBand = observer(function MafCoverageBand({
  model,
  onResizeActiveChange,
}: {
  model: LinearMafDisplayModel
  onResizeActiveChange: (active: boolean) => void
}) {
  const theme = useTheme()
  const { coverageBandActive, coverageHeight, coverageTicks } = model
  return (
    <MafBand
      model={model}
      show={coverageBandActive}
      top={0}
      height={coverageHeight}
      ticks={coverageTicks}
      resize={n => {
        model.resizeCoverageHeight(n)
      }}
      onResizeActiveChange={onResizeActiveChange}
      draw={ctx => {
        drawMafCoverage(ctx, model.renderBlocks, model.rpcDataMap, {
          coverageHeight,
          canvasWidth: model.canvasWidthPx,
          domainMax: model.coverageDomain?.[1] ?? 0,
          theme,
        })
      }}
    />
  )
})

export default MafCoverageBand
