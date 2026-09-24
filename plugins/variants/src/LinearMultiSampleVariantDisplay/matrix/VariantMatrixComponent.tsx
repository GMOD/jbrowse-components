import { observer } from 'mobx-react'

import { buildVariantHit } from '../../shared/buildVariantHit.ts'
import { REFERENCE_COLOR } from '../../shared/constants.ts'
import { enrichFeatureFromClick } from '../../shared/enrichFeatureFromClick.ts'
import { decodeGenotype } from '../../shared/genotypeCodec.ts'
import { findCellIndex } from '../../shared/variantCellLookup.ts'
import { cellCarriesAlt } from '../../shared/variantCellStyles.ts'
import { variantSurfaceHandlers } from '../../shared/variantSurface.ts'
import { matrixCellAt } from './matrixHitTest.ts'

import type { VariantTooltipFields } from '../../shared/buildVariantHit.ts'
import type { VariantFeatureInfo } from '../../shared/types.ts'
import type { VariantSurface } from '../../shared/variantSurface.ts'
import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'

interface MatrixHit {
  fields: VariantTooltipFields
  featureData: VariantFeatureInfo & { featureId: string }
  /** The drawn cell's instance in the mark's channels, for `hoverInk`. */
  cell?: MatrixHoveredCell
}

export interface MatrixHoveredCell {
  cellIndex: number
}

// The instance the painter drew for a screen row's genotype, or undefined where
// the worker emitted no cell for it: a row is hoverable by its genotype (the
// walk below) and lit by its ink, and a no-call decodes to a genotype no cell
// was drawn for.
function drawnCellAt(
  model: LinearMultiSampleVariantDisplayModel,
  featureIdx: number,
  rowIdx: number,
): MatrixHoveredCell | undefined {
  const placed = model.placedMatrixData
  const workerRow = model.rowUnmap?.[rowIdx] ?? -1
  if (!placed || workerRow < 0) {
    return undefined
  }
  const cellIndex = findCellIndex(placed, featureIdx, workerRow)
  return cellIndex >= 0 ? { cellIndex } : undefined
}

// `mouseX`/`mouseY` are relative to the matrix canvas, which sits at
// `columnGeometry.left` / `rowsTopOffset` inside the display — the caller has
// already subtracted both.
function getHoveredMatrixCell(
  model: LinearMultiSampleVariantDisplayModel,
  mouseX: number,
  mouseY: number,
): MatrixHit | undefined {
  const cellData = model.cellData
  const sources = model.sources
  if (
    cellData?.mode !== 'matrix' ||
    !sources.length ||
    cellData.numFeatures === 0
  ) {
    return undefined
  }
  const { featureIdx, nearest, lowest } = matrixCellAt(
    {
      columnWidth: model.columnGeometry.columnWidth,
      effectiveRowHeight: model.effectiveRowHeight,
      scrollTop: model.scrollTop,
    },
    mouseX,
    mouseY,
  )
  const feature = cellData.featureData[featureIdx]
  if (!feature) {
    return undefined
  }
  // Read once, above the loop: this computed has no tracked reader (pointer
  // handlers run untracked), so MobX discards its value on every read and each
  // read rebuilds an O(samples) Map.
  const genotypeSampleIndex = model.genotypeSampleIndex!
  // nearest first: it is the row the cursor is in and the last one painted
  // there, so it is what the reader sees on top
  for (let rowIdx = nearest; rowIdx >= lowest; rowIdx--) {
    const source = sources[rowIdx]
    if (!source) {
      continue
    }
    const sampleName = source.sampleName
    const genotype = decodeGenotype(
      cellData.genotypeDict,
      genotypeSampleIndex,
      feature.genotypeCodes,
      sampleName,
    )
    // Against `undefined`, never truthy, as the sibling display's hit test is:
    // only `undefined` means the codes have nothing filed against this row. An
    // empty genotype string is a row that HAS one, and skipping it reports a
    // NEIGHBOURING sample against the cell under the cursor.
    if (genotype !== undefined) {
      return {
        fields: buildVariantHit({
          info: feature,
          genotype,
          sampleName,
          name: source.name,
          featureId: feature.featureId,
          // The matrix has no per-cell alt flag on hand, so it asks the same
          // question of the decoded genotype AND the row: in phased mode a
          // haplotype row either carries the allele or does not, so `1|0`
          // reports the insertion on HP0 and nothing on HP1. Matches
          // pickVariantCell's `cellAltDosage` gate, which the regular display
          // gets from the painter per cell.
          insertedBp: cellCarriesAlt(genotype, source.HP)
            ? feature.insertedBp
            : 0,
        }),
        featureData: feature,
        cell: drawnCellAt(model, featureIdx, rowIdx),
      }
    }
  }
  return undefined
}

/**
 * The matrix as a pointer surface: hover, click and right-click all resolve
 * through `getHoveredMatrixCell`.
 */
export function variantMatrixSurface(
  model: LinearMultiSampleVariantDisplayModel,
): VariantSurface<MatrixHit> {
  return {
    getHit: (x, y) => getHoveredMatrixCell(model, x, y),
    getTooltip: hit => hit.fields,
    enrich: hit => {
      const baseFeature = model.featureById(hit.fields.featureId)
      return baseFeature
        ? enrichFeatureFromClick(baseFeature, hit.featureData, hit.fields)
        : undefined
    },
    onHover: hit => {
      model.setHoveredMatrixCell(hit?.cell)
    },
  }
}

// The matrix canvas + its click targets. DisplayChrome (owned by the outer
// VariantMatrixDisplayComponent) owns the GPU backend, the terminal states and
// the pointer measurement the hover comes from, handing the live canvas down
// here.
//
// The scroll affordances are not here — they hang off the display's own box, one
// level up, outside `MatrixBodyOffset`. `canvasId` is made up there and passed
// in so the scrollbar's `aria-controls` still names this canvas.
const VariantMatrixBody = observer(function VariantMatrixBody({
  model,
  canvasRef,
  canvasId,
}: {
  model: LinearMultiSampleVariantDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  canvasId: string
}) {
  // `model.matrixWidth`, the getter `renderState` and `columnGeometry` are both
  // built from: the width the cells were mapped into, rather than a second
  // spelling of it off the view. NOT `model.renderState` itself, which also
  // carries `scrollTop` — a scroll would then re-render this body, and the
  // canvas element plus the hit-test wiring below it, once per wheel frame for
  // a width that never moved.
  const width = model.matrixWidth
  const height = model.availableHeight

  return (
    <canvas
      id={canvasId}
      role="img"
      aria-label="Variant genotype matrix"
      data-testid="variant_matrix_canvas"
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
      {...variantSurfaceHandlers(model, variantMatrixSurface(model))}
    />
  )
})

export default VariantMatrixBody
