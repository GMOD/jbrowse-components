import { setAbgrFill } from '@jbrowse/core/util/colorBits'
import {
  clipBlockForCanvas,
  makeBpMapper,
  spanLeft,
} from '@jbrowse/render-core/canvas2dUtils'

import {
  isFeatureColorHidden,
  resolveLocalRowIndices,
} from './resolveLocalRowIndices.ts'

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
  const {
    canvasWidth,
    canvasHeight,
    rowHeight,
    rowProportion,
    rowIndexByValue,
    rowColorsByIndex,
    hiddenColors,
  } = state
  const h = rowHeight * rowProportion
  const offset = (rowHeight - h) / 2

  for (const renderBlock of renderBlocks) {
    const regionData = regions.get(renderBlock.displayedRegionIndex)
    if (regionData) {
      const clip = clipBlockForCanvas(renderBlock, canvasWidth)
      if (clip) {
        const bpToPx = makeBpMapper(renderBlock)
        const {
          featureStarts,
          featureEnds,
          featureColors,
          partitionValues,
          featurePartitionIndex,
        } = regionData
        const rowForLocal = resolveLocalRowIndices(
          partitionValues,
          rowIndexByValue,
        )

        ctx.save()
        ctx.beginPath()
        ctx.rect(clip.scissorX, 0, clip.scissorW, canvasHeight)
        ctx.clip()

        for (let i = 0; i < featureStarts.length; i++) {
          const rowIndex = rowForLocal[featurePartitionIndex[i]!]
          if (
            rowIndex !== undefined &&
            !isFeatureColorHidden(
              rowIndex,
              featureColors[i]!,
              hiddenColors,
              rowColorsByIndex,
            )
          ) {
            const xa = bpToPx(featureStarts[i]!)
            const xb = bpToPx(featureEnds[i]!)
            const width = Math.max(1, Math.abs(xb - xa))
            const left = spanLeft(xa, xb, width)
            const top = offset + rowHeight * rowIndex
            setAbgrFill(ctx, rowColorsByIndex?.[rowIndex] ?? featureColors[i]!)
            ctx.fillRect(left, top, width, h)
          }
        }

        ctx.restore()
      }
    }
  }
}
