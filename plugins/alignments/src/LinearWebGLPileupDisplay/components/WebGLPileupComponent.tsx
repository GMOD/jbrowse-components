import React, { useRef, useEffect, useCallback, useState, useId } from 'react'
import { observer } from 'mobx-react'
import { getContainingView } from '@jbrowse/core/util'
import useMeasure from '@jbrowse/core/util/useMeasure'

import { WebGLRenderer } from './WebGLRenderer'
import { getCoordinator, removeCoordinator } from './ViewCoordinator'

import type { LinearWebGLPileupDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface Props {
  model: LinearWebGLPileupDisplayModel
}

/**
 * WebGL Pileup Component
 *
 * Architecture: Single source of truth - always use MobX view state.
 *
 * The view's offsetPx and bpPerPx are the source of truth for coordinates.
 * This ensures perfect alignment with gridlines and other components.
 *
 * During interaction, we update the view immediately (not debounced).
 * This may trigger re-renders of other components, but ensures consistency.
 */

// Debug logging - disable for performance (console.log adds ~15-20ms per wheel event!)
const DEBUG = false
const log = (...args: unknown[]) => DEBUG && console.log('[WebGL]', ...args)
const renderCountRef = { current: 0 }

const WebGLPileupComponent = observer(function WebGLPileupComponent({
  model,
}: Props) {
  renderCountRef.current++
  log('RENDER #' + renderCountRef.current)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const canvasId = useId()

  // Use ResizeObserver via useMeasure for passive dimension tracking
  // This avoids forced layout from reading clientWidth/clientHeight
  const [measureRef, measuredDims] = useMeasure()

  // Y-axis scroll state (not part of view)
  const rangeYRef = useRef<[number, number]>([0, 600])

  const [maxY, setMaxY] = useState(0)
  const [rendererReady, setRendererReady] = useState(false)

  // Rendering and data loading
  const renderRAFRef = useRef<number | null>(null)
  const scheduleRenderRef = useRef<() => void>(() => {})
  const pendingDataRequestRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const lastRequestedRegionRef = useRef<{ start: number; end: number } | null>(
    null,
  )

  // Drag state
  const dragRef = useRef({
    isDragging: false,
    lastX: 0,
    lastY: 0,
  })

  // Cache canvas bounding rect to avoid forced layout on every wheel event
  const canvasRectRef = useRef<DOMRect | null>(null)

  const view = getContainingView(model) as LinearGenomeViewModel | undefined
  const viewId = view?.id

  const {
    rpcData,
    isLoading,
    error,
    featureHeight,
    featureSpacing,
    colorSchemeIndex,
    showCoverage,
    coverageHeight,
    showMismatches,
    showInterbaseCounts,
    showInterbaseIndicators,
  } = model

  // Use measured dimensions from ResizeObserver (preferred, passive)
  // Fall back to view.width if not yet measured
  const width =
    measuredDims.width ?? (view?.initialized ? view.width : undefined)
  const height = model.height
  const minOffset = view?.minOffset ?? 0
  const maxOffset = view?.maxOffset ?? Infinity

  const clampOffset = useCallback(
    (offset: number): number =>
      Math.max(minOffset, Math.min(maxOffset, offset)),
    [minOffset, maxOffset],
  )

  // Compute visible range directly from view state - this is the single source of truth
  // Returns null if view is not ready
  const getVisibleBpRange = useCallback((): [number, number] | null => {
    if (!view?.initialized || width === undefined) {
      return null
    }

    // @ts-ignore - dynamicBlocks access
    const contentBlocks = view.dynamicBlocks?.contentBlocks
    if (!contentBlocks || contentBlocks.length === 0) {
      return null
    }
    const first = contentBlocks[0]
    const last = contentBlocks[contentBlocks.length - 1]
    if (first.refName !== last.refName) {
      // Multi-ref view - not supported yet
      return null
    }

    // Compute visible range from view's coordinate system
    // This matches exactly how gridlines compute positions
    const bpPerPx = view.bpPerPx
    const blockOffsetPx = first.offsetPx ?? 0
    const deltaPx = view.offsetPx - blockOffsetPx
    const deltaBp = deltaPx * bpPerPx

    const rangeStart = first.start + deltaBp
    const rangeEnd = rangeStart + width * bpPerPx
    return [rangeStart, rangeEnd]
  }, [view, width])

  // Render to WebGL canvas
  const renderNow = useCallback(() => {
    const t0 = performance.now()
    if (!rendererRef.current || width === undefined) {
      return
    }
    const visibleBpRange = getVisibleBpRange()
    if (!visibleBpRange) {
      return
    }

    rendererRef.current.render({
      domainX: visibleBpRange,
      rangeY: rangeYRef.current,
      colorScheme: colorSchemeIndex,
      featureHeight,
      featureSpacing,
      showCoverage,
      coverageHeight,
      showMismatches,
      showInterbaseCounts,
      showInterbaseIndicators,
      // Pass dimensions to avoid forced layout from reading clientWidth/clientHeight
      canvasWidth: width,
      canvasHeight: height,
    })
    log('renderNow took', (performance.now() - t0).toFixed(2) + 'ms')
  }, [
    getVisibleBpRange,
    colorSchemeIndex,
    featureHeight,
    featureSpacing,
    showCoverage,
    coverageHeight,
    showMismatches,
    showInterbaseCounts,
    showInterbaseIndicators,
    width,
    height,
  ])

  const renderImmediate = useCallback(() => {
    renderNow()
  }, [renderNow])

  const scheduleRender = useCallback(() => {
    log('scheduleRender called')
    if (renderRAFRef.current !== null) {
      cancelAnimationFrame(renderRAFRef.current)
    }
    renderRAFRef.current = requestAnimationFrame(() => {
      renderRAFRef.current = null
      renderNow()
    })
  }, [renderNow])

  // Keep refs updated for use in event handlers without causing effect re-runs
  scheduleRenderRef.current = scheduleRender

  // Broadcast to other canvases in same view
  const broadcast = useCallback(() => {
    if (!viewId || !view) {
      return
    }
    const visibleBpRange = getVisibleBpRange()
    const coordinator = getCoordinator(viewId)
    coordinator.broadcast({
      offsetPx: view.offsetPx,
      bpPerPx: view.bpPerPx,
      visibleBpRange,
      sourceId: canvasId,
    })
  }, [viewId, canvasId, view, getVisibleBpRange])

  // Sync current domain to model for data loading decisions
  const syncDomainToModel = useCallback(() => {
    log('syncDomainToModel called')
    const visibleBpRange = getVisibleBpRange()
    if (visibleBpRange) {
      model.setCurrentDomain(visibleBpRange)
    }
  }, [getVisibleBpRange, model])

  // Check if more data needs to be loaded
  const checkDataNeeds = useCallback(() => {
    const visibleBpRange = getVisibleBpRange()
    if (!visibleBpRange) {
      return
    }
    const loadedRegion = model.loadedRegion
    if (!loadedRegion || model.isLoading) {
      return
    }

    const buffer = (visibleBpRange[1] - visibleBpRange[0]) * 0.5
    const needsData =
      visibleBpRange[0] - buffer < loadedRegion.start ||
      visibleBpRange[1] + buffer > loadedRegion.end

    if (needsData) {
      if (pendingDataRequestRef.current) {
        clearTimeout(pendingDataRequestRef.current)
      }
      pendingDataRequestRef.current = setTimeout(() => {
        if (model.isLoading) {
          return
        }
        const currentRange = getVisibleBpRange()
        if (!currentRange) {
          return
        }
        const requested = lastRequestedRegionRef.current
        if (
          requested &&
          currentRange[0] >= requested.start &&
          currentRange[1] <= requested.end
        ) {
          return
        }
        lastRequestedRegionRef.current = {
          start: currentRange[0],
          end: currentRange[1],
        }
        model.handleNeedMoreData({
          start: currentRange[0],
          end: currentRange[1],
        })
        pendingDataRequestRef.current = null
      }, 200)
    }
  }, [getVisibleBpRange, model])

  // Refs for callbacks and values used in wheel/mouse handlers - prevents effect churn
  // Must be defined after the callbacks they reference
  const renderImmediateRef = useRef(renderImmediate)
  renderImmediateRef.current = renderImmediate
  const checkDataNeedsRef = useRef(checkDataNeeds)
  checkDataNeedsRef.current = checkDataNeeds
  const clampOffsetRef = useRef(clampOffset)
  clampOffsetRef.current = clampOffset
  const getVisibleBpRangeRef = useRef(getVisibleBpRange)
  getVisibleBpRangeRef.current = getVisibleBpRange
  const viewRef = useRef(view)
  viewRef.current = view
  const widthRef = useRef(width)
  widthRef.current = width

  // Initialize WebGL
  useEffect(() => {
    log('EFFECT: Initialize WebGL - RUN')
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    try {
      rendererRef.current = new WebGLRenderer(canvas)
      setRendererReady(true)
    } catch (e) {
      console.error('Failed to initialize WebGL:', e)
    }
    return () => {
      log('EFFECT: Initialize WebGL - CLEANUP')
      rendererRef.current?.destroy()
      rendererRef.current = null
      setRendererReady(false)
    }
  }, [])

  // Subscribe to coordinator for cross-canvas sync
  // When another canvas in the same view updates, re-render
  useEffect(() => {
    log('EFFECT: Coordinator subscribe - RUN (viewId=' + viewId + ')')
    if (!viewId) {
      return
    }
    const coordinator = getCoordinator(viewId)
    const unsubscribe = coordinator.subscribe(canvasId, () => {
      // Just trigger a re-render - we always read from view state
      renderImmediate()
    })
    return () => {
      log('EFFECT: Coordinator subscribe - CLEANUP')
      unsubscribe()
      if (coordinator.listenerCount === 0) {
        removeCoordinator(viewId)
      }
    }
  }, [viewId, canvasId, renderImmediate])

  // Re-render when view state changes (pan/zoom from any source)
  useEffect(() => {
    log(
      'EFFECT: View state change - RUN (offsetPx=' +
        view?.offsetPx?.toFixed(2) +
        ', bpPerPx=' +
        view?.bpPerPx?.toFixed(4) +
        ')',
    )
    if (!view?.initialized) {
      return
    }
    // Sync domain to model for data loading
    syncDomainToModel()
    // Schedule render
    scheduleRenderRef.current()
  }, [view?.offsetPx, view?.bpPerPx, view?.initialized, syncDomainToModel])

  // Upload features to GPU from RPC typed arrays
  useEffect(() => {
    if (!rendererRef.current || !rpcData || rpcData.numReads === 0) {
      return
    }

    // Use zero-copy upload path from RPC worker data
    // Positions are offsets from regionStart for Float32 precision
    rendererRef.current.uploadFromTypedArrays({
      regionStart: rpcData.regionStart,
      readPositions: rpcData.readPositions,
      readYs: rpcData.readYs,
      readFlags: rpcData.readFlags,
      readMapqs: rpcData.readMapqs,
      readInsertSizes: rpcData.readInsertSizes,
      numReads: rpcData.numReads,
      maxY: rpcData.maxY,
    })
    setMaxY(rpcData.maxY)
    model.setMaxY(rpcData.maxY)

    // Upload CIGAR data
    rendererRef.current.uploadCigarFromTypedArrays({
      gapPositions: rpcData.gapPositions,
      gapYs: rpcData.gapYs,
      numGaps: rpcData.numGaps,
      mismatchPositions: rpcData.mismatchPositions,
      mismatchYs: rpcData.mismatchYs,
      mismatchBases: rpcData.mismatchBases,
      numMismatches: rpcData.numMismatches,
      insertionPositions: rpcData.insertionPositions,
      insertionYs: rpcData.insertionYs,
      insertionLengths: rpcData.insertionLengths,
      numInsertions: rpcData.numInsertions,
      softclipPositions: rpcData.softclipPositions,
      softclipYs: rpcData.softclipYs,
      softclipLengths: rpcData.softclipLengths,
      numSoftclips: rpcData.numSoftclips,
      hardclipPositions: rpcData.hardclipPositions,
      hardclipYs: rpcData.hardclipYs,
      hardclipLengths: rpcData.hardclipLengths,
      numHardclips: rpcData.numHardclips,
    })

    scheduleRenderRef.current()
  }, [rpcData, model])

  // Upload coverage from RPC typed arrays
  useEffect(() => {
    if (!rendererRef.current || !showCoverage || !rpcData) {
      return
    }
    rendererRef.current.uploadCoverageFromTypedArrays({
      coverageDepths: rpcData.coverageDepths,
      coverageMaxDepth: rpcData.coverageMaxDepth,
      coverageBinSize: rpcData.coverageBinSize,
      numCoverageBins: rpcData.numCoverageBins,
      snpPositions: rpcData.snpPositions,
      snpYOffsets: rpcData.snpYOffsets,
      snpHeights: rpcData.snpHeights,
      snpColorTypes: rpcData.snpColorTypes,
      numSnpSegments: rpcData.numSnpSegments,
      // Noncov (interbase) coverage data
      noncovPositions: rpcData.noncovPositions,
      noncovYOffsets: rpcData.noncovYOffsets,
      noncovHeights: rpcData.noncovHeights,
      noncovColorTypes: rpcData.noncovColorTypes,
      noncovMaxCount: rpcData.noncovMaxCount,
      numNoncovSegments: rpcData.numNoncovSegments,
      // Indicator data
      indicatorPositions: rpcData.indicatorPositions,
      indicatorColorTypes: rpcData.indicatorColorTypes,
      numIndicators: rpcData.numIndicators,
    })
    scheduleRenderRef.current()
  }, [rpcData, showCoverage])

  // Re-render on settings change
  useEffect(() => {
    log('EFFECT: Settings change - RUN')
    if (rendererReady) {
      scheduleRenderRef.current()
    }
  }, [
    rendererReady,
    colorSchemeIndex,
    featureHeight,
    featureSpacing,
    showCoverage,
    coverageHeight,
    showMismatches,
    showInterbaseCounts,
    showInterbaseIndicators,
    rpcData,
  ])

  // Re-render when container dimensions change (from ResizeObserver)
  useEffect(() => {
    log('EFFECT: Dimensions change - RUN (width=' + measuredDims.width + ')')
    if (rendererReady && measuredDims.width !== undefined) {
      scheduleRenderRef.current()
    }
  }, [rendererReady, measuredDims.width, measuredDims.height])

  // Reset data request tracking
  useEffect(() => {
    lastRequestedRegionRef.current = null
  }, [model.loadedRegion])

  // Cleanup
  useEffect(() => {
    return () => {
      if (pendingDataRequestRef.current) {
        clearTimeout(pendingDataRequestRef.current)
      }
      if (renderRAFRef.current) {
        cancelAnimationFrame(renderRAFRef.current)
      }
    }
  }, [])

  // Invalidate cached rect when container resizes
  useEffect(() => {
    log('EFFECT: Invalidate rect - RUN')
    canvasRectRef.current = null
  }, [measuredDims.width, measuredDims.height])

  // Refs for values used in wheel handler that we don't want as dependencies
  const maxYRef = useRef(maxY)
  maxYRef.current = maxY
  const featureHeightRef = useRef(featureHeight)
  featureHeightRef.current = featureHeight
  const featureSpacingRef = useRef(featureSpacing)
  featureSpacingRef.current = featureSpacing

  // Wheel handler for zoom and pan
  // Updates view state directly - this is the single source of truth
  // Effect runs once on mount - all values accessed via refs
  useEffect(() => {
    log('EFFECT: Wheel handler - RUN')
    const canvas = canvasRef.current
    if (!canvas) {
      log('EFFECT: Wheel handler - SKIP (no canvas)')
      return
    }

    const handleWheel = (e: WheelEvent) => {
      const t0 = performance.now()
      const view = viewRef.current
      const width = widthRef.current

      if (!view?.initialized || width === undefined) {
        return
      }

      e.preventDefault()
      e.stopPropagation()

      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)

      // Horizontal scroll - pan
      if (absX > 5 && absX > absY * 2) {
        const newOffsetPx = clampOffsetRef.current(view.offsetPx + e.deltaX)
        view.setNewView(view.bpPerPx, newOffsetPx)
        checkDataNeedsRef.current()
        log(
          'handleWheel (pan) took',
          (performance.now() - t0).toFixed(2) + 'ms',
        )
        return
      }

      if (absY < 1) {
        return
      }

      if (e.shiftKey) {
        // Vertical scroll within pileup (Y-axis panning, not part of view state)
        const rowHeight = featureHeightRef.current + featureSpacingRef.current
        const totalHeight = maxYRef.current * rowHeight
        const panAmount = e.deltaY * 0.5

        const prev = rangeYRef.current
        let newY: [number, number] = [prev[0] + panAmount, prev[1] + panAmount]
        if (newY[0] < 0) {
          newY = [0, newY[1] - newY[0]]
        }
        if (newY[1] > totalHeight + 50) {
          const overflow = newY[1] - totalHeight - 50
          newY = [newY[0] - overflow, newY[1] - overflow]
        }
        rangeYRef.current = newY
        renderImmediateRef.current()
      } else {
        // Zoom around mouse position
        const currentRange = getVisibleBpRangeRef.current()
        if (!currentRange) {
          return
        }

        // Use cached rect to avoid forced layout on every wheel event
        // Lazy init on first interaction if RAF hasn't fired yet
        let rect = canvasRectRef.current
        if (!rect) {
          rect = canvas.getBoundingClientRect()
          canvasRectRef.current = rect
        }
        const mouseX = e.clientX - rect.left
        const factor = 1.2
        const zoomFactor = e.deltaY > 0 ? factor : 1 / factor

        // Calculate genomic position under mouse
        const rangeWidth = currentRange[1] - currentRange[0]
        const mouseFraction = mouseX / width
        const mouseBp = currentRange[0] + rangeWidth * mouseFraction

        // Calculate new zoom level
        const newRangeWidth = rangeWidth * zoomFactor
        const newBpPerPx = newRangeWidth / width

        // Check zoom limits
        if (newBpPerPx < view.minBpPerPx || newBpPerPx > view.maxBpPerPx) {
          return
        }

        // Position new range so mouseBp stays at same screen position
        const newRangeStart = mouseBp - mouseFraction * newRangeWidth

        // Compute new offsetPx from the new range start
        // @ts-ignore - dynamicBlocks access
        const contentBlocks = view.dynamicBlocks?.contentBlocks
        if (contentBlocks?.length > 0) {
          const first = contentBlocks[0]
          const blockOffsetPx = first.offsetPx ?? 0
          // assemblyOrigin is fixed - compute it from current state
          const assemblyOrigin = first.start - blockOffsetPx * view.bpPerPx
          const newOffsetPx = (newRangeStart - assemblyOrigin) / newBpPerPx
          view.setNewView(newBpPerPx, newOffsetPx)
        }

        checkDataNeedsRef.current()
      }
      log('handleWheel took', (performance.now() - t0).toFixed(2) + 'ms')
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      log('EFFECT: Wheel handler - CLEANUP')
      canvas.removeEventListener('wheel', handleWheel)
    }
    // All values accessed via refs - effect only runs once on mount
  }, [])

  // Ref for height used in mouse handlers
  const heightRef = useRef(height)
  heightRef.current = height

  // Pan handlers - update view state directly
  // Use refs to avoid recreating callbacks on each render
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = {
      isDragging: true,
      lastX: e.clientX,
      lastY: e.clientY,
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const view = viewRef.current
    if (!dragRef.current.isDragging || !view) {
      return
    }

    const dx = e.clientX - dragRef.current.lastX
    const dy = e.clientY - dragRef.current.lastY
    dragRef.current.lastX = e.clientX
    dragRef.current.lastY = e.clientY

    // Horizontal pan - update view directly
    if (dx !== 0) {
      const newOffsetPx = clampOffsetRef.current(view.offsetPx - dx)
      view.setNewView(view.bpPerPx, newOffsetPx)
      checkDataNeedsRef.current()
    }

    // Vertical pan within pileup (Y-axis, not part of view state)
    if (dy !== 0) {
      const prev = rangeYRef.current
      const yRange = prev[1] - prev[0]
      const pxPerY = yRange / heightRef.current
      const panY = dy * pxPerY
      let newY: [number, number] = [prev[0] + panY, prev[1] + panY]
      if (newY[0] < 0) {
        newY = [0, newY[1] - newY[0]]
      }
      rangeYRef.current = newY
      renderImmediateRef.current()
    }
  }, [])

  const handleMouseUp = useCallback(() => {
    dragRef.current.isDragging = false
  }, [])

  const handleMouseLeave = useCallback(() => {
    dragRef.current.isDragging = false
  }, [])

  if (error) {
    return (
      <div style={{ color: '#c00', padding: 16 }}>Error: {error.message}</div>
    )
  }

  const visibleBpRange = getVisibleBpRange()
  const isReady = width !== undefined && visibleBpRange !== null

  return (
    <div
      ref={measureRef}
      style={{ position: 'relative', width: '100%', height }}
    >
      <canvas
        ref={canvasRef}
        width={width ?? 800}
        height={height}
        style={{
          display: 'block',
          width: width ?? '100%',
          height,
          cursor: dragRef.current.isDragging ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />

      {(isLoading || !isReady) && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255,255,255,0.9)',
            padding: '8px 16px',
            borderRadius: 4,
          }}
        >
          {isLoading ? 'Loading features...' : 'Initializing...'}
        </div>
      )}
    </div>
  )
})

export default WebGLPileupComponent
