import { getContainingView, measureText } from '@jbrowse/core/util'
import { when } from 'mobx'

import type { MatrixCellData } from './components/computeVariantMatrixCells.ts'
import type { LinearVariantMatrixDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

function rgbaAttrs(colors: Uint8Array, i: number) {
  const r = colors[i * 4]!
  const g = colors[i * 4 + 1]!
  const b = colors[i * 4 + 2]!
  const a = colors[i * 4 + 3]!
  const rgb = `rgb(${r},${g},${b})`
  return a === 255
    ? `fill="${rgb}"`
    : `fill="${rgb}" fill-opacity="${(a / 255).toFixed(3)}"`
}

export async function renderSvg(
  model: LinearVariantMatrixDisplayModel,
  _opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(model) as LGV
  await when(
    () => model.webglCellData != null || !!model.error || model.regionTooLarge,
  )
  const cellData = model.webglCellData as MatrixCellData | undefined
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

  const { rowHeight, scrollTop, availableHeight } = model
  const canvasWidth = Math.round(view.dynamicBlocks.totalWidthPxWithoutBorders)
  const colWidth = canvasWidth / numFeatures

  let content = ''

  for (let i = 0; i < numCells; i++) {
    const featureIdx = cellFeatureIndices[i]!
    const rowIndex = cellRowIndices[i]!
    const fillAttrs = rgbaAttrs(cellColors, i)

    const y = rowIndex * rowHeight - scrollTop
    if (y + rowHeight < 0 || y > availableHeight) {
      continue
    }

    const x = featureIdx * colWidth
    const w = Math.max(colWidth, 1)
    const h = Math.max(rowHeight, 1)

    content += `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${fillAttrs}/>`
  }

  const sources = model.sources ?? []
  const { hierarchy, showTree, treeAreaWidth } = model
  const labelOffset = showTree && hierarchy ? treeAreaWidth : 0
  let labelsEl: React.ReactNode = null
  if (sources.length > 1) {
    const labelWidth =
      Math.max(...sources.map(s => measureText(s.name, 10))) + 10
    labelsEl = (
      <g transform={`translate(${labelOffset} 0)`}>
        {sources.map((source, idx) => {
          const y = idx * rowHeight - scrollTop
          if (y + rowHeight < 0 || y > availableHeight) {
            return null
          }
          const boxHeight = Math.min(20, rowHeight)
          return (
            <g key={source.name}>
              <rect
                x={0}
                y={y}
                width={labelWidth}
                height={boxHeight}
                fill="rgba(255,255,255,0.8)"
              />
              <text x={4} y={y + boxHeight / 2 + 3} fontSize={10}>
                {source.name}
              </text>
            </g>
          )
        })}
      </g>
    )
  }

  let treeEl: React.ReactNode = null
  if (showTree && hierarchy) {
    let treePaths = ''
    for (const link of hierarchy.links()) {
      const sx = link.source.y!
      const sy = link.source.x!
      const tx = link.target.y!
      const ty = link.target.x!
      treePaths += `M${sx},${sy}L${sx},${ty}M${sx},${ty}L${tx},${ty}`
    }
    treeEl = (
      <g transform={`translate(0 ${-scrollTop})`}>
        <path d={treePaths} fill="none" stroke="#0008" strokeWidth={1} />
      </g>
    )
  }

  return (
    <>
      <g dangerouslySetInnerHTML={{ __html: content }} />
      {labelsEl}
      {treeEl}
    </>
  )
}
