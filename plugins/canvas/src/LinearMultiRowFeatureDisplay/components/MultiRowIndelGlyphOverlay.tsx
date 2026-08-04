import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { getContainingView } from '@jbrowse/core/util'
import { OverlayCanvas } from '@jbrowse/render-core'
import { observer } from 'mobx-react'

import { drawMultiRowIndelGlyphs } from '../rendering/drawMultiRowIndelGlyphs.ts'

import type { LinearMultiRowFeatureDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
  const view = getContainingView(model) as LinearGenomeViewModel
  const palette = usePalette()
  const { indelGlyphRegions, renderBlocks, renderState, height } = model
  return indelGlyphRegions ? (
    <OverlayCanvas
      width={view.trackWidthPx}
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
