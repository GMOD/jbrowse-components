import { useEffect, useRef } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { getPreparedCanvas2D } from '@jbrowse/render-core/canvas2dUtils'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import {
  ROW_IDENTITY_HEATMAP_ALPHA,
  drawRowIdentityHeatmap,
} from './drawRowIdentity.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * Per-row identity heatmap overlay, positioned over the GPU base canvas in the
 * rows area (its parent div is already offset to `rowsTopOffset`). Mirrors
 * `MafConservationCanvas`: an `autorun` inside the effect tracks the observable
 * `rpcDataMap`/`renderBlocks` so map mutations redraw without `useEffect` deps.
 * Drawn before the label/insertion/deletion overlays so those stay on top.
 */
const MafRowIdentityCanvas = observer(function MafRowIdentityCanvas({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { width } = view
  const { showRowIdentityHeatmap, rowsHeight, rowHeight, rowProportion } = model

  useEffect(() => {
    return autorun(() => {
      const ctx = getPreparedCanvas2D(canvasRef.current, width, rowsHeight)
      const nRows = model.sources?.length ?? 0
      if (ctx && showRowIdentityHeatmap && nRows > 0) {
        drawRowIdentityHeatmap(ctx, model.renderBlocks, model.rpcDataMap, {
          rowHeight,
          rowProportion,
          nRows,
          canvasWidth: width,
          alpha: ROW_IDENTITY_HEATMAP_ALPHA,
        })
      }
    })
  }, [model, width, rowsHeight, rowHeight, rowProportion, showRowIdentityHeatmap])

  return showRowIdentityHeatmap ? (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height: rowsHeight,
        pointerEvents: 'none',
      }}
    />
  ) : null
})

export default MafRowIdentityCanvas
