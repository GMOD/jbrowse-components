import { getContainingView } from '@jbrowse/core/util'
import { setAbgrFill } from '@jbrowse/core/util/colorBits'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { when } from 'mobx'

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
  await when(
    () => model.cellData != null || !!model.error || model.regionTooLarge,
  )
  const cellData = model.cellData as MatrixCellData | undefined
  if (!cellData || cellData.numCells === 0) {
    return null
  }

  const {
    cellFeatureIndices,
    cellRowIndices,
    cellColors,
    numCells,
    numFeatures,
  } = cellData

  const { rowHeight, scrollTop, availableHeight, canDisplayLabels } = model
  const canvasWidth = Math.round(view.dynamicBlocks.totalWidthPxWithoutBorders)
  const colWidth = canvasWidth / numFeatures

  const w = Math.max(colWidth, 2)
  const h = Math.max(rowHeight, 1)
  const cellsNode = paintLayer(canvasWidth, availableHeight, opts, ctx => {
    for (let i = 0; i < numCells; i++) {
      const y = cellRowIndices[i]! * rowHeight - scrollTop
      if (y + rowHeight < 0 || y > availableHeight) {
        continue
      }
      setAbgrFill(ctx, cellColors[i]!)
      ctx.fillRect(cellFeatureIndices[i]! * colWidth, y, w, h)
    }
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
