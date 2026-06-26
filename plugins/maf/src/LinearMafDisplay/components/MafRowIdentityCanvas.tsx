import { observer } from 'mobx-react'

import TrackBandCanvas from './TrackBandCanvas.tsx'
import { drawRowIdentity } from './drawRowIdentity.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * Per-row identity rendering over the (cleared) GPU base canvas in the rows
 * area — when `activeRowRendering` is an identity style the base canvas paints
 * nothing, so this replaces it rather than overlaying SNP marks. Its parent div
 * is already offset to `rowsTopOffset`.
 */
const MafRowIdentityCanvas = observer(function MafRowIdentityCanvas({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const { activeRowRendering, rowsHeight, rowHeight, rowProportion } = model
  return (
    <TrackBandCanvas
      model={model}
      top={0}
      height={rowsHeight}
      show={activeRowRendering !== 'bases'}
      draw={ctx => {
        const nRows = model.sources?.length ?? 0
        if (activeRowRendering !== 'bases' && nRows > 0) {
          drawRowIdentity(ctx, model.renderBlocks, model.rpcDataMap, {
            rowHeight,
            rowProportion,
            nRows,
            canvasWidth: model.lgv.width,
            mode: activeRowRendering,
          })
        }
      }}
    />
  )
})

export default MafRowIdentityCanvas
