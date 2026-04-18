import { getContainingView } from '@jbrowse/core/util'
import {
  abgrAlpha,
  abgrBlue,
  abgrGreen,
  abgrRed,
} from '@jbrowse/core/util/colorBits'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'

import { drawVariantShape } from './components/variantShape.ts'
import SvgLabelRows from '../shared/components/SvgLabelRows.tsx'
import SvgTree from '../shared/components/SvgTree.tsx'

import type { VariantCellData } from './components/computeVariantCells.ts'
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
  referenceDrawingMode: string
  hierarchy: ClusterHierarchyNode | undefined
  showTree: boolean
  treeAreaWidth: number
}

function setFillFromCellColor(ctx: SvgCanvas, colors: Uint32Array, i: number) {
  const c = colors[i]!
  ctx.fillStyle = `rgb(${abgrRed(c)},${abgrGreen(c)},${abgrBlue(c)})`
  ctx.globalAlpha = abgrAlpha(c) / 255
}

function renderCellsForRegion(
  ctx: SvgCanvas,
  cellData: VariantCellData,
  region: {
    regionNumber: number
    start: number
    end: number
    reversed?: boolean
    screenStartPx: number
    screenEndPx: number
  },
  rowHeight: number,
  scrollTop: number,
  availableHeight: number,
) {
  const {
    cellPositions,
    cellRowIndices,
    cellColors,
    cellShapeTypes,
    numCells,
    regionStart,
  } = cellData

  const blockWidth = region.screenEndPx - region.screenStartPx
  const regionLengthBp = region.end - region.start

  for (let i = 0; i < numCells; i++) {
    const cellStart = regionStart + cellPositions[i * 2]!
    const cellEnd = regionStart + cellPositions[i * 2 + 1]!
    const rowIndex = cellRowIndices[i]!
    const shapeType = cellShapeTypes[i]!

    const y = rowIndex * rowHeight - scrollTop
    if (y + rowHeight < 0 || y > availableHeight) {
      continue
    }

    if (cellEnd < region.start || cellStart > region.end) {
      continue
    }

    const clippedStart = Math.max(cellStart, region.start)
    const clippedEnd = Math.min(cellEnd, region.end)

    const frac1 = (clippedStart - region.start) / regionLengthBp
    const frac2 = (clippedEnd - region.start) / regionLengthBp
    const px1 = region.reversed
      ? region.screenEndPx - frac1 * blockWidth
      : region.screenStartPx + frac1 * blockWidth
    const px2 = region.reversed
      ? region.screenEndPx - frac2 * blockWidth
      : region.screenStartPx + frac2 * blockWidth
    const x = Math.min(px1, px2)
    const x2 = Math.max(px1, px2)
    const w = Math.max(x2 - x, 2)
    const h = Math.max(rowHeight, 1)

    setFillFromCellColor(ctx, cellColors, i)
    drawVariantShape(ctx, shapeType, x, y, w, h)
  }
}

export async function renderSvg(
  model: RenderSvgModel,
  _opts?: ExportSvgDisplayOptions,
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
  const regions = view.visibleRegions as {
    regionNumber: number
    start: number
    end: number
    reversed?: boolean
    screenStartPx: number
    screenEndPx: number
  }[]

  const ctx = new SvgCanvas()

  if (referenceDrawingMode === 'skip') {
    ctx.fillStyle = '#ccc'
    ctx.globalAlpha = 1
    ctx.fillRect(0, 0, Math.round(view.width), availableHeight)
  }

  for (const region of regions) {
    const regionCellData = cellData.perRegionCellData[region.regionNumber]
    if (regionCellData && regionCellData.numCells > 0) {
      renderCellsForRegion(
        ctx,
        regionCellData,
        region,
        rowHeight,
        scrollTop,
        availableHeight,
      )
    }
  }

  const sources = model.sources ?? []
  const { hierarchy, showTree, treeAreaWidth } = model
  const labelOffset = showTree && hierarchy ? treeAreaWidth : 0

  return (
    <SvgClipRect
      id={`variant-clip-${model.id}`}
      width={Math.round(view.width)}
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
