import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { observer } from 'mobx-react'

import { drawVariantInsertionGlyphs } from './drawVariantInsertionGlyphs.ts'

import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'

/**
 * Insertion markers composited over the genotype canvas, on whichever backend
 * drew it. Every observable the draw needs is read here in the render body
 * (`insertionGlyphRegions`, `renderBlocks`, `renderState`) rather than inside the
 * closure, because `OverlayCanvas` calls `draw` from an effect where nothing is
 * tracked, so these reads are what make a refetch, a scroll, or a row resize
 * repaint.
 */
const VariantInsertionGlyphOverlay = observer(
  function VariantInsertionGlyphOverlay({
    model,
  }: {
    model: LinearMultiSampleVariantDisplayModel
  }) {
    const palette = usePalette()
    const { insertionGlyphRegions, renderBlocks, renderState, canvasWidthPx } =
      model
    return insertionGlyphRegions ? (
      <OverlayCanvas
        // `canvasWidthPx`, not a second `view.trackWidthPx` read: this is the
        // width `renderState.canvasWidth` carries, and that value is the block
        // scissor bound inside the draw below — so a divergence would clip the
        // glyphs against a box the overlay isn't the size of.
        width={canvasWidthPx}
        height={model.availableHeight}
        draw={ctx => {
          drawVariantInsertionGlyphs(
            ctx,
            insertionGlyphRegions,
            renderBlocks,
            renderState,
            palette.insertion,
          )
        }}
      />
    ) : null
  },
)

export default VariantInsertionGlyphOverlay
