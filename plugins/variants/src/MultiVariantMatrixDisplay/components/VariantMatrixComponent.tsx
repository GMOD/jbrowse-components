import { useEffect, useRef, useState } from 'react'

import { ErrorBar } from '@jbrowse/core/ui'
import { getBpDisplayStr, getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { VariantMatrixRenderer } from './VariantMatrixRenderer.ts'
import { makeSimpleAltString } from '../../VcfFeature/util.ts'
import LoadingOverlay from '../../shared/components/LoadingOverlay.tsx'
import { useVariantVirtualScroll } from '../../shared/useVariantVirtualScroll.ts'

import type { MatrixCellData } from './computeVariantMatrixCells.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  scrollbarTrack: {
    position: 'absolute' as const,
    right: 0,
    width: 12,
    cursor: 'default',
    zIndex: 10,
    '&:hover > *': {
      background: 'rgba(0,0,0,0.55)',
    },
  },
  scrollbarThumb: {
    position: 'absolute' as const,
    right: 2,
    width: 6,
    borderRadius: 3,
    background: 'rgba(0,0,0,0.3)',
    pointerEvents: 'none' as const,
  },
})

export interface VariantMatrixDisplayModel {
  cellData: MatrixCellData | undefined
  availableHeight: number
  rowHeight: number
  scrollTop: number
  totalHeight: number
  nrow: number
  sources: { name: string; baseName?: string }[] | undefined
  featuresVolatile: { id(): string }[] | undefined
  referenceDrawingMode: string
  regionTooLarge: boolean
  regionTooLargeReason: string
  featuresReady: boolean
  cellDataLoading: boolean
  statusMessage?: string
  displayError: unknown
  setFeatureDensityStatsLimit: (s?: unknown) => void
  setHoveredGenotype: (tooltip: Record<string, string> | undefined) => void
  setScrollTop: (n: number) => void
  setRowHeight: (n: number) => void
  selectFeature: (feature: { id(): string }) => void
  setContextMenuFeature: (feature?: { id(): string }) => void
  retryLoadingData: () => void
}

const VariantMatrixComponent = observer(function VariantMatrixComponent({
  model,
}: {
  model: VariantMatrixDisplayModel
}) {
  const [error, setError] = useState<unknown>(null)
  const [ready, setReady] = useState(false)
  const rendererRef = useRef<VariantMatrixRenderer | null>(null)
  const lastHoveredRef = useRef<string | undefined>(undefined)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { classes } = useStyles()

  const view = getContainingView(model) as LGV

  const { hasOverflow, thumbHeight, thumbTop, handleScrollbarMouseDown } =
    useVariantVirtualScroll({
      canvasRef,
      scrollTop: model.scrollTop,
      setScrollTop: model.setScrollTop,
      totalHeight: model.totalHeight,
      viewportHeight: model.availableHeight,
      scrollZoom: view.scrollZoom,
      rowHeight: model.rowHeight,
      nrow: model.nrow,
      setRowHeight: model.setRowHeight,
    })

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !ready) {
      return
    }

    let lastCellData: MatrixCellData | null = null
    return autorun(() => {
      if (!view.initialized) {
        return
      }
      const cellData = model.cellData
      if (!cellData) {
        lastCellData = null
        return
      }

      if (lastCellData !== cellData) {
        lastCellData = cellData
        renderer.uploadCellData(cellData)
      }

      renderer.render({
        canvasWidth: Math.round(view.dynamicBlocks.totalWidthPxWithoutBorders),
        canvasHeight: model.availableHeight,
        rowHeight: model.rowHeight,
        scrollTop: model.scrollTop,
        numFeatures: cellData.numFeatures,
      })
    })
  }, [model, view, ready])

  function getFeatureUnderMouse(
    rect: DOMRect,
    eventClientX: number,
    eventClientY: number,
  ) {
    const cellData = model.cellData
    const sources = model.sources
    if (!cellData || !sources?.length || cellData.numFeatures === 0) {
      return undefined
    }
    const w = Math.round(view.dynamicBlocks.totalWidthPxWithoutBorders)
    const mouseX = eventClientX - rect.left
    const mouseY = eventClientY - rect.top

    const featureIdx = Math.floor((mouseX / w) * cellData.numFeatures)
    const rowIdx = Math.floor((mouseY + model.scrollTop) / model.rowHeight)
    const source = sources[rowIdx]
    const feature = cellData.featureData[featureIdx]
    if (source && feature) {
      const sampleName = source.baseName ?? source.name
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
          name: source.name,
          featureId: feature.featureId,
        }
      }
    }
    return undefined
  }

  const width = Math.round(view.dynamicBlocks.totalWidthPxWithoutBorders)
  const height = model.availableHeight

  if (error) {
    return (
      <div style={{ width, height, color: 'red', padding: 10 }}>
        GPU Error: {`${error}`}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvas => {
          canvasRef.current = canvas
          if (!canvas) {
            return
          }
          if (!rendererRef.current) {
            const renderer = VariantMatrixRenderer.getOrCreate(canvas)
            rendererRef.current = renderer
            renderer
              .init()
              .then(ok => {
                if (!ok) {
                  setError(new Error('GPU initialization failed'))
                } else {
                  setReady(true)
                }
              })
              .catch((e: unknown) => {
                setError(e)
              })
          }
        }}
        style={{
          width,
          height,
          position: 'absolute',
          left: 0,
          top: 0,
          backgroundColor:
            model.referenceDrawingMode === 'skip' ? '#ccc' : undefined,
        }}
        width={width}
        height={height}
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const result = getFeatureUnderMouse(rect, e.clientX, e.clientY)
          const key = result
            ? `${result.name}:${result.genotype}:${result.featureId}`
            : undefined
          if (key !== lastHoveredRef.current) {
            lastHoveredRef.current = key
            if (result) {
              const { featureId, ...tooltip } = result
              model.setHoveredGenotype(tooltip)
            } else {
              model.setHoveredGenotype(undefined)
            }
          }
        }}
        onMouseLeave={() => {
          if (lastHoveredRef.current !== undefined) {
            lastHoveredRef.current = undefined
            model.setHoveredGenotype(undefined)
          }
        }}
        onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const result = getFeatureUnderMouse(rect, e.clientX, e.clientY)
          const feature = result
            ? model.featuresVolatile?.find(f => f.id() === result.featureId)
            : undefined
          if (feature) {
            model.selectFeature(feature)
          }
        }}
        onContextMenu={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const result = getFeatureUnderMouse(rect, e.clientX, e.clientY)
          const feature = result
            ? model.featuresVolatile?.find(f => f.id() === result.featureId)
            : undefined
          if (feature) {
            model.setContextMenuFeature(feature)
          }
        }}
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
      <LoadingOverlay
        statusMessage={
          model.regionTooLarge
            ? model.regionTooLargeReason
            : model.statusMessage || 'Computing display data'
        }
        isVisible={
          !model.displayError &&
          (!model.cellData || model.cellDataLoading || model.regionTooLarge)
        }
      />
      {model.displayError ? (
        <ErrorBar
          error={model.displayError}
          onRetry={() => {
            model.retryLoadingData()
          }}
        />
      ) : null}
    </div>
  )
})

export default VariantMatrixComponent
