/* eslint-disable react-refresh/only-export-components */
import { getContainingView } from '@jbrowse/core/util'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { SvgChrome, awaitSvgReady } from '@jbrowse/plugin-linear-genome-view'

import SvgVariantOverlay from '../shared/components/SvgVariantOverlay.tsx'
import { REFERENCE_COLOR } from '../shared/constants.ts'
import { drawVariantBlocks } from './components/Canvas2DVariantRenderer.ts'

import type { RenderSvgBaseModel } from '../shared/renderSvgUtils.ts'
import type {
  VariantRenderBlock,
  VariantRenderState,
  VariantUploadData,
} from './components/variantRenderingBackendTypes.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface RenderSvgModel extends RenderSvgBaseModel {
  referenceDrawingMode: string
  renderBlocks: VariantRenderBlock[]
  perRegionCellMap: ReadonlyMap<number, VariantUploadData>
  renderState: VariantRenderState
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  // svgReady waits for every visible region to load (not just the first datum)
  // and goes false during an in-place refetch, so exports never capture a
  // partial or stale viewport.
  await awaitSvgReady(model)
  const view = getContainingView(model) as LGV
  const height = model.height
  return (
    <SvgChrome
      error={model.error}
      regionTooLarge={model.regionTooLarge}
      width={view.width}
      height={height}
    >
      <VariantSvgBody model={model} view={view} height={height} opts={opts} />
    </SvgChrome>
  )
}

function VariantSvgBody({
  model,
  view,
  height,
  opts,
}: {
  model: RenderSvgModel
  view: LGV
  height: number
  opts: ExportSvgDisplayOptions | undefined
}) {
  // reuse the model's own getters so the export draws the exact block set,
  // region map, and canvas geometry the live canvas does — no divergent rebuild
  // here. renderState.canvasWidth is the viewport-relative width the blocks are
  // already clipped to, not the full-genome totalWidthPx.
  const { referenceDrawingMode, renderBlocks, perRegionCellMap, renderState } =
    model
  const { canvasWidth, canvasHeight } = renderState
  return (
    <SvgVariantOverlay
      model={model}
      idPrefix="variant-clip"
      width={view.width}
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
          drawVariantBlocks(ctx, perRegionCellMap, renderBlocks, renderState)
        }}
      />
    </SvgVariantOverlay>
  )
}
