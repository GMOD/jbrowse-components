import { pxPerBpOf, regionAtPixel } from '@jbrowse/render-core/canvas2dUtils'
import { observer } from 'mobx-react'

import { buildVariantHit } from '../../shared/buildVariantHit.ts'
import { REFERENCE_COLOR } from '../../shared/constants.ts'
import { enrichFeatureFromClick } from '../../shared/enrichFeatureFromClick.ts'
import { decodeGenotype } from '../../shared/genotypeCodec.ts'
import { variantSurfaceHandlers } from '../../shared/variantSurface.ts'
import VariantInsertionLabels from './VariantInsertionLabels.tsx'
import { pickVariantCell } from './pickVariantCell.ts'
import { computeVariantHitQuery } from './variantHitTest.ts'

import type { VariantTooltipFields } from '../../shared/buildVariantHit.ts'
import type { VariantFeatureInfo } from '../../shared/types.ts'
import type { VariantSurface } from '../../shared/variantSurface.ts'
import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'

export interface HoveredCell {
  cellIndex: number
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

// `mouseX`/`mouseY` are relative to the rows canvas, which sits at
// `rowsTopOffset` inside the display — the caller has already subtracted it.
function getHoveredFeature(
  model: LinearMultiSampleVariantDisplayModel,
  mouseX: number,
  mouseY: number,
): VariantHit | undefined {
  const { cellData } = model
  if (!cellData) {
    return undefined
  }

  const region = regionAtPixel(model.host.visibleRegions, mouseX)
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

  const picked = pickVariantCell({
    data: regionCellData,
    block: { ...region, reversed: region.reversed ?? false },
    state: model.renderState,
    candidateFeatures,
    mouseX,
    mouseY,
    rowNearest,
    rowLowest,
    rowUnmap,
    // sizes the insertion marker's click target, so it is the same
    // `pxPerBpOf` the draw pass sized the drawn marker with
    pxPerBp: pxPerBpOf(region),
    insertionsWiden: model.showInsertionGlyphs,
  })
  if (!picked) {
    return undefined
  }

  const { rowIndex, cellIndex, genomicStart, genomicEnd, insertedBp } = picked
  const info = regionCellData.featureInfo[picked.featureIndex]!
  const { featureId } = info
  // The cell row index maps directly into model.sources (same effectiveSources
  // ordering used to compute the cells), so no per-region sourceNameList is
  // shipped over RPC.
  const source = model.sources[rowIndex]
  if (!source) {
    return undefined
  }
  const genotype = decodeGenotype(
    cellData.genotypeDict,
    model.genotypeSampleIndex!,
    info.genotypeCodes,
    source.sampleName,
  )
  // a row named outside the payload's sample order decodes to nothing
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
      insertedBp,
      displayedRegionIndex: region.displayedRegionIndex,
    }),
    featureInfo: info,
    cell: {
      cellIndex,
      genomicStart,
      genomicEnd,
      insertedBp,
      displayedRegionIndex: region.displayedRegionIndex,
    },
  }
}

/**
 * The genotype rows as a pointer surface: hover, click and right-click all
 * resolve through `getHoveredFeature`, so the tooltip, the widget and the menu
 * cannot name different cells.
 */
export function variantRowsSurface(
  model: LinearMultiSampleVariantDisplayModel,
): VariantSurface<VariantHit> {
  return {
    getHit: (x, y) => getHoveredFeature(model, x, y),
    getTooltip: hit => hit.fields,
    enrich: hit => {
      const baseFeature = model.featureById(hit.fields.featureId)
      return baseFeature
        ? enrichFeatureFromClick(baseFeature, hit.featureInfo, hit.fields)
        : undefined
    },
    onHover: hit => {
      model.setHoveredCell(hit?.cell)
      model.setHoveredLaneMark(undefined)
    },
  }
}

// The per-sample variant canvas + its click targets. DisplayChrome owns the GPU
// backend, the terminal states and the pointer measurement the hover comes
// from, handing the live canvas down here. Scroll is virtual: a fixed canvas,
// everything positioned from `model.scrollTop`, and the scroll affordances on
// the `RowsPanel` around this.
const VariantBody = observer(function VariantBody({
  model,
  canvasRef,
}: {
  model: LinearMultiSampleVariantDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
}) {
  // `canvasWidthPx`, not a second `view.trackWidthPx` read: it is the width
  // `renderState.canvasWidth` carries, so the canvas below and every overlay
  // beside it sit in the box the cells were actually mapped into. The getter
  // exists to be the one answer — reading the view directly is how MAF drifted
  // onto `view.width` (see MultiRegionDisplayMixin.canvasWidthPx).
  const width = model.canvasWidthPx

  return (
    <>
      <canvas
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
        {...variantSurfaceHandlers(model, variantRowsSurface(model))}
      />
      <VariantInsertionLabels model={model} />
    </>
  )
})

export default VariantBody
