import React, { useEffect, useEffectEvent, useRef, useState } from 'react'

import { ErrorBar, ErrorOverlay, Menu } from '@jbrowse/core/ui'
import {
  getBpDisplayStr,
  getContainingView,
  useGpuRenderer,
  useTabVisibilityRerender,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { VariantMatrixRenderer } from './VariantMatrixRenderer.ts'
import { makeSimpleAltString } from '../../VcfFeature/util.ts'
import { enrichFeatureFromClick } from '../../shared/enrichFeatureFromClick.ts'
import { scrollbarStyles } from '../../shared/scrollbarStyles.ts'
import { useVariantVirtualScroll } from '../../shared/useVariantVirtualScroll.ts'

import type { MatrixCellData } from './computeVariantMatrixCells.ts'
import type { VariantDisplayModelBase } from '../../shared/VariantDisplayModelInterface.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(scrollbarStyles)

export interface VariantMatrixDisplayModel extends VariantDisplayModelBase {
  cellData: MatrixCellData | undefined
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

  const renderNow = useEffectEvent(() => {
    const renderer = rendererRef.current
    const cellData = model.cellData
    if (!renderer || !ready || !view.initialized || !cellData) {
      return
    }
    renderer.render({
      canvasWidth: Math.round(view.dynamicBlocks.totalWidthPxWithoutBorders),
      canvasHeight: model.availableHeight,
      rowHeight: model.rowHeight,
      scrollTop: model.scrollTop,
      numFeatures: cellData.numFeatures,
    })
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

      renderNow()
    })
  }, [model, view, ready, rendererRef])

  useTabVisibilityRerender(renderNow)

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
            model.reload()
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
