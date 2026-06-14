import { useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'
import { observer } from 'mobx-react'

import { buildVariantHit } from '../../shared/buildVariantHit.ts'
import { REFERENCE_COLOR } from '../../shared/constants.ts'
import { enrichFeatureFromClick } from '../../shared/enrichFeatureFromClick.ts'
import { useVariantCanvasInteraction } from '../../shared/hooks/useVariantCanvasInteraction.tsx'
import { scrollbarStyles } from '../../shared/scrollbarStyles.ts'
import { useVariantVirtualScroll } from '../../shared/useVariantVirtualScroll.ts'

import type { FeatureGenotypeInfo } from './computeVariantCells.ts'
import type { VariantTooltipFields } from '../../shared/buildVariantHit.ts'
import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(scrollbarStyles)

interface HoveredCell {
  rowIndex: number
  genomicStart: number
  genomicEnd: number
  displayedRegionIndex: number
}

interface VariantHit extends VariantTooltipFields {
  featureInfo: FeatureGenotypeInfo
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
  // mouseY maps to exactly one sample row, so query that row as a Y-point —
  // padding the row axis would let a genomically-closer cell in an adjacent
  // sample win and show the wrong sample's genotype.
  const rowFrac = (mouseY + model.scrollTop) / model.rowHeight

  const bpPadding = 5 * bpPerPx
  const hits = flatbushIndex.search(
    genomicPos - bpPadding,
    rowFrac,
    genomicPos + bpPadding,
    rowFrac,
  )

  let bestIdx = -1
  let bestDist = Infinity
  for (const idx of hits) {
    const gStart = regionCellData.flatbushGenomicStarts[idx]!
    const gEnd = regionCellData.flatbushGenomicEnds[idx]!
    const dx =
      genomicPos < gStart
        ? gStart - genomicPos
        : genomicPos > gEnd
          ? genomicPos - gEnd
          : 0
    if (dx < bestDist) {
      bestDist = dx
      bestIdx = idx
    }
  }

  if (bestIdx < 0) {
    return undefined
  }

  const featureId =
    regionCellData.featureIdList[
      regionCellData.flatbushFeatureIndices[bestIdx]!
    ]!
  const rowIndex = regionCellData.cellRowIndices[bestIdx]!
  // The cell row index maps directly into model.sources (same effectiveSources
  // ordering used to compute the cells), so no per-region sourceNameList is
  // shipped over RPC.
  const source = model.sources?.[rowIndex]
  if (!source) {
    return undefined
  }
  const genomicStart = regionCellData.flatbushGenomicStarts[bestIdx]!
  const genomicEnd = regionCellData.flatbushGenomicEnds[bestIdx]!
  const info = regionCellData.featureGenotypeMap[featureId]!
  const genotype = info.genotypes[source.sampleName]!
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
  const { classes } = useStyles()

  const view = getContainingView(model) as LGV
  const width = view.trackWidthPx
  const height = model.availableHeight

  const { hasOverflow, thumbHeight, thumbTop, handleScrollbarMouseDown } =
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
      {hasOverflow ? (
        <div
          className={classes.scrollbarTrack}
          style={{ top: 0, height }}
          onMouseDown={handleScrollbarMouseDown}
        >
          <div
            className={classes.scrollbarThumb}
            style={{ top: thumbTop, height: thumbHeight }}
          />
        </div>
      ) : null}
      {contextMenuNode}
    </>
  )
})

export default VariantBody
