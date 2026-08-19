import { useState } from 'react'

import { hoverBoxStyle } from '@jbrowse/core/ui'
import {
  makeBpMapper,
  pxPerBpOf,
  regionAtPixel,
} from '@jbrowse/render-core/canvas2dUtils'
import { observer } from 'mobx-react'

import {
  buildVariantHit,
  variantTooltipKey,
} from '../../shared/buildVariantHit.ts'
import { REFERENCE_COLOR } from '../../shared/constants.ts'
import { enrichFeatureFromClick } from '../../shared/enrichFeatureFromClick.ts'
import { decodeGenotype } from '../../shared/genotypeCodec.ts'
import { useVariantCanvasInteraction } from '../../shared/hooks/useVariantCanvasInteraction.tsx'
import { useVariantVirtualScroll } from '../../shared/useVariantVirtualScroll.ts'
import VariantInsertionGlyphOverlay from './VariantInsertionGlyphOverlay.tsx'
import { pickVariantCell } from './pickVariantCell.ts'
import { drawnCellHeightPx } from './shaders/variant.js.generated.ts'
import { variantCellSpanPx } from './variantCellSpan.ts'
import { computeVariantHitQuery } from './variantHitTest.ts'

import type { VariantTooltipFields } from '../../shared/buildVariantHit.ts'
import type { VariantFeatureInfo } from '../../shared/types.ts'
import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'

interface HoveredCell {
  rowIndex: number
  genomicStart: number
  genomicEnd: number
  // bp this cell's record inserts; widens the drawn cell to an insertion marker,
  // so the highlight has to widen with it (see variantCellSpan.ts). 0 for
  // everything else.
  insertedBp: number
  displayedRegionIndex: number
}

interface VariantHit {
  fields: VariantTooltipFields
  featureInfo: VariantFeatureInfo
  cell: HoveredCell
}

function getHoveredFeature(
  model: LinearMultiSampleVariantDisplayModel,
  rect: DOMRect,
  eventClientX: number,
  eventClientY: number,
): VariantHit | undefined {
  const { cellData } = model
  if (!cellData) {
    return undefined
  }
  const mouseX = eventClientX - rect.left
  const mouseY = eventClientY - rect.top

  const region = regionAtPixel(model.visibleRegions, mouseX)
  if (!region) {
    return undefined
  }

  // Through perRegionCellMap, the model's one walk of the payload, rather than
  // indexing perRegionCellData again here — that second path could see a
  // region set the canvas and the glyph overlay did not.
  const regionCellData = model.perRegionCellMap.get(region.displayedRegionIndex)
  const featureIndex = model.featureIndices.get(region.displayedRegionIndex)
  const { rowUnmap } = model
  if (!regionCellData || !featureIndex || !rowUnmap) {
    return undefined
  }

  const { genomicPos, rowNearest, rowLowest, bpPadding } =
    computeVariantHitQuery(
      region,
      mouseX,
      mouseY,
      model.scrollTop,
      model.effectiveRowHeight,
    )
  // x only: the index holds one interval per feature ([start, 0, end, 1]), so
  // the row half of the query is resolved arithmetically instead.
  const candidateFeatures = featureIndex.search(
    genomicPos - bpPadding,
    0,
    genomicPos + bpPadding,
    1,
  )

  const toX = makeBpMapper(region)
  const picked = pickVariantCell({
    data: regionCellData,
    candidateFeatures,
    mouseX,
    rowNearest,
    rowLowest,
    rowUnmap,
    toX,
    // sizes the insertion marker's click target, so it is the same
    // `pxPerBpOf` the draw pass sized the drawn marker with
    pxPerBp: pxPerBpOf(region),
    canvasWidth: model.canvasWidthPx,
    drawnRowHeight: drawnCellHeightPx(model.effectiveRowHeight),
    insertionsWiden: model.showInsertionGlyphs,
  })
  if (!picked) {
    return undefined
  }

  const { rowIndex, genomicStart, genomicEnd, insertedBp } = picked
  const featureId = regionCellData.featureIdList[picked.featureIndex]!
  // The cell row index maps directly into model.sources (same effectiveSources
  // ordering used to compute the cells), so no per-region sourceNameList is
  // shipped over RPC.
  const source = model.sources[rowIndex]
  if (!source) {
    return undefined
  }
  const info = regionCellData.featureGenotypeMap[featureId]!
  const genotype = decodeGenotype(
    cellData.genotypeDict,
    model.genotypeSampleIndex!,
    info.genotypeCodes,
    source.sampleName,
  )
  // No tooltip rather than a crash when the code doesn't decode — the same
  // answer the matrix display's hit test already gives. A drawn cell implies a
  // genotype, so this should not happen, but `makeSimpleAltString` would split
  // undefined if it ever did: the hover reads a sample name off the row while
  // the codes are addressed by the payload's own sample order, and a row whose
  // name is absent from that order decodes to nothing.
  if (genotype === undefined) {
    return undefined
  }
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
      insertedBp,
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
  // The 2px floor every painter applies, read from the shader's own generated
  // twin (shaders/variant.slang, adr-051) rather than restated — the box has to
  // be the size the cell was drawn at, not the size a row nominally occupies,
  // or a sub-pixel row highlights as an invisible sliver over a 2px cell.
  const drawnRowHeight = drawnCellHeightPx(model.effectiveRowHeight)
  // Same drawn extent the cell painted, so the box lands on an insertion marker
  // rather than the ~1bp reference span underneath it.
  const { left, width } = variantCellSpanPx({
    x1: toX(cell.genomicStart),
    x2: toX(cell.genomicEnd),
    canvasWidth: model.canvasWidthPx,
    insertedBp: cell.insertedBp,
    // the box covers what was PAINTED, so it follows the setting that decides
    // whether an insertion paints as a marker or as a 2px cell
    insertionsWiden: model.showInsertionGlyphs,
    pxPerBp: pxPerBpOf(region),
    drawnRowHeight,
  })
  // Screen Y from model.scrollTop — the same value the GPU cells draw at, so
  // the highlight can't diverge from its cell (virtual scroll: one scroll
  // source). Cull when the row is fully outside the viewport.
  const top = cell.rowIndex * model.effectiveRowHeight - model.scrollTop
  if (top + drawnRowHeight < 0 || top > model.availableHeight) {
    return null
  }
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height: drawnRowHeight,
        ...hoverBoxStyle,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  )
})

// The per-sample variant canvas + hit-test wiring. DisplayChrome (owned by the
// outer VariantDisplayComponent) owns the GPU backend and the terminal states,
// handing the live canvas down here. Scroll is virtual (fixed canvas +
// VerticalScrollbar overlay, everything positioned from model.scrollTop) — no
// native overflow container, so the GPU cells and the DOM hover highlight share
// one scroll source and can never tear apart.
//
// The scroll affordances themselves are NOT here: they hang off the display's
// own box, one level up. `canvasId` is therefore made up there too and passed
// in, so the scrollbar's `aria-controls` still names this canvas.
const VariantBody = observer(function VariantBody({
  model,
  canvasRef,
  canvas,
  canvasId,
}: {
  model: LinearMultiSampleVariantDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  canvas: HTMLCanvasElement | null
  canvasId: string
}) {
  const [hoveredCell, setHoveredCell] = useState<HoveredCell>()

  // `canvasWidthPx`, not a second `view.trackWidthPx` read: it is the width
  // `renderState.canvasWidth` carries, so the canvas below and every overlay
  // beside it sit in the box the cells were actually mapped into. The getter
  // exists to be the one answer — reading the view directly is how MAF drifted
  // onto `view.width` (see MultiRegionDisplayMixin.canvasWidthPx).
  const width = model.canvasWidthPx

  useVariantVirtualScroll(canvas, model)

  const { canvasHandlers, contextMenuNode } =
    useVariantCanvasInteraction<VariantHit>({
      model,
      getHit: (rect, x, y) => getHoveredFeature(model, rect, x, y),
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
      <VariantInsertionGlyphOverlay model={model} />
      {hoveredCell ? (
        <HoveredCellHighlight cell={hoveredCell} model={model} />
      ) : null}
      {contextMenuNode}
    </>
  )
})

export default VariantBody
