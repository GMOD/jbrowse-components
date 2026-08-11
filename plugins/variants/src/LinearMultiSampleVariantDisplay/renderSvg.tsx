/* eslint-disable react-refresh/only-export-components */
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/plugin-linear-genome-view'

import SvgVariantOverlay from '../shared/components/SvgVariantOverlay.tsx'
import { REFERENCE_COLOR } from '../shared/constants.ts'
import { drawVariantBlocks } from './components/Canvas2DVariantRenderer.ts'
import { drawVariantInsertionGlyphs } from './components/drawVariantInsertionGlyphs.ts'
import { drawVariantLane } from './components/drawVariantLane.ts'

import type { RenderSvgBaseModel } from '../shared/renderSvgUtils.ts'
import type { VariantInsertionGlyphData } from './components/drawVariantInsertionGlyphs.ts'
import type { VariantLaneData } from './components/drawVariantLane.ts'
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
  // undefined when the variant lane band is off
  variantLaneRegions: ReadonlyMap<number, VariantLaneData> | undefined
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
    variantLaneRegions,
    topBands,
  } = model
  // canvasWidth is the block scissor bound and the cell pixel-snapping origin,
  // so it has to be the width this layer is actually painted at — see
  // LgvSvgBodyProps.canvasWidth.
  const exportState = { ...renderState, canvasWidth }
  const { canvasHeight } = renderState
  // The export's palette comes from the user-selected export theme rather than
  // the live on-screen one, the same rule plugin-maf's export follows, so a
  // light export of a dark session still gets light-theme colors.
  const exportPalette = resolvePalette({ configTheme: opts?.theme })
  const { insertion } = exportPalette
  return (
    <SvgVariantOverlay
      model={model}
      idPrefix="variant-clip"
      width={canvasWidth}
      height={height}
      // Its own paint layer in the band above the rows, untranslated — the
      // same split the screen takes (a separate canvas outside the offset
      // container), so the lane cannot pick up the rows' scroll.
      variantLane={
        variantLaneRegions ? (
          <PaintLayer
            width={canvasWidth}
            height={topBands.laneHeight}
            opts={opts}
            paint={ctx => {
              drawVariantLane(ctx, variantLaneRegions, renderBlocks, {
                canvasWidth,
                bands: topBands,
                // the export theme's text color, not the live session's, the
                // same rule the insertion markers beside it follow
                labelColor: exportPalette.text.primary,
              })
            }}
          />
        ) : null
      }
      // the same color the glyphs below are painted with, so the key can't
      // describe the live session's theme while the markers show the export's
      insertionColor={insertion}
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
              insertion,
            )
          }
        }}
      />
    </SvgVariantOverlay>
  )
}
