import { useRef, useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { ScrollLockedOverlay } from '@jbrowse/render-core/ScrollLockedOverlay'
import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'
import { observer } from 'mobx-react'

import { computeVariantHitQuery } from './variantHitTest.ts'
import { buildVariantHit } from '../../shared/buildVariantHit.ts'
import { REFERENCE_COLOR } from '../../shared/constants.ts'
import { enrichFeatureFromClick } from '../../shared/enrichFeatureFromClick.ts'
import { decodeGenotype } from '../../shared/genotypeCodec.ts'
import { useVariantCanvasInteraction } from '../../shared/hooks/useVariantCanvasInteraction.tsx'
import { useVariantNativeScroll } from '../../shared/useVariantNativeScroll.ts'

import type { VariantTooltipFields } from '../../shared/buildVariantHit.ts'
import type { VariantFeatureInfo } from '../../shared/types.ts'
import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  // sticky-canvas + tall-spacer native scroll, mirroring the canvas feature
  // display (FeatureComponent.tsx): the content div grows to totalHeight and
  // scrolls natively while the canvas stays pinned and redraws at scrollTop
  scrollContainer: {
    position: 'absolute',
    inset: 0,
    overflowX: 'hidden',
  },
  content: {
    position: 'relative',
    minHeight: '100%',
  },
  canvas: {
    display: 'block',
    position: 'sticky',
    top: 0,
  },
})

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

  const { genomicPos, rowLo, rowHi, bpPadding } = computeVariantHitQuery(
    region,
    mouseX,
    mouseY,
    model.scrollTop,
    model.effectiveRowHeight,
  )
  const hits = flatbushIndex.search(
    genomicPos - bpPadding,
    rowLo,
    genomicPos + bpPadding,
    rowHi,
  )

  // Pick the shortest feature so a small variant atop a large one stays
  // selectable.
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
  // raw row coords: the enclosing ScrollLockedOverlay applies the -scrollTop
  // shift (tracking model.scrollTop like the GPU), so no subtraction here
  const top = cell.rowIndex * model.effectiveRowHeight
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: Math.max(right - left, 2),
        height: model.effectiveRowHeight,
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
}: {
  model: LinearMultiSampleVariantDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
}) {
  const [hoveredCell, setHoveredCell] = useState<HoveredCell>()
  const { classes } = useStyles()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const view = getContainingView(model) as LGV
  const width = view.trackWidthPx

  useVariantNativeScroll(scrollContainerRef, model, view)

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
      <div
        ref={scrollContainerRef}
        className={classes.scrollContainer}
        style={{ overflowY: model.hasOverflow ? 'auto' : 'hidden' }}
      >
        <div
          className={classes.content}
          style={{ height: model.hasOverflow ? model.totalHeight : '100%' }}
        >
          <canvas
            data-testid="variant_canvas"
            ref={canvasRef}
            className={classes.canvas}
            style={{
              width,
              height: model.availableHeight,
              backgroundColor:
                model.referenceDrawingMode === 'skip'
                  ? REFERENCE_COLOR
                  : undefined,
            }}
            {...canvasHandlers}
          />
          {hoveredCell ? (
            <ScrollLockedOverlay
              scrollTop={model.scrollTop}
              viewportHeight={model.availableHeight}
              contentHeight={
                model.hasOverflow ? model.totalHeight : model.availableHeight
              }
            >
              <HoveredCellHighlight cell={hoveredCell} model={model} />
            </ScrollLockedOverlay>
          ) : null}
        </div>
      </div>
      {contextMenuNode}
    </>
  )
})

export default VariantBody
