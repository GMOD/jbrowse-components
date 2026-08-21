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
import { matrixCellAt } from './matrixHitTest.ts'

import type { VariantTooltipFields } from '../../shared/buildVariantHit.ts'
import type { VariantFeatureInfo } from '../../shared/types.ts'
import type { LinearMultiSampleVariantMatrixDisplayModel } from '../model.ts'

interface MatrixHit {
  fields: VariantTooltipFields
  featureData: VariantFeatureInfo & { featureId: string }
}

// The matrix canvas + hit-test wiring. DisplayChrome (owned by the outer
// VariantMatrixDisplayComponent) owns the GPU backend and the terminal states,
// handing the live canvas down here.
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

  const getHit = (
    rect: DOMRect,
    clientX: number,
    clientY: number,
  ): MatrixHit | undefined => {
    const cellData = model.cellData
    const sources = model.sources
    if (
      cellData?.mode !== 'matrix' ||
      !sources.length ||
      cellData.numFeatures === 0
    ) {
      return undefined
    }
    // `rect` is the canvas, which already sits at columnGeometry.left, so the
    // mouse is canvas-relative and the origin must not be subtracted again.
    const { featureIdx, nearest, lowest } = matrixCellAt(
      {
        columnWidth: model.columnGeometry.columnWidth,
        effectiveRowHeight: model.effectiveRowHeight,
        scrollTop: model.scrollTop,
      },
      clientX - rect.left,
      clientY - rect.top,
    )
    const feature = cellData.featureData[featureIdx]
    if (!feature) {
      return undefined
    }
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
        model.genotypeSampleIndex!,
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
          }),
          featureData: feature,
        }
      }
    }
    return undefined
  }

  const { canvasHandlers, contextMenuNode } =
    useVariantCanvasInteraction<MatrixHit>({
      model,
      getHit,
      getKey: hit => variantTooltipKey(hit.fields),
      getTooltip: hit => hit.fields,
      enrich: hit => {
        const baseFeature = model.featuresVolatile?.find(
          f => f.id() === hit.fields.featureId,
        )
        return baseFeature
          ? enrichFeatureFromClick(baseFeature, hit.featureData, hit.fields)
          : undefined
      },
    })

  return (
    <>
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
        {...canvasHandlers}
      />
      {contextMenuNode}
    </>
  )
})

export default VariantMatrixBody
