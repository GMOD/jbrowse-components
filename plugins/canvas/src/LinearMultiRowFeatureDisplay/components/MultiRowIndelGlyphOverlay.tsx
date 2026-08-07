import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { OverlayCanvas } from '@jbrowse/render-core'
import { observer } from 'mobx-react'

import { drawMultiRowIndelGlyphs } from '../rendering/drawMultiRowIndelGlyphs.ts'

import type { LinearMultiRowFeatureDisplayModel } from '../model.ts'

/**
 * Alignment-style indel glyphs composited over the blocks, on whichever backend
 * drew them. Every observable the draw needs is read here in the render body
 * (`indelGlyphRegions`, `renderBlocks`, `renderState`) rather than inside the
 * closure, because `OverlayCanvas` calls `draw` from an effect where nothing is
 * tracked — so those reads are what make a refetch or a row reorder repaint.
 */
const MultiRowIndelGlyphOverlay = observer(function MultiRowIndelGlyphOverlay({
  model,
}: {
  model: LinearMultiRowFeatureDisplayModel
}) {
  const palette = usePalette()
  // canvasWidthPx, the same box renderState was mapped into — see the note in
  // LinearMultiRowFeatureDisplayComponent
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
