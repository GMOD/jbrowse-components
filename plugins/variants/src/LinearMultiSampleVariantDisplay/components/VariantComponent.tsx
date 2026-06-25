import { useState } from 'react'

import { VerticalScrollbar } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'
import { observer } from 'mobx-react'

import { buildVariantHit } from '../../shared/buildVariantHit.ts'
import { REFERENCE_COLOR } from '../../shared/constants.ts'
import { enrichFeatureFromClick } from '../../shared/enrichFeatureFromClick.ts'
import { decodeGenotype } from '../../shared/genotypeCodec.ts'
import { useVariantCanvasInteraction } from '../../shared/hooks/useVariantCanvasInteraction.tsx'
import { useVariantVirtualScroll } from '../../shared/useVariantVirtualScroll.ts'

import type { VariantTooltipFields } from '../../shared/buildVariantHit.ts'
import type { VariantFeatureInfo } from '../../shared/types.ts'
import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface HoveredCell {
  rowIndex: number
  genomicStart: number
  genomicEnd: number
  displayedRegionIndex: number
}

interface VariantHit extends VariantTooltipFields {
  featureInfo: VariantFeatureInfo
  cell: HoveredCell
}

function getFeatureUnderMouse(
  model: LinearMultiSampleVariantDisplayModel,
  rect: DOMRect,
  eventClientX: number,
  eventClientY: number,
): VariantHit | undefined {
  const cellData = model.cellData
  if (cellData?.mode !== 'regular') {
    return undefined
  }
  const mouseX = eventClientX - rect.left
  const mouseY = eventClientY - rect.top

  const region = model.visibleRegions.find(
    r => mouseX >= r.screenStartPx && mouseX < r.screenEndPx,
  )
  if (!region) {
    return undefined
  }

  const regionCellData = cellData.perRegionCellData[region.displayedRegionIndex]
  if (!regionCellData) {
    return undefined
  }

  const flatbushIndex = model.flatbushIndices.get(region.displayedRegionIndex)
  if (!flatbushIndex) {
    return undefined
  }

  const blockWidth = region.screenEndPx - region.screenStartPx
  const regionLengthBp = region.end - region.start
  const bpPerPx = regionLengthBp / blockWidth

  const frac = (mouseX - region.screenStartPx) / blockWidth
  const genomicPos = region.reversed
    ? region.end - frac * regionLengthBp
    : region.start + frac * regionLengthBp

  // Rows under 1px draw 1px tall, so sub-pixel rows stack under one cursor
  // pixel. Query the band of rows whose 1px-min box overlaps the cursor (a
  // single Y-point misses sparse rows with no cell under the column), then pick
  // the shortest feature so a small variant atop a large one stays selectable.
  // 1px-min mirrors max(u.rowHeight, 1.0) in shaders/variant.slang +
  // Canvas2DVariantRenderer.ts.
  const drawnRowHeight = Math.max(model.rowHeight, 1)
  const rowLo = (mouseY - drawnRowHeight + model.scrollTop) / model.rowHeight
  const rowHi = (mouseY + 1 + model.scrollTop) / model.rowHeight

  const bpPadding = 5 * bpPerPx
  const hits = flatbushIndex.search(
    genomicPos - bpPadding,
    rowLo,
    genomicPos + bpPadding,
    rowHi,
  )

  let bestIdx = -1
  let bestLen = Infinity
  for (const idx of hits) {
    const len =
      regionCellData.cellPositions[idx * 2 + 1]! -
      regionCellData.cellPositions[idx * 2]!
    if (len < bestLen) {
      bestLen = len
      bestIdx = idx
    }
  }

  if (bestIdx < 0) {
    return undefined
  }

  const featureId =
    regionCellData.featureIdList[regionCellData.cellFeatureIndices[bestIdx]!]!
  const rowIndex = regionCellData.cellRowIndices[bestIdx]!
  // The cell row index maps directly into model.sources (same effectiveSources
  // ordering used to compute the cells), so no per-region sourceNameList is
  // shipped over RPC.
  const source = model.sources?.[rowIndex]
  if (!source) {
    return undefined
  }
  const genomicStart = regionCellData.cellPositions[bestIdx * 2]!
  const genomicEnd = regionCellData.cellPositions[bestIdx * 2 + 1]!
  const info = regionCellData.featureGenotypeMap[featureId]!
  const genotype = decodeGenotype(
    cellData.genotypeDict,
    model.genotypeSampleIndex!,
    info.genotypeCodes,
    source.sampleName,
  )!
  return {
    ...buildVariantHit({
      info,
      genotype,
      sampleName: source.sampleName,
      name: source.name,
      featureId,
    }),
    featureInfo: info,
    cell: {
      rowIndex,
      genomicStart,
      genomicEnd,
      displayedRegionIndex: region.displayedRegionIndex,
    },
  }
}

const HoveredCellHighlight = observer(function HoveredCellHighlight({
  cell,
  model,
}: {
  cell: {
    rowIndex: number
    genomicStart: number
    genomicEnd: number
    displayedRegionIndex: number
  }
  model: LinearMultiSampleVariantDisplayModel
}) {
  const region = model.visibleRegions.find(
    r => r.displayedRegionIndex === cell.displayedRegionIndex,
  )
  if (!region) {
    return null
  }
  const toX = makeBpMapper(region)
  const px1 = toX(cell.genomicStart)
  const px2 = toX(cell.genomicEnd)
  const left = Math.min(px1, px2)
  const right = Math.max(px1, px2)
  const top = cell.rowIndex * model.rowHeight - model.scrollTop
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: Math.max(right - left, 2),
        height: model.rowHeight,
        border: '1px solid rgba(0,0,0,0.5)',
        background: 'rgba(255,255,255,0.3)',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  )
})

// The per-sample variant canvas + scrollbar + hit-test wiring. DisplayChrome
// (owned by the outer VariantDisplayComponent) owns the GPU
// backend and the terminal states, handing the live canvas down here.
const VariantBody = observer(function VariantBody({
  model,
  canvasRef,
  canvas,
}: {
  model: LinearMultiSampleVariantDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  canvas: HTMLCanvasElement | null
}) {
  const [hoveredCell, setHoveredCell] = useState<HoveredCell>()

  const view = getContainingView(model) as LGV
  const width = view.trackWidthPx
  const height = model.availableHeight

  useVariantVirtualScroll({
    canvas,
    scrollTop: model.scrollTop,
    setScrollTop: model.setScrollTop,
    totalHeight: model.totalHeight,
    viewportHeight: model.availableHeight,
    scrollZoom: view.scrollZoom,
    rowHeight: model.rowHeight,
    nrow: model.nrow,
    setRowHeight: model.setRowHeight,
  })

  const { canvasHandlers, contextMenuNode } =
    useVariantCanvasInteraction<VariantHit>({
      model,
      getHit: (rect, x, y) => getFeatureUnderMouse(model, rect, x, y),
      getTooltip: hit => {
        const { featureId, cell, sampleName, featureInfo, ...tooltip } = hit
        return tooltip
      },
      enrich: hit => {
        const baseFeature = model.featuresVolatile?.find(
          f => f.id() === hit.featureId,
        )
        return baseFeature
          ? enrichFeatureFromClick(baseFeature, hit.featureInfo, hit)
          : undefined
      },
      onHoverChange: hit => {
        setHoveredCell(hit?.cell)
      },
    })

  return (
    <>
      <canvas
        data-testid="variant_canvas"
        ref={canvasRef}
        style={{
          width,
          height,
          position: 'absolute',
          left: 0,
          top: 0,
          backgroundColor:
            model.referenceDrawingMode === 'skip' ? REFERENCE_COLOR : undefined,
        }}
        {...canvasHandlers}
      />
      {hoveredCell ? (
        <HoveredCellHighlight cell={hoveredCell} model={model} />
      ) : null}
      <VerticalScrollbar
        scrollTop={model.scrollTop}
        setScrollTop={n => {
          model.setScrollTop(n)
        }}
        viewportHeight={model.availableHeight}
        contentHeight={model.totalHeight}
      />
      {contextMenuNode}
    </>
  )
})

export default VariantBody
