import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { observer } from 'mobx-react'

import { drawMultiRowIndelGlyphs } from '../rendering/drawMultiRowIndelGlyphs.ts'

import type { LinearMultiRowFeatureDisplayModel } from '../model.ts'

/**
 * `OverlayCanvas` calls `draw` from an effect where nothing is tracked, so the
 * draw's observables are read here in the render body to make a refetch or a
 * row reorder repaint.
 */
const MultiRowIndelGlyphOverlay = observer(function MultiRowIndelGlyphOverlay({
  model,
}: {
  model: LinearMultiRowFeatureDisplayModel
}) {
  const {
    lengthField,
    uploadedChannels,
    renderBlocks,
    renderState,
    rowsHeight,
    canvasWidthPx,
  } = model
  return lengthField ? (
    <OverlayCanvas
      width={canvasWidthPx}
      height={rowsHeight}
      draw={ctx => {
        drawMultiRowIndelGlyphs(
          ctx,
          uploadedChannels,
          renderBlocks,
          renderState,
        )
      }}
    />
  ) : null
})

export default MultiRowIndelGlyphOverlay
