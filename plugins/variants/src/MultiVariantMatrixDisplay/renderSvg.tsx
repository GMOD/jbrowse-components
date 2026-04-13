import { getContainingView } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'

import SvgLabelRows from '../shared/components/SvgLabelRows.tsx'
import SvgTree from '../shared/components/SvgTree.tsx'

import type { MatrixCellData } from './components/computeVariantMatrixCells.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { ClusterHierarchyNode } from '@jbrowse/tree-sidebar'

type LGV = LinearGenomeViewModel

interface RenderSvgModel {
  id: string
  cellData: unknown
  error: unknown
  regionTooLarge: boolean
  rowHeight: number
  scrollTop: number
  availableHeight: number
  height: number
  canDisplayLabels: boolean
  sources: { name: string }[] | undefined
  hierarchy: ClusterHierarchyNode | undefined
  showTree: boolean
  treeAreaWidth: number
}

export async function renderSvg(
  model: RenderSvgModel,
  _opts?: ExportSvgDisplayOptions,
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

  const ctx = new SvgCanvas()

  for (let i = 0; i < numCells; i++) {
    const featureIdx = cellFeatureIndices[i]!
    const rowIndex = cellRowIndices[i]!
    const r = cellColors[i * 4]!
    const g = cellColors[i * 4 + 1]!
    const b = cellColors[i * 4 + 2]!
    const a = cellColors[i * 4 + 3]!

    const y = rowIndex * rowHeight - scrollTop
    if (y + rowHeight < 0 || y > availableHeight) {
      continue
    }

    const x = featureIdx * colWidth
    const w = Math.max(colWidth, 2)
    const h = Math.max(rowHeight, 1)

    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.globalAlpha = a / 255
    ctx.fillRect(x, y, w, h)
  }

  const sources = model.sources ?? []
  const { hierarchy, showTree, treeAreaWidth } = model
  const labelOffset = showTree && hierarchy ? treeAreaWidth : 0

  return (
    <SvgClipRect
      id={`variant-matrix-clip-${model.id}`}
      width={canvasWidth}
      height={model.height}
    >
      <g dangerouslySetInnerHTML={{ __html: ctx.getSerializedSvg() }} />
      {sources.length > 1 && canDisplayLabels ? (
        <SvgLabelRows
          sources={sources}
          rowHeight={rowHeight}
          scrollTop={scrollTop}
          availableHeight={availableHeight}
          labelOffset={labelOffset}
        />
      ) : null}
      {showTree && hierarchy ? (
        <SvgTree hierarchy={hierarchy} scrollTop={scrollTop} />
      ) : null}
    </SvgClipRect>
  )
}
