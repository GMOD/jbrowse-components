import { observer } from 'mobx-react'

import TrackBandCanvas from './TrackBandCanvas.tsx'
import { drawSourceChrom } from './drawSourceChrom.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * Color-by-source-chromosome rendering over the (cleared) GPU base canvas in the
 * rows area — when `activeRowRendering` is `sourceChrom` the base canvas paints
 * nothing, so this replaces it. Its parent div is already offset to
 * `rowsTopOffset`.
 */
const MafSourceChromCanvas = observer(function MafSourceChromCanvas({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const { activeRowRendering, rowsHeight, rowHeight, rowProportion } = model
  const show = activeRowRendering === 'sourceChrom'
  return (
    <TrackBandCanvas
      model={model}
      top={0}
      height={rowsHeight}
      show={show}
      draw={ctx => {
        const nRows = model.sources?.length ?? 0
        if (show && nRows > 0) {
          drawSourceChrom(ctx, model.renderBlocks, model.rpcDataMap, {
            rowHeight,
            rowProportion,
            nRows,
            canvasWidth: model.lgv.width,
          })
        }
      }}
    />
  )
})

export default MafSourceChromCanvas
