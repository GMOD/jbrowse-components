import { observer } from 'mobx-react'

import { buildVariantHit } from '../../shared/buildVariantHit.ts'
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

// The row whose cell paints on top of the pixel. Rows thinner than a pixel
// share one, and cells paint in index order, reference bucket first, so the
// largest index among them is the one the reader sees.
function topDrawnCell(
  model: LinearMultiSampleVariantDisplayModel,
  featureIdx: number,
  lowest: number,
  nearest: number,
) {
  const placed = model.placedMatrixData
  const rowUnmap = model.rowUnmap
  let top: { rowIdx: number; cellIndex: number } | undefined
  if (placed && rowUnmap) {
    for (let rowIdx = lowest; rowIdx <= nearest; rowIdx++) {
      const workerRow = rowUnmap[rowIdx] ?? -1
      const cellIndex =
        workerRow < 0 ? -1 : findCellIndex(placed, featureIdx, workerRow)
      if (cellIndex > (top?.cellIndex ?? -1)) {
        top = { rowIdx, cellIndex }
      }
    }
  }
  return top
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
  const top = topDrawnCell(model, featureIdx, lowest, nearest)
  const source = top && sources[top.rowIdx]
  if (!top || !source) {
    return undefined
  }
  const { sampleName } = source
  const genotype = decodeGenotype(
    cellData.genotypeDict,
    model.genotypeSampleIndex!,
    feature.genotypeCodes,
    sampleName,
  )
  return genotype === undefined
    ? undefined
    : {
        fields: buildVariantHit({
          info: feature,
          genotype,
          sampleName,
          name: source.name,
          featureId: feature.featureId,
          // no per-cell alt flag here, so the decoded genotype and the row
          // answer it: in phased mode `1|0` carries the insertion on HP0 only
          insertedBp: cellCarriesAlt(genotype, source.HP)
            ? feature.insertedBp
            : 0,
        }),
        featureData: feature,
        cell: { cellIndex: top.cellIndex },
      }
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
      }}
      {...variantSurfaceHandlers(model, variantMatrixSurface(model))}
    />
  )
})

export default VariantMatrixBody
