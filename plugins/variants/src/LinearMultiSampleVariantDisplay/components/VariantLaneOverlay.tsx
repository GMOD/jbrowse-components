import { OverlayCanvas } from '@jbrowse/render-core'
import { observer } from 'mobx-react'

import { drawVariantLane } from './drawVariantLane.ts'

import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'

/**
 * The variant lane, drawn in the band above the genotype rows.
 *
 * Its own canvas rather than a strip of the genotype one: the rows scroll and
 * the lane does not, and the row canvas is sized to `availableHeight` precisely
 * so the two are separate scroll surfaces. Sitting outside the offset container
 * that holds the rows is what puts it in the band `topBands` reserved.
 *
 * Every observable the draw needs is read here in the render body
 * (`variantLaneRegions`, `renderBlocks`, `topBands`) rather than inside the
 * closure, because `OverlayCanvas` calls `draw` from an effect where nothing is
 * tracked — the same rule `VariantInsertionGlyphOverlay` follows, and what makes
 * a refetch, a pan or a band resize repaint.
 */
const VariantLaneOverlay = observer(function VariantLaneOverlay({
  model,
}: {
  model: LinearMultiSampleVariantDisplayModel
}) {
  const { variantLaneRegions, renderBlocks, topBands, canvasWidthPx } = model
  const { laneHeight } = topBands
  return variantLaneRegions ? (
    <div style={{ position: 'absolute', top: 0, left: 0 }}>
      <OverlayCanvas
        // `canvasWidthPx` for the same reason the glyph overlay uses it: it is
        // the width the blocks were mapped into, and it is the scissor bound
        // inside the draw below.
        width={canvasWidthPx}
        height={laneHeight}
        draw={ctx => {
          drawVariantLane(ctx, variantLaneRegions, renderBlocks, {
            canvasWidth: canvasWidthPx,
            laneHeight,
          })
        }}
      />
    </div>
  ) : null
})

export default VariantLaneOverlay
