import { observer } from 'mobx-react'

import { buildVariantHit } from '../../shared/buildVariantHit.ts'
import { REFERENCE_COLOR } from '../../shared/constants.ts'
import { enrichFeatureFromClick } from '../../shared/enrichFeatureFromClick.ts'
import { decodeGenotype } from '../../shared/genotypeCodec.ts'
import { useVariantVirtualScroll } from '../../shared/useVariantVirtualScroll.ts'
import { variantSurfaceHandlers } from '../../shared/variantSurface.ts'
import { matrixCellAt } from './matrixHitTest.ts'

import type { VariantTooltipFields } from '../../shared/buildVariantHit.ts'
import type { VariantFeatureInfo } from '../../shared/types.ts'
import type { VariantSurface } from '../../shared/variantSurface.ts'
import type { LinearMultiSampleVariantMatrixDisplayModel } from '../model.ts'

interface MatrixHit {
  fields: VariantTooltipFields
  featureData: VariantFeatureInfo & { featureId: string }
}

// `mouseX`/`mouseY` are relative to the matrix canvas, which sits at
// `columnGeometry.left` / `rowsTopOffset` inside the display — the caller has
// already subtracted both.
function getHoveredMatrixCell(
  model: LinearMultiSampleVariantMatrixDisplayModel,
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
    if (genotype) {
      return {
        fields: buildVariantHit({
          info: feature,
          genotype,
          sampleName,
          name: source.name,
          featureId: feature.featureId,
          // the matrix has no per-cell alt flag on hand, so derive it from the
          // decoded genotype: only a sample carrying the alt reports the
          // record's inserted bp, matching pickVariantCell's cellAltDosage gate
          insertedBp: /[1-9]/.test(genotype) ? feature.insertedBp : 0,
        }),
        featureData: feature,
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
  model: LinearMultiSampleVariantMatrixDisplayModel,
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
  canvas,
  canvasId,
}: {
  model: LinearMultiSampleVariantMatrixDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  canvas: HTMLCanvasElement | null
  canvasId: string
}) {
  // `model.canvasWidth`, the getter `renderState` and `columnGeometry` are both
  // built from: the width the cells were mapped into, rather than a second
  // spelling of it off the view. NOT `model.renderState` itself, which also
  // carries `scrollTop` — a scroll would then re-render this body, and the
  // canvas element plus the hit-test wiring below it, once per wheel frame for
  // a width that never moved.
  const width = model.canvasWidth
  const height = model.availableHeight

  useVariantVirtualScroll(canvas, model)

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
