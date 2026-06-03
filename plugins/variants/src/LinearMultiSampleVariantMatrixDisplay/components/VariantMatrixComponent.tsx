import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { buildVariantHit } from '../../shared/buildVariantHit.ts'
import { REFERENCE_COLOR } from '../../shared/constants.ts'
import { enrichFeatureFromClick } from '../../shared/enrichFeatureFromClick.ts'
import { useVariantCanvasInteraction } from '../../shared/hooks/useVariantCanvasInteraction.tsx'
import { scrollbarStyles } from '../../shared/scrollbarStyles.ts'
import { useVariantVirtualScroll } from '../../shared/useVariantVirtualScroll.ts'

import type { MatrixCellData } from './computeVariantMatrixCells.ts'
import type { VariantTooltipFields } from '../../shared/buildVariantHit.ts'
import type { LinearMultiSampleVariantMatrixDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(scrollbarStyles)

interface MatrixHit extends VariantTooltipFields {
  featureData: MatrixCellData['featureData'][number]
}

// The matrix canvas + scrollbar + hit-test wiring. DisplayChrome (owned by the
// outer VariantMatrixDisplayComponent) owns the GPU backend and the terminal
// states, handing the live canvas down here.
const VariantMatrixBody = observer(function VariantMatrixBody({
  model,
  canvasRef,
  canvas,
}: {
  model: LinearMultiSampleVariantMatrixDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  canvas: HTMLCanvasElement | null
}) {
  const { classes } = useStyles()
  const view = getContainingView(model) as LGV
  const width = view.totalWidthPxWithoutBorders
  const height = model.availableHeight

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

  const getHit = (
    rect: DOMRect,
    clientX: number,
    clientY: number,
  ): MatrixHit | undefined => {
    const cellData = model.cellData
    const sources = model.sources
    if (
      cellData?.mode !== 'matrix' ||
      !sources?.length ||
      cellData.numFeatures === 0
    ) {
      return undefined
    }
    const w = view.totalWidthPxWithoutBorders
    const mouseX = clientX - rect.left
    const mouseY = clientY - rect.top
    const featureIdx = Math.floor((mouseX / w) * cellData.numFeatures)
    const rowIdx = Math.floor((mouseY + model.scrollTop) / model.rowHeight)
    const source = sources[rowIdx]
    const feature = cellData.featureData[featureIdx]
    if (source && feature) {
      const sampleName = source.sampleName
      const genotype = feature.genotypes[sampleName]
      if (genotype) {
        return {
          ...buildVariantHit({
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
      getTooltip: hit => {
        const { featureId, sampleName, featureData, ...tooltip } = hit
        return tooltip
      },
      enrich: hit => {
        const baseFeature = model.featuresVolatile?.find(
          f => f.id() === hit.featureId,
        )
        return baseFeature
          ? enrichFeatureFromClick(baseFeature, hit.featureData, hit)
          : undefined
      },
    })

  return (
    <>
      <canvas
        data-testid={
          model.canvasDrawn
            ? 'variant_matrix_canvas_done'
            : 'variant_matrix_canvas'
        }
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
      {contextMenuNode}
    </>
  )
})

export default VariantMatrixBody
