import { paintInsertionLabels } from '@jbrowse/alignments-core'
import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { observer } from 'mobx-react'

import { variantInsertionParams } from './variantMarks.ts'

import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'

/**
 * The insertion markers' counts, over whichever backend drew the markers. The
 * observables the draw needs are read in the render body, because
 * `OverlayCanvas` calls `draw` from an effect where nothing is tracked.
 */
const VariantInsertionLabels = observer(function VariantInsertionLabels({
  model,
}: {
  model: LinearMultiSampleVariantDisplayModel
}) {
  const { insertionGlyphRegions, renderBlocks, renderState, canvasWidthPx } =
    model
  return insertionGlyphRegions ? (
    <OverlayCanvas
      width={canvasWidthPx}
      height={model.availableHeight}
      draw={ctx => {
        paintInsertionLabels(
          ctx,
          renderBlocks,
          block =>
            insertionGlyphRegions.get(block.displayedRegionIndex)?.insertions,
          { ...renderState, canvasWidth: canvasWidthPx },
          variantInsertionParams(renderState),
        )
      }}
    />
  ) : null
})

export default VariantInsertionLabels
