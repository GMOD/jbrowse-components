import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SVGErrorBox, awaitSvgReady } from '@jbrowse/plugin-linear-genome-view'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'

import { drawVariantBlocks } from './components/Canvas2DVariantRenderer.ts'
import SvgVariantOverlay from '../shared/components/SvgVariantOverlay.tsx'
import { REFERENCE_COLOR } from '../shared/constants.ts'

import type { RenderSvgBaseModel } from '../shared/renderSvgUtils.ts'
import type { VariantCellData } from './components/computeVariantCells.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface RenderSvgModel extends RenderSvgBaseModel {
  referenceDrawingMode: string
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(model) as LGV
  // svgReady waits for every visible region to load (not just the first datum)
  // and goes false during an in-place refetch, so exports never capture a
  // partial or stale viewport.
  await awaitSvgReady(model)
  if (model.error) {
    return (
      <SVGErrorBox
        error={model.error}
        width={view.width}
        height={model.height}
      />
    )
  }
  const cellData = model.cellData as
    | { perRegionCellData: Record<number, VariantCellData> }
    | undefined
  if (!cellData) {
    return null
  }

  const {
    rowHeight,
    scrollTop,
    availableHeight,
    referenceDrawingMode,
    canDisplayLabels,
  } = model
  const totalWidth = view.totalWidthPx
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  const regions = new Map<number, VariantCellData>()
  for (const [idxStr, data] of Object.entries(cellData.perRegionCellData)) {
    if (data.numCells > 0) {
      regions.set(Number(idxStr), data)
    }
  }
  const cellsNode = paintLayer(totalWidth, availableHeight, opts, ctx => {
    if (referenceDrawingMode === 'skip') {
      ctx.fillStyle = REFERENCE_COLOR
      ctx.fillRect(0, 0, totalWidth, availableHeight)
    }
    drawVariantBlocks(ctx, regions, renderBlocks, {
      canvasWidth: totalWidth,
      canvasHeight: availableHeight,
      rowHeight,
      scrollTop,
    })
  })

  const sources = model.sources ?? []
  return (
    <SvgVariantOverlay
      id={`variant-clip-${model.id}`}
      width={view.width}
      height={model.height}
      content={cellsNode}
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
