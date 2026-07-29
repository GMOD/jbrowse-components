/* eslint-disable react-refresh/only-export-components */
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/plugin-linear-genome-view'

import SvgVariantOverlay from '../shared/components/SvgVariantOverlay.tsx'
import { REFERENCE_COLOR } from '../shared/constants.ts'
import { drawVariantBlocks } from './components/Canvas2DVariantRenderer.ts'
import { drawVariantInsertionGlyphs } from './components/drawVariantInsertionGlyphs.ts'

import type { RenderSvgBaseModel } from '../shared/renderSvgUtils.ts'
import type { VariantInsertionGlyphData } from './components/drawVariantInsertionGlyphs.ts'
import type {
  VariantRenderBlock,
  VariantRenderState,
  VariantUploadData,
} from './components/variantRenderingBackendTypes.ts'
import type {
  ExportSvgDisplayOptions,
  LgvSvgBodyProps,
} from '@jbrowse/plugin-linear-genome-view'

interface RenderSvgModel extends RenderSvgBaseModel {
  referenceDrawingMode: string
  renderBlocks: VariantRenderBlock[]
  perRegionCellMap: ReadonlyMap<number, VariantUploadData>
  renderState: VariantRenderState
  // undefined when the `showInsertionGlyphs` slot is off
  insertionGlyphRegions:
    | ReadonlyMap<number, VariantInsertionGlyphData>
    | undefined
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  // renderDisplaySvg's awaitSvgReady waits for every visible region to load (not
  // just the first datum) and goes false during an in-place refetch, so exports
  // never capture a partial or stale viewport.
  return renderDisplaySvg(model, opts, VariantSvgBody)
}

function VariantSvgBody({
  model,
  height,
  canvasWidth,
  opts,
}: LgvSvgBodyProps<RenderSvgModel>) {
  // reuse the model's own getters so the export draws the exact block set and
  // region map the live canvas does — no divergent rebuild here.
  const {
    referenceDrawingMode,
    renderBlocks,
    perRegionCellMap,
    renderState,
    insertionGlyphRegions,
  } = model
  // canvasWidth is the block scissor bound and the cell pixel-snapping origin,
  // so it has to be the width this layer is actually painted at — see
  // LgvSvgBodyProps.canvasWidth.
  const exportState = { ...renderState, canvasWidth }
  const { canvasHeight } = renderState
  return (
    <SvgVariantOverlay
      model={model}
      idPrefix="variant-clip"
      width={canvasWidth}
      height={height}
    >
      <PaintLayer
        width={canvasWidth}
        height={canvasHeight}
        opts={opts}
        paint={ctx => {
          if (referenceDrawingMode === 'skip') {
            ctx.fillStyle = REFERENCE_COLOR
            ctx.fillRect(0, 0, canvasWidth, canvasHeight)
          }
          drawVariantBlocks(ctx, perRegionCellMap, renderBlocks, exportState)
          // Same layer, after the cells, so the export stacks them the way the
          // on-screen overlay composites over the canvas.
          if (insertionGlyphRegions) {
            drawVariantInsertionGlyphs(
              ctx,
              insertionGlyphRegions,
              renderBlocks,
              exportState,
            )
          }
        }}
      />
    </SvgVariantOverlay>
  )
}
