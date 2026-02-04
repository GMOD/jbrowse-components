import React, { useRef, useEffect, useCallback, useState, useId } from 'react'
import { observer } from 'mobx-react'
import { getContainingView } from '@jbrowse/core/util'

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
 * Architecture: This component uses a dual-state system to achieve smooth pan/zoom:
 *
 * 1. WebGL State (refs): Used for immediate rendering during interaction
 *    - visibleBpRangeRef: The genomic range currently displayed
 *    - bpPerPxRef: Current zoom level
 *    - offsetPxRef: Pixel offset for MobX sync
 *
 * 2. MobX State (view): The "official" state that other components see
 *    - Synced from WebGL state when interaction ends
 *    - Used for data loading decisions
 *
 * Ownership Phase Machine:
 * - 'idle': MobX is source of truth, WebGL accepts external changes
 * - 'interacting': User is panning/zooming, WebGL owns state, MobX ignored
 * - 'syncing': Just sent to MobX, waiting for echo to settle
 */
type OwnershipPhase = 'idle' | 'interacting' | 'syncing'

const WebGLPileupComponent = observer(function WebGLPileupComponent({
  model,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const canvasId = useId()

  // WebGL state refs - source of truth during interaction
  const offsetPxRef = useRef(0)
  const bpPerPxRef = useRef(1)
  const rangeYRef = useRef<[number, number]>([0, 600])
  const visibleBpRangeRef = useRef<[number, number] | null>(null)

  const [maxY, setMaxY] = useState(0)
  const [rendererReady, setRendererReady] = useState(false)

  // Phase machine state
  const ownershipPhaseRef = useRef<OwnershipPhase>('idle')
  const lastSyncedToViewRef = useRef<{
    bpPerPx: number
    offsetPx: number
    timestamp: number
  } | null>(null)
  const syncPhaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Rendering and data loading
  const renderRAFRef = useRef<number | null>(null)
  const scheduleRenderRef = useRef<() => void>(() => {})
  const pendingDataRequestRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRequestedRegionRef = useRef<{ start: number; end: number } | null>(null)

  // Drag state
  const dragRef = useRef({
    isDragging: false,
    lastX: 0,
    lastY: 0,
  })

  const view = getContainingView(model) as LinearGenomeViewModel | undefined
  const viewId = view?.id

  const {
    webglFeatures,
    webglGaps,
    webglMismatches,
    webglInsertions,
    isLoading,
    error,
    featureHeight,
    featureSpacing,
    colorSchemeIndex,
    showCoverage,
    coverageHeight,
    coverageData,
    showMismatches,
  } = model

  const width = view?.initialized ? view.width : undefined
  const height = model.height
  const minOffset = view?.minOffset ?? 0
  const maxOffset = view?.maxOffset ?? Infinity

  const clampOffset = useCallback(
    (offset: number): number => Math.max(minOffset, Math.min(maxOffset, offset)),
    [minOffset, maxOffset],
  )

  // Update visible range ref (no MobX sync during interaction for performance)
  const setVisibleBpRange = useCallback((range: [number, number]) => {
    visibleBpRangeRef.current = range
  }, [])

  // Compute visible range from MobX view state
  const syncVisibleBpRangeFromView = useCallback(() => {
    if (!view?.initialized || width === undefined) {
      return
    }
    // @ts-ignore - dynamicBlocks access
    const contentBlocks = view.dynamicBlocks?.contentBlocks
    if (!contentBlocks || contentBlocks.length === 0) {
      return
    }
    const first = contentBlocks[0]
    const last = contentBlocks[contentBlocks.length - 1]
    if (first.refName !== last.refName) {
      return
    }

    const bpPerPx = view.bpPerPx
    const blockOffsetPx = first.offsetPx ?? 0
    const deltaPx = view.offsetPx - blockOffsetPx
    const deltaBp = deltaPx * bpPerPx

    const rangeStart = first.start + deltaBp
    const rangeEnd = rangeStart + width * bpPerPx
    setVisibleBpRange([rangeStart, rangeEnd])
  }, [view, width, setVisibleBpRange])

  // Get visible range - prefer ref, fallback to computing from view
  const getVisibleBpRange = useCallback((): [number, number] | null => {
    if (!view?.initialized || width === undefined) {
      return null
    }

    if (visibleBpRangeRef.current) {
      return visibleBpRangeRef.current
    }

    // Compute from contentBlocks as fallback
    // @ts-ignore - dynamicBlocks access
    const contentBlocks = view.dynamicBlocks?.contentBlocks
    if (!contentBlocks || contentBlocks.length === 0) {
      return null
    }
    const first = contentBlocks[0]
    const last = contentBlocks[contentBlocks.length - 1]
    if (first.refName === last.refName) {
      const bpPerPx = bpPerPxRef.current
      const blockOffsetPx = first.offsetPx ?? 0
      const deltaPx = offsetPxRef.current - blockOffsetPx
      const deltaBp = deltaPx * bpPerPx

      const rangeStart = first.start + deltaBp
      const rangeEnd = rangeStart + width * bpPerPx
      const range: [number, number] = [rangeStart, rangeEnd]
      setVisibleBpRange(range)
      return range
    }

    const visibleRegion = model.visibleRegion
    if (visibleRegion) {
      return [visibleRegion.start, visibleRegion.end]
    }

    return null
  }, [view, width, model.visibleRegion, setVisibleBpRange])

  // Render to WebGL canvas
  const renderNow = useCallback(() => {
    if (!rendererRef.current) {
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
    })
  }, [getVisibleBpRange, colorSchemeIndex, featureHeight, featureSpacing, showCoverage, coverageHeight, showMismatches])

  const renderImmediate = useCallback(() => {
    renderNow()
  }, [renderNow])

  const scheduleRender = useCallback(() => {
    if (renderRAFRef.current !== null) {
      cancelAnimationFrame(renderRAFRef.current)
    }
    renderRAFRef.current = requestAnimationFrame(() => {
      renderRAFRef.current = null
      renderNow()
    })
  }, [renderNow])

  // Keep ref updated for use in effects without causing re-runs
  scheduleRenderRef.current = scheduleRender

  // Broadcast to other canvases in same view
  const broadcast = useCallback(() => {
    if (!viewId) {
      return
    }
    const coordinator = getCoordinator(viewId)
    coordinator.broadcast({
      offsetPx: offsetPxRef.current,
      bpPerPx: bpPerPxRef.current,
      visibleBpRange: visibleBpRangeRef.current,
      sourceId: canvasId,
    })
  }, [viewId, canvasId])

  // Sync WebGL state to MobX view
  const syncToView = useCallback(() => {
    if (!view?.initialized) {
      return
    }

    const currentRange = visibleBpRangeRef.current
    if (!currentRange) {
      return
    }

    // Compute offsetPx using coordinate system relationship
    // offsetPx = (genomicPosition - assemblyOffset) / bpPerPx
    // assemblyOffset = block.start - block.offsetPx * bpPerPx
    // @ts-ignore - dynamicBlocks access
    const contentBlocks = view.dynamicBlocks?.contentBlocks
    let computedOffsetPx = offsetPxRef.current
    if (contentBlocks?.length > 0) {
      const first = contentBlocks[0]
      const blockOffsetPx = first.offsetPx ?? 0
      const assemblyOffset = first.start - blockOffsetPx * view.bpPerPx
      computedOffsetPx = (currentRange[0] - assemblyOffset) / bpPerPxRef.current
    }

    // Sync domain to model for data loading
    model.setCurrentDomain(currentRange)

    // Record for echo detection
    lastSyncedToViewRef.current = {
      bpPerPx: bpPerPxRef.current,
      offsetPx: computedOffsetPx,
      timestamp: Date.now(),
    }

    ownershipPhaseRef.current = 'syncing'
    view.setNewView(bpPerPxRef.current, computedOffsetPx)
    offsetPxRef.current = computedOffsetPx

    // Clear existing timeout
    if (syncPhaseTimeoutRef.current) {
      clearTimeout(syncPhaseTimeoutRef.current)
    }

    // Transition back to idle after MobX settles
    syncPhaseTimeoutRef.current = setTimeout(() => {
      if (ownershipPhaseRef.current === 'syncing') {
        ownershipPhaseRef.current = 'idle'
      }
      syncPhaseTimeoutRef.current = null
    }, 150)
  }, [view, model])

  const startInteraction = useCallback(() => {
    ownershipPhaseRef.current = 'interacting'
    if (syncPhaseTimeoutRef.current) {
      clearTimeout(syncPhaseTimeoutRef.current)
      syncPhaseTimeoutRef.current = null
    }
  }, [])

  const endInteraction = useCallback(() => {
    if (ownershipPhaseRef.current === 'interacting') {
      syncToView()
    }
  }, [syncToView])

  const debouncedEndInteraction = useCallback(() => {
    if (syncPhaseTimeoutRef.current) {
      clearTimeout(syncPhaseTimeoutRef.current)
    }
    syncPhaseTimeoutRef.current = setTimeout(() => {
      endInteraction()
      syncPhaseTimeoutRef.current = null
    }, 100)
  }, [endInteraction])

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
        if (requested && currentRange[0] >= requested.start && currentRange[1] <= requested.end) {
          return
        }
        lastRequestedRegionRef.current = { start: currentRange[0], end: currentRange[1] }
        model.handleNeedMoreData({ start: currentRange[0], end: currentRange[1] })
        pendingDataRequestRef.current = null
      }, 200)
    }
  }, [getVisibleBpRange, model])

  // Initialize WebGL
  useEffect(() => {
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
      rendererRef.current?.destroy()
      rendererRef.current = null
      setRendererReady(false)
    }
  }, [])

  // Subscribe to coordinator for cross-canvas sync
  useEffect(() => {
    if (!viewId) {
      return
    }
    const coordinator = getCoordinator(viewId)
    const unsubscribe = coordinator.subscribe(canvasId, position => {
      offsetPxRef.current = position.offsetPx
      bpPerPxRef.current = position.bpPerPx
      if (position.visibleBpRange) {
        setVisibleBpRange(position.visibleBpRange)
      }
      renderImmediate()
    })
    return () => {
      unsubscribe()
      if (coordinator.listenerCount === 0) {
        removeCoordinator(viewId)
      }
    }
  }, [viewId, canvasId, renderImmediate, setVisibleBpRange])

  // Sync from MobX view when external navigation occurs
  useEffect(() => {
    if (!view?.initialized) {
      return
    }

    const phase = ownershipPhaseRef.current

    // Don't accept changes while interacting
    if (phase === 'interacting') {
      return
    }

    // Check for echo during syncing phase
    if (phase === 'syncing' && lastSyncedToViewRef.current) {
      const sent = lastSyncedToViewRef.current
      const bpPerPxDiff = Math.abs(view.bpPerPx - sent.bpPerPx)
      const offsetPxDiff = Math.abs(view.offsetPx - sent.offsetPx)
      const isEcho = bpPerPxDiff < 0.001 && offsetPxDiff < 1

      if (isEcho) {
        return
      }
    }

    // Check if this is a real external change
    const bpPerPxChanged = Math.abs(view.bpPerPx - bpPerPxRef.current) > 0.001

    if (!bpPerPxChanged) {
      // Just offsetPx adjustment - accept it but keep our range
      if (Math.abs(view.offsetPx - offsetPxRef.current) > 1) {
        offsetPxRef.current = view.offsetPx
      }
      return
    }

    // External navigation - accept new state
    offsetPxRef.current = view.offsetPx
    bpPerPxRef.current = view.bpPerPx
    syncVisibleBpRangeFromView()
    scheduleRenderRef.current()
  }, [view?.offsetPx, view?.bpPerPx, view?.initialized, syncVisibleBpRangeFromView])

  // Upload features to GPU
  useEffect(() => {
    if (!rendererRef.current || webglFeatures.length === 0) {
      return
    }

    const result = rendererRef.current.uploadFeatures(webglFeatures)
    setMaxY(result.maxY)
    model.setMaxY(result.maxY)

    rendererRef.current.uploadCigarData(webglGaps, webglMismatches, webglInsertions)
    scheduleRenderRef.current()
  }, [webglFeatures, webglGaps, webglMismatches, webglInsertions, model])

  // Upload coverage
  useEffect(() => {
    if (!rendererRef.current || !showCoverage || coverageData.data.length === 0) {
      return
    }
    const binSize =
      coverageData.data.length > 1
        ? coverageData.data[1].position - coverageData.data[0].position
        : 1
    rendererRef.current.uploadCoverage(coverageData.data, coverageData.maxDepth, binSize)
    scheduleRenderRef.current()
  }, [coverageData, showCoverage])

  // Re-render on settings change
  useEffect(() => {
    if (rendererReady) {
      scheduleRenderRef.current()
    }
  }, [rendererReady, colorSchemeIndex, featureHeight, featureSpacing, showCoverage, coverageHeight, showMismatches, webglFeatures])

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
      if (syncPhaseTimeoutRef.current) {
        clearTimeout(syncPhaseTimeoutRef.current)
      }
      if (renderRAFRef.current) {
        cancelAnimationFrame(renderRAFRef.current)
      }
    }
  }, [])

  // Wheel handler for zoom and pan
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !view?.initialized || width === undefined) {
      return
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()

      startInteraction()

      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)

      // Horizontal scroll - pan
      if (absX > 5 && absX > absY * 2) {
        const currentRange = visibleBpRangeRef.current
        if (currentRange) {
          const deltaBp = e.deltaX * bpPerPxRef.current
          setVisibleBpRange([currentRange[0] + deltaBp, currentRange[1] + deltaBp])
        }
        offsetPxRef.current = clampOffset(offsetPxRef.current + e.deltaX)
        broadcast()
        renderImmediate()
        debouncedEndInteraction()
        checkDataNeeds()
        return
      }

      if (absY < 1) {
        return
      }

      if (e.shiftKey) {
        // Vertical scroll within pileup
        const rowHeight = featureHeight + featureSpacing
        const totalHeight = maxY * rowHeight
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
        renderImmediate()
      } else {
        // Zoom around mouse position
        const currentRange = visibleBpRangeRef.current
        if (!currentRange) {
          syncVisibleBpRangeFromView()
          return
        }

        const rect = canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const zoomFactor = e.deltaY > 0 ? 1.05 : 1 / 1.05

        // Calculate genomic position under mouse
        const rangeWidth = currentRange[1] - currentRange[0]
        const mouseFraction = mouseX / width
        const mouseBp = currentRange[0] + rangeWidth * mouseFraction

        // Calculate new range
        const newRangeWidth = rangeWidth * zoomFactor
        const newBpPerPx = newRangeWidth / width

        // Check zoom limits
        if (newBpPerPx < view.minBpPerPx || newBpPerPx > view.maxBpPerPx) {
          return
        }

        // Position new range so mouseBp stays at same screen position
        const newRangeStart = mouseBp - mouseFraction * newRangeWidth
        const newRangeEnd = newRangeStart + newRangeWidth

        setVisibleBpRange([newRangeStart, newRangeEnd])
        bpPerPxRef.current = newBpPerPx

        broadcast()
        renderImmediate()
        debouncedEndInteraction()
        checkDataNeeds()
      }
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [view, width, maxY, featureHeight, featureSpacing, broadcast, renderImmediate, debouncedEndInteraction, checkDataNeeds, clampOffset, syncVisibleBpRangeFromView, startInteraction, setVisibleBpRange])

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    startInteraction()
    dragRef.current = {
      isDragging: true,
      lastX: e.clientX,
      lastY: e.clientY,
    }
  }, [startInteraction])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragRef.current.isDragging) {
        return
      }

      const dx = e.clientX - dragRef.current.lastX
      const dy = e.clientY - dragRef.current.lastY
      dragRef.current.lastX = e.clientX
      dragRef.current.lastY = e.clientY

      if (dx !== 0) {
        const currentRange = visibleBpRangeRef.current
        if (currentRange) {
          const deltaBp = -dx * bpPerPxRef.current
          setVisibleBpRange([currentRange[0] + deltaBp, currentRange[1] + deltaBp])
        }
        offsetPxRef.current = clampOffset(offsetPxRef.current - dx)
        broadcast()
        renderImmediate()
        debouncedEndInteraction()
        checkDataNeeds()
      }

      if (dy !== 0) {
        const prev = rangeYRef.current
        const yRange = prev[1] - prev[0]
        const pxPerY = yRange / height
        const panY = dy * pxPerY
        let newY: [number, number] = [prev[0] + panY, prev[1] + panY]
        if (newY[0] < 0) {
          newY = [0, newY[1] - newY[0]]
        }
        rangeYRef.current = newY
        renderImmediate()
      }
    },
    [height, broadcast, renderImmediate, debouncedEndInteraction, checkDataNeeds, clampOffset, setVisibleBpRange],
  )

  const handleMouseUp = useCallback(() => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false
      endInteraction()
    }
  }, [endInteraction])

  const handleMouseLeave = useCallback(() => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false
      endInteraction()
    }
  }, [endInteraction])

  if (error) {
    return <div style={{ color: '#c00', padding: 16 }}>Error: {error.message}</div>
  }

  const visibleBpRange = getVisibleBpRange()
  const isReady = width !== undefined && visibleBpRange !== null
  const displayBpPerPx = bpPerPxRef.current

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
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

      {isReady && (
        <div
          style={{
            position: 'absolute',
            bottom: 4,
            left: 4,
            fontSize: 10,
            color: '#666',
            pointerEvents: 'none',
            fontFamily: 'monospace',
            background: 'rgba(255,255,255,0.7)',
            padding: '2px 4px',
            borderRadius: 2,
          }}
        >
          {Math.round(visibleBpRange[0])}-{Math.round(visibleBpRange[1])} | {displayBpPerPx.toFixed(2)} bp/px |{' '}
          {webglFeatures.length} reads
          {showCoverage && coverageData.maxDepth > 0 ? ` | max depth: ${coverageData.maxDepth}` : ''}
          {showMismatches && (webglGaps.length > 0 || webglMismatches.length > 0)
            ? ` | ${webglGaps.length} gaps, ${webglMismatches.length} SNPs`
            : ''}
        </div>
      )}
    </div>
  )
})

export default WebGLPileupComponent
