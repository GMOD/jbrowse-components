import { useEffect, useRef } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { getPreparedCanvas2D } from '@jbrowse/render-core/canvas2dUtils'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { drawRowIdentity } from './drawRowIdentity.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * Per-row identity rendering, positioned over the (cleared) GPU base canvas in
 * the rows area — when `activeRowRendering` is an identity style the base canvas
 * paints nothing, so this replaces it rather than overlaying SNP marks. Its
 * parent div is already offset to `rowsTopOffset`. Mirrors `MafConservationCanvas`:
 * an `autorun` inside the effect tracks the observable `rpcDataMap`/`renderBlocks`
 * so map mutations redraw without `useEffect` deps.
 */
const MafRowIdentityCanvas = observer(function MafRowIdentityCanvas({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { width } = view
  const { activeRowRendering, rowsHeight, rowHeight, rowProportion } = model

  useEffect(() => {
    return autorun(() => {
      const ctx = getPreparedCanvas2D(canvasRef.current, width, rowsHeight)
      const mode = model.activeRowRendering
      const nRows = model.sources?.length ?? 0
      if (ctx && mode !== 'bases' && nRows > 0) {
        drawRowIdentity(ctx, model.renderBlocks, model.rpcDataMap, {
          rowHeight,
          rowProportion,
          nRows,
          canvasWidth: width,
          mode,
        })
      }
    })
  }, [model, width, rowsHeight, rowHeight, rowProportion, activeRowRendering])

  return activeRowRendering !== 'bases' ? (
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
