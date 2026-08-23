import { setAbgrFill } from '@jbrowse/core/util/colorBits'
import {
  forEachClippedBlock,
  makeBpMapper,
  spanLeft,
} from '@jbrowse/render-core/canvas2dUtils'

import { drawnFeatureContext, forEachDrawnFeature } from './featurePainting.ts'
import { MULTI_ROW_MIN_CELL_PX, rowBand } from './rowBand.ts'

import type {
  MultiRowRegionData,
  MultiRowRenderState,
} from './multiRowRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// Canvas2D fallback for the multi-row painter. Draws one filled rect per feature
// at [start,end) on its row; mirrors the GPU shader's geometry (row inset by
// rowProportion, minimum 1px width). Shared with SVG export.
export function drawMultiRowBlocks(
  ctx: Ctx2D,
  regions: { get(key: number): MultiRowRegionData | undefined },
  renderBlocks: RenderBlock[],
  state: MultiRowRenderState,
) {
  const { canvasWidth, canvasHeight, rowHeight, rowProportion } = state
  const { height: h, offset } = rowBand(rowHeight, rowProportion)

  forEachClippedBlock(
    ctx,
    renderBlocks,
    canvasWidth,
    canvasHeight,
    block => regions.get(block.displayedRegionIndex),
    (regionData, renderBlock) => {
      const bpToPx = makeBpMapper(renderBlock)
      const { featureStarts, featureEnds } = regionData
      // Tracked so a run of same-colored blocks — which is most of a painting —
      // costs one `rgba()` string and one fillStyle write rather than one per
      // feature. Same trick the manhattan and modification painters use.
      let lastColor: number | undefined
      forEachDrawnFeature(
        regionData,
        drawnFeatureContext(regionData, state),
        (i, rowIndex, color) => {
          const xa = bpToPx(featureStarts[i]!)
          const xb = bpToPx(featureEnds[i]!)
          // rowRect.slang's own floor, the horizontal twin of the row floor
          // `rowBand` applies — a cell this narrow reads as a smudge or misses
          // every pixel center entirely, so it is widened rather than dropped.
          const width = Math.max(MULTI_ROW_MIN_CELL_PX, Math.abs(xb - xa))
          if (color !== lastColor) {
            lastColor = color
            setAbgrFill(ctx, color)
          }
          ctx.fillRect(
            spanLeft(xa, xb, width),
            offset + rowHeight * rowIndex,
            width,
            h,
          )
        },
      )
    },
  )
}
