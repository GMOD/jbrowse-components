import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { when } from 'mobx'

import { drawVariantMatrixBlocks } from './components/Canvas2DVariantMatrixRenderer.ts'
import SvgVariantOverlay from '../shared/components/SvgVariantOverlay.tsx'

import type { RenderSvgBaseModel } from '../shared/renderSvgUtils.ts'
import type { MatrixCellData } from './components/computeVariantMatrixCells.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export async function renderSvg(
  model: RenderSvgBaseModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(model) as LGV
  // svgReady waits for every visible region to load (not just the first datum)
  // and goes false during an in-place refetch, so exports never capture a
  // partial or stale viewport.
  await when(() => model.svgReady)
  const cellData = model.cellData as MatrixCellData | undefined
  if (!cellData || cellData.numCells === 0) {
    return null
  }

  const { rowHeight, scrollTop, availableHeight, canDisplayLabels } = model
  const canvasWidth = view.totalWidthPxWithoutBorders
  const cellsNode = paintLayer(canvasWidth, availableHeight, opts, ctx => {
    drawVariantMatrixBlocks(ctx, cellData, {
      canvasWidth,
      canvasHeight: availableHeight,
      rowHeight,
      scrollTop,
    })
  })

  const sources = model.sources ?? []
  return (
    <SvgVariantOverlay
      id={`variant-matrix-clip-${model.id}`}
      width={canvasWidth}
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
