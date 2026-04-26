import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { when } from 'mobx'

import {
  Canvas2DVariantRenderer,
  drawVariantBlocks,
} from './components/Canvas2DVariantRenderer.ts'
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
  await when(
    () => model.cellData != null || !!model.error || model.regionTooLarge,
  )
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
  const visibleRegions = view.visibleRegions
  const totalWidth = view.totalWidthPx

  // Headless renderer: drive the same drawVariantBlocks pipeline as on-screen.
  // VariantCellData is a structural superset of VariantUploadData (extra
  // fields are flatbush + genotype maps for hit-testing), so pass through.
  const renderer = new Canvas2DVariantRenderer(null)
  for (const region of visibleRegions) {
    const regionCellData =
      cellData.perRegionCellData[region.displayedRegionIndex]
    if (regionCellData && regionCellData.numCells > 0) {
      renderer.uploadRegion(region.displayedRegionIndex, regionCellData)
    }
  }

  const renderBlocks = buildRenderBlocks(visibleRegions)

  const cellsNode = paintLayer(totalWidth, availableHeight, opts, ctx => {
    if (referenceDrawingMode === 'skip') {
      ctx.fillStyle = REFERENCE_COLOR
      ctx.fillRect(0, 0, totalWidth, availableHeight)
    }
    drawVariantBlocks(ctx, renderer.getRegions(), renderBlocks, {
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
