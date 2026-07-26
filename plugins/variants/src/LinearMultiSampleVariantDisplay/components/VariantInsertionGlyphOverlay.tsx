import { getContainingView } from '@jbrowse/core/util'
import { OverlayCanvas } from '@jbrowse/render-core'
import { observer } from 'mobx-react'

import { drawVariantInsertionGlyphs } from './drawVariantInsertionGlyphs.ts'

import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
    const view = getContainingView(model) as LinearGenomeViewModel
    const { insertionGlyphRegions, renderBlocks, renderState } = model
    return insertionGlyphRegions ? (
      <OverlayCanvas
        width={view.trackWidthPx}
        height={model.availableHeight}
        draw={ctx => {
          drawVariantInsertionGlyphs(
            ctx,
            insertionGlyphRegions,
            renderBlocks,
            renderState,
          )
        }}
      />
    ) : null
  },
)

export default VariantInsertionGlyphOverlay
