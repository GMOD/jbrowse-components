import { useId, useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'
import { observer } from 'mobx-react'

import {
  buildVariantHit,
  variantTooltipKey,
} from '../../shared/buildVariantHit.ts'
import VariantScrollbar from '../../shared/components/VariantScrollbar.tsx'
import { REFERENCE_COLOR } from '../../shared/constants.ts'
import { enrichFeatureFromClick } from '../../shared/enrichFeatureFromClick.ts'
import { decodeGenotype } from '../../shared/genotypeCodec.ts'
import { useVariantCanvasInteraction } from '../../shared/hooks/useVariantCanvasInteraction.tsx'
import { useVariantVirtualScroll } from '../../shared/useVariantVirtualScroll.ts'
import { computeVariantHitQuery } from './variantHitTest.ts'

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

interface VariantHit {
  fields: VariantTooltipFields
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
    fields: buildVariantHit({
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
  cell: HoveredCell
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
  // Screen Y from model.scrollTop — the same value the GPU cells draw at, so
  // the highlight can't diverge from its cell (virtual scroll: one scroll
  // source). Cull when the row is fully outside the viewport.
  const top = cell.rowIndex * model.effectiveRowHeight - model.scrollTop
  if (top + model.effectiveRowHeight < 0 || top > model.availableHeight) {
    return null
  }
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
// (owned by the outer VariantDisplayComponent) owns the GPU backend and the
// terminal states, handing the live canvas down here. Scroll is virtual (fixed
// canvas + VerticalScrollbar overlay, everything positioned from
// model.scrollTop) — no native overflow container, so the GPU cells and the DOM
// hover highlight share one scroll source and can never tear apart.
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
  const canvasId = useId()

  useVariantVirtualScroll(canvas, model)

  const { canvasHandlers, contextMenuNode } =
    useVariantCanvasInteraction<VariantHit>({
      model,
      getHit: (rect, x, y) => getFeatureUnderMouse(model, rect, x, y),
      getKey: hit => variantTooltipKey(hit.fields),
      getTooltip: hit => hit.fields,
      enrich: hit => {
        const baseFeature = model.featuresVolatile?.find(
          f => f.id() === hit.fields.featureId,
        )
        return baseFeature
          ? enrichFeatureFromClick(baseFeature, hit.featureInfo, hit.fields)
          : undefined
      },
      onHoverChange: hit => {
        setHoveredCell(hit?.cell)
      },
    })

  return (
    <>
      <canvas
        id={canvasId}
        role="img"
        aria-label="Variant genotypes"
        data-testid="variant_canvas"
        ref={canvasRef}
        style={{
          width,
          height: model.availableHeight,
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
      <VariantScrollbar model={model} controlsId={canvasId} />
      {contextMenuNode}
    </>
  )
})

export default VariantBody
