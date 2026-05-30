import { useState } from 'react'

import { getBpDisplayStr, getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { makeSimpleAltString } from '../../VcfFeature/util.ts'
import { REFERENCE_COLOR } from '../../shared/constants.ts'
import { enrichFeatureFromClick } from '../../shared/enrichFeatureFromClick.ts'
import { useVariantCanvasInteraction } from '../../shared/hooks/useVariantCanvasInteraction.tsx'
import { scrollbarStyles } from '../../shared/scrollbarStyles.ts'
import { useVariantVirtualScroll } from '../../shared/useVariantVirtualScroll.ts'

import type { FeatureGenotypeInfo } from './computeVariantCells.ts'
import type { MultiLinearVariantDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(scrollbarStyles)

interface HoveredCell {
  rowIndex: number
  genomicStart: number
  genomicEnd: number
  displayedRegionIndex: number
}

interface VariantHit {
  genotype: string
  alleles: string
  featureName: string
  description: string
  length: string
  sampleName: string
  name: string
  featureId: string
  featureInfo: FeatureGenotypeInfo
  cell: HoveredCell
}

function getFeatureUnderMouse(
  model: MultiLinearVariantDisplayModel,
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
  const rowFrac = (mouseY + model.scrollTop) / model.rowHeight

  const pxPadding = 5
  const bpPadding = pxPadding * bpPerPx
  const rowPadding = Math.max(0.5, pxPadding / model.rowHeight)
  const hits = flatbushIndex.search(
    genomicPos - bpPadding,
    rowFrac - rowPadding,
    genomicPos + bpPadding,
    rowFrac + rowPadding,
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
  const sourceName =
    regionCellData.sourceNameList[regionCellData.cellRowIndices[bestIdx]!]!
  const genomicStart = regionCellData.flatbushGenomicStarts[bestIdx]!
  const genomicEnd = regionCellData.flatbushGenomicEnds[bestIdx]!
  const info = regionCellData.featureGenotypeMap[featureId]!
  const source = model.sourceMap?.[sourceName]
  const genotype = info.genotypes[source?.sampleName ?? sourceName]!
  return {
    genotype,
    alleles: makeSimpleAltString(genotype, info.ref, info.alt),
    featureName: info.name,
    description:
      info.alt.length >= 3 ? 'multiple ALT alleles' : info.description,
    length: getBpDisplayStr(info.length),
    sampleName: source?.sampleName ?? sourceName,
    name: sourceName,
    featureId,
    featureInfo: info,
    cell: {
      rowIndex: regionCellData.cellRowIndices[bestIdx]!,
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
  model: MultiLinearVariantDisplayModel
}) {
  const region = model.visibleRegions.find(
    r => r.displayedRegionIndex === cell.displayedRegionIndex,
  )
  if (!region) {
    return null
  }
  const blockWidth = region.screenEndPx - region.screenStartPx
  const regionLengthBp = region.end - region.start
  const reversed = region.reversed
  const frac1 = (cell.genomicStart - region.start) / regionLengthBp
  const frac2 = (cell.genomicEnd - region.start) / regionLengthBp
  const px1 = reversed
    ? region.screenEndPx - frac1 * blockWidth
    : region.screenStartPx + frac1 * blockWidth
  const px2 = reversed
    ? region.screenEndPx - frac2 * blockWidth
    : region.screenStartPx + frac2 * blockWidth
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
// (owned by the outer MultiSampleVariantBaseDisplayComponent) owns the GPU
// backend and the terminal states, handing the live canvas down here.
const VariantBody = observer(function VariantBody({
  model,
  canvasRef,
  canvas,
}: {
  model: MultiLinearVariantDisplayModel
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
        data-testid={
          model.canvasDrawn ? 'variant_canvas_done' : 'variant_canvas'
        }
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
