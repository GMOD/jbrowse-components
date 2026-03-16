import React, { useEffect, useRef, useState } from 'react'

import { ErrorBar, Menu } from '@jbrowse/core/ui'
import {
  getBpDisplayStr,
  getContainingView,
  useGpuRenderer,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { VariantMatrixRenderer } from './VariantMatrixRenderer.ts'
import { makeSimpleAltString } from '../../VcfFeature/util.ts'
import { enrichFeatureFromClick } from '../../shared/enrichFeatureFromClick.ts'
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
  featuresVolatile:
    | { id(): string; toJSON(): Record<string, unknown> }[]
    | undefined
  referenceDrawingMode: string
  regionTooLarge: boolean
  featuresReady: boolean
  displayError: unknown
  reload: () => void
  setFeatureDensityStatsLimit: (s?: unknown) => void
  setHoveredGenotype: (tooltip: Record<string, string> | undefined) => void
  setScrollTop: (n: number) => void
  setRowHeight: (n: number) => void
  selectFeature: (feature: { id(): string }) => void
  setContextMenuFeature: (feature?: { id(): string }) => void
  contextMenuItems: () => { label: string; onClick: () => void }[]
  retryLoadingData: () => void
  regionCannotBeRendered: () => React.ReactElement | null
}

const VariantMatrixComponent = observer(function VariantMatrixComponent({
  model,
}: {
  model: VariantMatrixDisplayModel
}) {
  const [contextMenuCoord, setContextMenuCoord] = useState<
    [number, number] | undefined
  >()
  const lastHoveredRef = useRef<string | undefined>(undefined)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { classes } = useStyles()

  const { error, ready, rendererRef, retry } = useGpuRenderer(
    canvasRef,
    VariantMatrixRenderer,
  )

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
          sampleName,
          name: source.name,
          featureId: feature.featureId,
        }
      }
    }
    return undefined
  }

  function getEnrichedFeature(
    result: NonNullable<ReturnType<typeof getFeatureUnderMouse>>,
  ) {
    const baseFeature = model.featuresVolatile?.find(
      f => f.id() === result.featureId,
    )
    if (!baseFeature) {
      return undefined
    }
    const feature = model.cellData?.featureData.find(
      f => f.featureId === result.featureId,
    )
    return enrichFeatureFromClick(baseFeature, feature, result)
  }

  const width = Math.round(view.dynamicBlocks.totalWidthPxWithoutBorders)
  const height = model.availableHeight

  if (error) {
    return (
      <div style={{ position: 'relative', width, height }}>
        <ErrorBar
          error={error}
          onRetry={() => {
            retry()
          }}
        />
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width, height }}>
      {/* The canvas must remain mounted even when regionTooLarge is true.
          useGpuRenderer binds the WebGL/WebGPU context to this specific
          canvas element during init(). If the canvas were conditionally
          unmounted (e.g. replaced by TooLargeMessage), a new canvas would
          mount after force-load but the renderer would still reference the
          old unmounted one, causing all draw calls to go to a detached
          canvas. We use visibility:'hidden' instead so the canvas stays
          in the DOM and the renderer connection is preserved. */}
      <canvas
        ref={canvasRef}
        style={{
          width,
          height,
          position: 'absolute',
          left: 0,
          top: 0,
          visibility: model.regionTooLarge ? 'hidden' : undefined,
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
              const { featureId, sampleName, ...tooltip } = result
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
          const enriched = result ? getEnrichedFeature(result) : undefined
          if (enriched) {
            model.selectFeature(enriched)
          }
        }}
        onContextMenu={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const result = getFeatureUnderMouse(rect, e.clientX, e.clientY)
          const enriched = result ? getEnrichedFeature(result) : undefined
          if (enriched) {
            e.preventDefault()
            model.setContextMenuFeature(enriched)
            setContextMenuCoord([e.clientX, e.clientY])
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
      {model.regionTooLarge ? model.regionCannotBeRendered() : null}
      {model.displayError ? (
        <ErrorBar
          error={model.displayError}
          onRetry={() => {
            model.retryLoadingData()
          }}
        />
      ) : null}
      {contextMenuCoord ? (
        <Menu
          open
          onMenuItemClick={(_, callback) => {
            callback()
            setContextMenuCoord(undefined)
          }}
          onClose={() => {
            setContextMenuCoord(undefined)
            model.setContextMenuFeature(undefined)
          }}
          anchorReference="anchorPosition"
          anchorPosition={{
            top: contextMenuCoord[1],
            left: contextMenuCoord[0],
          }}
          menuItems={model.contextMenuItems()}
        />
      ) : null}
    </div>
  )
})

export default VariantMatrixComponent
