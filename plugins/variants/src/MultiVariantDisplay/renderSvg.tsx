import { getContainingView } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'
import { setAbgrFill } from '@jbrowse/core/util/colorBits'
import { when } from 'mobx'


import SvgVariantOverlay from '../shared/components/SvgVariantOverlay.tsx'
import { REFERENCE_COLOR } from '../shared/constants.ts'
import { drawVariantShape } from './components/variantShape.ts'

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

function renderCellsForRegion(
  ctx: SvgCanvas,
  cellData: VariantCellData,
  region: {
    displayedRegionIndex: number
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

  const h = Math.max(rowHeight, 1)
  for (let i = 0; i < numCells; i++) {
    const y = cellRowIndices[i]! * rowHeight - scrollTop
    if (y + rowHeight < 0 || y > availableHeight) {
      continue
    }

    const cellStart = regionStart + cellPositions[i * 2]!
    const cellEnd = regionStart + cellPositions[i * 2 + 1]!
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
    const w = Math.max(Math.max(px1, px2) - x, 2)

    setAbgrFill(ctx, cellColors[i]!)
    drawVariantShape(ctx, cellShapeTypes[i]!, x, y, w, h)
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
    displayedRegionIndex: number
    start: number
    end: number
    reversed?: boolean
    screenStartPx: number
    screenEndPx: number
  }[]

  const ctx = new SvgCanvas()

  if (referenceDrawingMode === 'skip') {
    ctx.fillStyle = REFERENCE_COLOR
    ctx.fillRect(0, 0, Math.round(view.width), availableHeight)
  }

  for (const region of regions) {
    const regionCellData =
      cellData.perRegionCellData[region.displayedRegionIndex]
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
  return (
    <SvgVariantOverlay
      id={`variant-clip-${model.id}`}
      width={Math.round(view.width)}
      height={model.height}
      svgContent={ctx.getSerializedSvg()}
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
