import { getContainingView, measureText } from '@jbrowse/core/util'
import { when } from 'mobx'

import type { VariantCellData } from './components/computeVariantCells.ts'
import type { MultiLinearVariantDisplayModel } from './model.ts'
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
  return a === 255 ? `fill="${rgb}"` : `fill="${rgb}" fill-opacity="${(a / 255).toFixed(3)}"`
}

export async function renderSvg(
  model: MultiLinearVariantDisplayModel,
  _opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(model) as LGV
  await when(() => model.webglCellData != null || !!model.error || model.regionTooLarge)
  const cellData = model.webglCellData as VariantCellData | undefined
  if (!cellData || cellData.numCells === 0) {
    return null
  }

  const {
    cellPositions,
    cellRowIndices,
    cellColors,
    cellShapeTypes,
    numCells,
    regionStart,
  } = cellData

  const { rowHeight, scrollTop, availableHeight, referenceDrawingMode } = model
  const regions = view.visibleRegions as {
    start: number
    end: number
    screenStartPx: number
    screenEndPx: number
  }[]

  let content = ''

  if (referenceDrawingMode === 'skip') {
    content += `<rect x="0" y="0" width="${Math.round(view.width)}" height="${availableHeight}" fill="#ccc"/>`
  }

  for (let i = 0; i < numCells; i++) {
    const cellStart = regionStart + cellPositions[i * 2]!
    const cellEnd = regionStart + cellPositions[i * 2 + 1]!
    const rowIndex = cellRowIndices[i]!
    const shapeType = cellShapeTypes[i]!
    const fillAttrs = rgbaAttrs(cellColors, i)

    const y = rowIndex * rowHeight - scrollTop
    const yEnd = y + rowHeight
    if (yEnd < 0 || y > availableHeight) {
      continue
    }

    let drawn = false
    for (const region of regions) {
      if (cellEnd < region.start || cellStart > region.end) {
        continue
      }

      const blockWidth = region.screenEndPx - region.screenStartPx
      const regionLengthBp = region.end - region.start

      const clippedStart = Math.max(cellStart, region.start)
      const clippedEnd = Math.min(cellEnd, region.end)

      const x =
        region.screenStartPx +
        ((clippedStart - region.start) / regionLengthBp) * blockWidth
      const x2 =
        region.screenStartPx +
        ((clippedEnd - region.start) / regionLengthBp) * blockWidth
      const w = Math.max(x2 - x, 1)
      const h = Math.max(rowHeight, 1)

      if (shapeType === 0) {
        content += `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${fillAttrs}/>`
      } else if (shapeType === 1) {
        const midY = y + h / 2
        content += `<polygon points="${x},${y} ${x + w},${midY} ${x},${yEnd}" ${fillAttrs}/>`
      } else if (shapeType === 2) {
        const midY = y + h / 2
        content += `<polygon points="${x + w},${y} ${x},${midY} ${x + w},${yEnd}" ${fillAttrs}/>`
      } else if (shapeType === 3) {
        const midX = x + w / 2
        content += `<polygon points="${x},${y} ${x + w},${y} ${midX},${yEnd}" ${fillAttrs}/>`
      }

      drawn = true
    }

    if (!drawn) {
      continue
    }
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
        <path
          d={treePaths}
          fill="none"
          stroke="#0008"
          strokeWidth={1}
        />
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
