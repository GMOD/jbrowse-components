/* eslint-disable react-refresh/only-export-components */
import { getContainingView } from '@jbrowse/core/util'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { SvgChrome, awaitSvgReady } from '@jbrowse/plugin-linear-genome-view'

import { drawVariantBlocks } from './components/Canvas2DVariantRenderer.ts'
import SvgVariantOverlay from '../shared/components/SvgVariantOverlay.tsx'
import { REFERENCE_COLOR } from '../shared/constants.ts'

import type { RenderSvgBaseModel } from '../shared/renderSvgUtils.ts'
import type {
  VariantRenderBlock,
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
  const height = opts?.overrideHeight ?? model.height
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
  const {
    effectiveRowHeight: rowHeight,
    scrollTop,
    availableHeight,
    referenceDrawingMode,
    canDisplayLabels,
    // reuse the model's own getters so the export draws the exact block set and
    // region map the live canvas does — no divergent rebuild here
    renderBlocks,
    perRegionCellMap,
  } = model
  // canvas spans the viewport (visibleRegions coords are viewport-relative and
  // clipped to view.width below), matching the on-screen canvas rather than the
  // full-genome totalWidthPx
  const canvasWidth = view.width

  const sources = model.sources ?? []
  return (
    <SvgVariantOverlay
      id={`variant-clip-${model.id}`}
      width={view.width}
      height={height}
      content={
        <PaintLayer
          width={canvasWidth}
          height={availableHeight}
          opts={opts}
          paint={ctx => {
            if (referenceDrawingMode === 'skip') {
              ctx.fillStyle = REFERENCE_COLOR
              ctx.fillRect(0, 0, canvasWidth, availableHeight)
            }
            drawVariantBlocks(ctx, perRegionCellMap, renderBlocks, {
              canvasWidth,
              canvasHeight: availableHeight,
              rowHeight,
              scrollTop,
            })
          }}
        />
      }
      sources={sources}
      rowHeight={rowHeight}
      scrollTop={scrollTop}
      availableHeight={availableHeight}
      canDisplayLabels={canDisplayLabels}
      hierarchy={model.hierarchy}
      showTree={model.showTree}
      treeAreaWidth={model.treeAreaWidth}
    />
  )
}
