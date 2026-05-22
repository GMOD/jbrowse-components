import React, { useRef, useState } from 'react'

import { ErrorOverlay } from '@jbrowse/core/ui'
import {
  getBpDisplayStr,
  getContainingView,
  useGpuBackend,
} from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { VariantRenderer } from './VariantRenderer.ts'
import { makeSimpleAltString } from '../../VcfFeature/util.ts'
import {
  VariantErrorBar,
  VariantLoadingOverlay,
} from '../../shared/components/VariantStatusOverlays.tsx'
import { REFERENCE_COLOR } from '../../shared/constants.ts'
import { enrichFeatureFromClick } from '../../shared/enrichFeatureFromClick.ts'
import { useVariantCanvasInteraction } from '../../shared/hooks/useVariantCanvasInteraction.tsx'
import { scrollbarStyles } from '../../shared/scrollbarStyles.ts'
import { useVariantVirtualScroll } from '../../shared/useVariantVirtualScroll.ts'

import type { VariantCellData } from './computeVariantCells.ts'
import type { VariantBackend } from './variantBackendTypes.ts'
import type { VariantDisplayModelBase } from '../../shared/VariantDisplayModelInterface.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface PerRegionCellData {
  perRegionCellData: Record<number, VariantCellData>
}

export interface VariantDisplayModel extends VariantDisplayModelBase {
  cellData: PerRegionCellData | undefined
  isDisplayLoading: boolean
  statusMessage?: string
  canvasDrawn: boolean
  startBackend: (backend: VariantBackend) => void
  stopBackend: () => void
  renderNow: () => void
  visibleRegions: {
    refName: string
    displayedRegionIndex: number
    start: number
    end: number
    reversed?: boolean
    assemblyName: string
    screenStartPx: number
    screenEndPx: number
  }[]
}

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(scrollbarStyles)

function buildFlatbushIndex(
  cellData: VariantCellData,
  cache: WeakMap<ArrayBuffer, Flatbush>,
) {
  let index = cache.get(cellData.flatbushData)
  if (!index) {
    index = Flatbush.from(cellData.flatbushData)
    cache.set(cellData.flatbushData, index)
  }
  return index
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
  model: VariantDisplayModel
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
  featureInfo: VariantCellData['featureGenotypeMap'][string]
  cell: HoveredCell
}

const VariantComponent = observer(function VariantComponent({
  model,
}: {
  model: VariantDisplayModel
}) {
  const [hoveredCell, setHoveredCell] = useState<HoveredCell>()
  const flatbushCacheRef = useRef(new WeakMap<ArrayBuffer, Flatbush>())
  const { classes } = useStyles()

  const { canvas, canvasRef, error, retry } = useGpuBackend(
    VariantRenderer,
    model,
  )

  const view = getContainingView(model) as LGV

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

  function getFeatureUnderMouse(
    rect: DOMRect,
    eventClientX: number,
    eventClientY: number,
  ): VariantHit | undefined {
    const cellData = model.cellData
    if (!cellData) {
      return undefined
    }
    const mouseX = eventClientX - rect.left
    const mouseY = eventClientY - rect.top

    const regions = model.visibleRegions
    const region = regions.find(
      r => mouseX >= r.screenStartPx && mouseX < r.screenEndPx,
    )
    if (!region) {
      return undefined
    }

    const regionCellData =
      cellData.perRegionCellData[region.displayedRegionIndex]
    if (!regionCellData) {
      return undefined
    }

    const flatbushIndex = buildFlatbushIndex(
      regionCellData,
      flatbushCacheRef.current,
    )

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

    if (bestIdx >= 0) {
      const featureId =
        regionCellData.featureIdList[
          regionCellData.flatbushFeatureIndices[bestIdx]!
        ]!
      const sourceName =
        regionCellData.sourceNameList[regionCellData.cellRowIndices[bestIdx]!]!
      const genomicStart = regionCellData.flatbushGenomicStarts[bestIdx]!
      const genomicEnd = regionCellData.flatbushGenomicEnds[bestIdx]!
      const info = regionCellData.featureGenotypeMap[featureId]!
      const genotype = info.genotypes[sourceName]!
      const source = model.sourceMap?.[sourceName]
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
    return undefined
  }

  const { canvasHandlers, contextMenuNode } =
    useVariantCanvasInteraction<VariantHit>({
      model,
      getHit: getFeatureUnderMouse,
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

  const width = view.trackWidthPx
  const height = model.availableHeight

  if (error) {
    return (
      <ErrorOverlay
        error={error}
        width={width}
        height={height}
        onRetry={() => {
          retry()
        }}
      />
    )
  }

  return (
    <div style={{ position: 'relative', width, height }}>
      {/* See VariantMatrixComponent.tsx for why the canvas must stay mounted
          and use visibility:'hidden' instead of conditional rendering */}
      <canvas
        ref={canvasRef}
        style={{
          width,
          height,
          position: 'absolute',
          left: 0,
          top: 0,
          visibility: model.regionTooLarge ? 'hidden' : undefined,
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
      <VariantErrorBar model={model} />
      {model.regionTooLarge ? model.regionCannotBeRendered() : null}
      <VariantLoadingOverlay model={model} />
      {contextMenuNode}
    </div>
  )
})

export default VariantComponent
