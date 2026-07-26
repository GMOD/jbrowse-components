import { observer } from 'mobx-react'

import TrackBandCanvas from './TrackBandCanvas.tsx'
import { drawRowIdentity } from './drawRowIdentity.ts'
import { drawSourceChrom } from './drawSourceChrom.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * The Canvas2D rows layer, for the renderings the GPU base canvas doesn't paint:
 * a per-row identity plot (`heatmap` / `xyplot`) or color-by-source-chromosome.
 * In those modes the base canvas paints nothing, so this replaces it rather than
 * overlaying it; `bases` and `codon` draw elsewhere (GPU canvas / codon overlay)
 * and this stays hidden. Its parent div is already offset to `rowsTopOffset`.
 *
 * One component for both because they differ only in the draw call — as two they
 * had already grown two spellings of the same show test and nRows read.
 */
const MafRowsCanvas = observer(function MafRowsCanvas({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const {
    activeRowRendering,
    rowsHeight,
    effectiveRowHeight,
    rowProportion,
    sources,
  } = model
  const mode =
    activeRowRendering === 'bases' || activeRowRendering === 'codon'
      ? undefined
      : activeRowRendering
  const nRows = sources?.length ?? 0
  return (
    <TrackBandCanvas
      model={model}
      top={0}
      height={rowsHeight}
      show={mode !== undefined && nRows > 0}
      draw={ctx => {
        const state = {
          rowHeight: effectiveRowHeight,
          rowProportion,
          nRows,
          canvasWidth: model.lgv.width,
        }
        if (mode === 'sourceChrom') {
          drawSourceChrom(ctx, model.renderBlocks, model.rpcDataMap, state)
        } else if (mode !== undefined) {
          drawRowIdentity(ctx, model.renderBlocks, model.rpcDataMap, {
            ...state,
            mode,
          })
        }
      }}
    />
  )
})

export default MafRowsCanvas
