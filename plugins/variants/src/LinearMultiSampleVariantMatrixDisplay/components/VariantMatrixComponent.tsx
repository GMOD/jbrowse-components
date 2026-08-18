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
    // same column pitch the canvas and the connector lines lay out on. `rect` is
    // the canvas, which already sits at columnGeometry.left, so mouseX is
    // canvas-relative and the origin must not be subtracted again here.
    const { columnWidth } = model.columnGeometry
    const mouseX = clientX - rect.left
    const mouseY = clientY - rect.top
    // screen column and data index are the same number (orderByScreenPosition)
    const featureIdx = Math.floor(mouseX / columnWidth)
    const rowIdx = Math.floor(
      (mouseY + model.scrollTop) / model.effectiveRowHeight,
    )
    const source = sources[rowIdx]
    const feature = cellData.featureData[featureIdx]
    if (source && feature) {
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
