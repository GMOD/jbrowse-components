import { usePalette } from '@jbrowse/core/ui/PaletteContext'
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
  const palette = usePalette()
  const {
    indelGlyphRegions,
    renderBlocks,
    renderState,
    height,
    canvasWidthPx,
  } = model
  return indelGlyphRegions ? (
    <OverlayCanvas
      width={canvasWidthPx}
      height={height}
      draw={ctx => {
        drawMultiRowIndelGlyphs(
          ctx,
          indelGlyphRegions,
          renderBlocks,
          renderState,
          palette.insertion,
        )
      }}
    />
  ) : null
})

export default MultiRowIndelGlyphOverlay
