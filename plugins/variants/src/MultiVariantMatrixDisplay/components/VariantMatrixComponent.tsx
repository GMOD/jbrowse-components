import { ErrorOverlay } from '@jbrowse/core/ui'
import {
  getBpDisplayStr,
  getContainingView,
  useGpuBackend,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { VariantMatrixRenderer } from './VariantMatrixRenderer.ts'
import { makeSimpleAltString } from '../../VcfFeature/util.ts'
import {
  VariantErrorBar,
  VariantLoadingOverlay,
} from '../../shared/components/VariantStatusOverlays.tsx'
import { REFERENCE_COLOR } from '../../shared/constants.ts'
import { enrichFeatureFromClick } from '../../shared/enrichFeatureFromClick.ts'
import { useVariantCanvasInteraction } from '../../shared/hooks/useVariantCanvasInteraction.tsx'
import { scrollbarStyles } from '../../shared/scrollbarStyles.ts'
import { useVariantVirtualScroll } from '../../shared/useVariantVirtualScroll.ts'

import type { MatrixCellData } from './computeVariantMatrixCells.ts'
import type { VariantMatrixBackend } from './variantMatrixBackendTypes.ts'
import type { VariantDisplayModelBase } from '../../shared/VariantDisplayModelInterface.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(scrollbarStyles)

export interface VariantMatrixDisplayModel extends VariantDisplayModelBase {
  cellData: MatrixCellData | undefined
  canvasDrawn: boolean
  startBackend: (backend: VariantMatrixBackend) => void
  stopBackend: () => void
  renderNow: () => void
}

interface MatrixHit {
  genotype: string
  alleles: string
  featureName: string
  description: string
  length: string
  sampleName: string
  name: string
  featureId: string
  featureData: MatrixCellData['featureData'][number]
}

const VariantMatrixComponent = observer(function VariantMatrixComponent({
  model,
}: {
  model: VariantMatrixDisplayModel
}) {
  const { classes } = useStyles()

  const { canvas, canvasRef, error, retry } = useGpuBackend(
    VariantMatrixRenderer,
    model,
  )

  const view = getContainingView(model) as LGV

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
    if (!cellData || !sources?.length || cellData.numFeatures === 0) {
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
      const sampleName = source.sampleName ?? source.name
      const genotype = feature.genotypes[sampleName]
      if (genotype) {
        return {
          genotype,
          alleles: makeSimpleAltString(genotype, feature.ref, feature.alt),
          featureName: feature.name,
          description:
            feature.alt.length >= 3
              ? 'multiple ALT alleles'
              : feature.description,
          length: getBpDisplayStr(feature.length),
          sampleName,
          name: source.name,
          featureId: feature.featureId,
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

  const width = view.totalWidthPxWithoutBorders
  const height = model.availableHeight

  if (error) {
    return (
      <ErrorOverlay
        error={error}
        width={width}
        height={height}
        onRetry={() => {
          retry()
        }}
      />
    )
  }

  return (
    <div style={{ position: 'relative', width, height }}>
      {/* The canvas must remain mounted even when regionTooLarge is true.
          The GPU renderer binds its context to this specific canvas element
          during init(). If the canvas were conditionally unmounted (e.g.
          replaced by TooLargeMessage), a new canvas would mount after
          force-load but the renderer would still reference the old unmounted
          one, causing all draw calls to go to a detached canvas. We use
          visibility:'hidden' instead so the canvas stays in the DOM and the
          renderer connection is preserved. */}
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
          visibility: model.regionTooLarge ? 'hidden' : undefined,
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
      <VariantErrorBar model={model} />
      {model.regionTooLarge ? model.regionCannotBeRendered() : null}
      <VariantLoadingOverlay model={model} />
      {contextMenuNode}
    </div>
  )
})

export default VariantMatrixComponent
