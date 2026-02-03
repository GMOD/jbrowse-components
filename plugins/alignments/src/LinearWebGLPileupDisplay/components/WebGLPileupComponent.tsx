import React, { useRef, useEffect, useCallback, useState, useId } from 'react'
import { observer } from 'mobx-react'
import { getContainingView } from '@jbrowse/core/util'

import { WebGLRenderer } from './WebGLRenderer'
import { getCoordinator } from './ViewCoordinator'

import type { LinearWebGLPileupDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface Props {
  model: LinearWebGLPileupDisplayModel
}

const WebGLPileupComponent = observer(function WebGLPileupComponent({
  model,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const canvasId = useId()

  // Local position refs for immediate rendering (bypasses mobx)
  const offsetPxRef = useRef(0)
  const bpPerPxRef = useRef(1)
  const rangeYRef = useRef<[number, number]>([0, 600])

  const [maxY, setMaxY] = useState(0)
  const [rendererReady, setRendererReady] = useState(false)

  // Track interaction state
  const interactingRef = useRef(false)
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renderRAFRef = useRef<number | null>(null)
  const pendingDataRequestRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRequestedRegionRef = useRef<{ start: number; end: number } | null>(null)

  const dragRef = useRef({
    isDragging: false,
    lastX: 0,
    lastY: 0,
  })

  const view = getContainingView(model) as LinearGenomeViewModel | undefined
  const viewId = view?.id

  const {
    webglFeatures,
    isLoading,
    error,
    featureHeight,
    featureSpacing,
    colorSchemeIndex,
    showCoverage,
    coverageHeight,
    coverageData,
  } = model

  const width = view?.initialized ? view.width : undefined
  const height = model.height
  const displayedRegions = view?.displayedRegions

  // Compute domain from local offsetPx/bpPerPx
  const computeDomain = useCallback((): [number, number] | null => {
    if (!displayedRegions || displayedRegions.length === 0 || width === undefined) {
      return null
    }
    // For now, use first region - this works for single-region views
    // Multi-region support would need more complex logic
    const region = displayedRegions[0]
    const start = region.start + offsetPxRef.current * bpPerPxRef.current
    const end = start + width * bpPerPxRef.current
    return [start, end]
  }, [displayedRegions, width])

  // Render function
  const renderNow = useCallback(() => {
    if (!rendererRef.current) {
      return
    }
    const domain = computeDomain()
    if (!domain) {
      return
    }

    rendererRef.current.render({
      domainX: domain,
      rangeY: rangeYRef.current,
      colorScheme: colorSchemeIndex,
      featureHeight,
      featureSpacing,
      showCoverage,
      coverageHeight,
    })
  }, [computeDomain, colorSchemeIndex, featureHeight, featureSpacing, showCoverage, coverageHeight])

  // Render immediately - no RAF delay for smooth interaction
  const renderImmediate = useCallback(() => {
    renderNow()
  }, [renderNow])

  // Render on next frame - for non-critical updates
  const scheduleRender = useCallback(() => {
    if (renderRAFRef.current !== null) {
      cancelAnimationFrame(renderRAFRef.current)
    }
    renderRAFRef.current = requestAnimationFrame(() => {
      renderRAFRef.current = null
      renderNow()
    })
  }, [renderNow])

  // Broadcast position to other canvases
  const broadcast = useCallback(() => {
    if (!viewId) {
      return
    }
    const coordinator = getCoordinator(viewId)
    coordinator.broadcast({
      offsetPx: offsetPxRef.current,
      bpPerPx: bpPerPxRef.current,
      sourceId: canvasId,
    })
  }, [viewId, canvasId])

  // Sync back to mobx view (debounced)
  const syncToView = useCallback(() => {
    if (!view?.initialized) {
      return
    }
    // Sync both position and zoom level
    view.setNewView(bpPerPxRef.current, offsetPxRef.current)
  }, [view])

  const debouncedSyncToView = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }
    syncTimeoutRef.current = setTimeout(() => {
      syncToView()
      syncTimeoutRef.current = null
    }, 100)
  }, [syncToView])

  // Check data needs
  const checkDataNeeds = useCallback(() => {
    const domain = computeDomain()
    if (!domain) {
      return
    }
    const loadedRegion = model.loadedRegion
    if (!loadedRegion || model.isLoading) {
      return
    }

    const buffer = (domain[1] - domain[0]) * 0.5
    const needsData =
      domain[0] - buffer < loadedRegion.start ||
      domain[1] + buffer > loadedRegion.end

    if (needsData) {
      if (pendingDataRequestRef.current) {
        clearTimeout(pendingDataRequestRef.current)
      }
      pendingDataRequestRef.current = setTimeout(() => {
        if (model.isLoading) {
          return
        }
        const requested = lastRequestedRegionRef.current
        if (requested && domain[0] >= requested.start && domain[1] <= requested.end) {
          return
        }
        lastRequestedRegionRef.current = { start: domain[0], end: domain[1] }
        model.handleNeedMoreData({ start: domain[0], end: domain[1] })
        pendingDataRequestRef.current = null
      }, 200)
    }
  }, [computeDomain, model])

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

  // Subscribe to coordinator
  useEffect(() => {
    if (!viewId) {
      return
    }
    const coordinator = getCoordinator(viewId)
    const unsubscribe = coordinator.subscribe(canvasId, position => {
      // Received update from another canvas - update refs and render immediately
      offsetPxRef.current = position.offsetPx
      bpPerPxRef.current = position.bpPerPx
      renderImmediate()
    })
    return unsubscribe
  }, [viewId, canvasId, renderImmediate])

  // Sync from mobx when not interacting
  useEffect(() => {
    if (!view?.initialized || interactingRef.current) {
      return
    }
    offsetPxRef.current = view.offsetPx
    bpPerPxRef.current = view.bpPerPx
    scheduleRender()
  }, [view?.offsetPx, view?.bpPerPx, view?.initialized, scheduleRender])

  // Upload features
  useEffect(() => {
    if (!rendererRef.current || webglFeatures.length === 0) {
      return
    }
    const result = rendererRef.current.uploadFeatures(webglFeatures)
    setMaxY(result.maxY)
    model.setMaxY(result.maxY)
    scheduleRender()
  }, [webglFeatures, model, scheduleRender])

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
    scheduleRender()
  }, [coverageData, showCoverage, scheduleRender])

  // Re-render on settings change
  useEffect(() => {
    if (rendererReady) {
      scheduleRender()
    }
  }, [rendererReady, colorSchemeIndex, featureHeight, featureSpacing, showCoverage, coverageHeight, scheduleRender, webglFeatures])

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
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
      if (renderRAFRef.current) {
        cancelAnimationFrame(renderRAFRef.current)
      }
    }
  }, [])

  // Wheel handler
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !view?.initialized || width === undefined) {
      return
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()

      interactingRef.current = true

      // Horizontal scroll - pan
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        offsetPxRef.current += e.deltaX
        broadcast()
        renderImmediate()
        debouncedSyncToView()
        checkDataNeeds()
        return
      }

      if (e.shiftKey) {
        // Vertical scroll
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
        // Zoom
        const rect = canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const zoomFactor = e.deltaY > 0 ? 1.15 : 1 / 1.15

        // Zoom around mouse position
        const oldBpPerPx = bpPerPxRef.current
        const newBpPerPx = Math.max(
          view.minBpPerPx,
          Math.min(view.maxBpPerPx, oldBpPerPx * zoomFactor)
        )

        if (newBpPerPx !== oldBpPerPx) {
          // Adjust offset to keep mouse position stable
          const mouseBp = offsetPxRef.current * oldBpPerPx + mouseX * oldBpPerPx
          offsetPxRef.current = (mouseBp - mouseX * newBpPerPx) / newBpPerPx
          bpPerPxRef.current = newBpPerPx

          broadcast()
          renderImmediate()

          // Don't call view.zoomTo() here - it triggers mobx and causes stutter
          // Only sync back on debounce
          debouncedSyncToView()
          checkDataNeeds()
        }
      }
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [view, width, maxY, featureHeight, featureSpacing, broadcast, renderImmediate, debouncedSyncToView, checkDataNeeds])

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    interactingRef.current = true
    dragRef.current = {
      isDragging: true,
      lastX: e.clientX,
      lastY: e.clientY,
    }
  }, [])

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
        offsetPxRef.current -= dx
        broadcast()
        renderImmediate()
        debouncedSyncToView()
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
    [height, broadcast, renderImmediate, debouncedSyncToView, checkDataNeeds],
  )

  const handleMouseUp = useCallback(() => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false
      interactingRef.current = false
      syncToView()
    }
  }, [syncToView])

  const handleMouseLeave = useCallback(() => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false
      interactingRef.current = false
      syncToView()
    }
  }, [syncToView])

  if (error) {
    return <div style={{ color: '#c00', padding: 16 }}>Error: {error.message}</div>
  }

  const domain = computeDomain()
  const isReady = width !== undefined && domain !== null
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
          {Math.round(domain[0])}-{Math.round(domain[1])} | {displayBpPerPx.toFixed(2)} bp/px |{' '}
          {webglFeatures.length} reads
          {showCoverage && coverageData.maxDepth > 0 ? ` | max depth: ${coverageData.maxDepth}` : ''}
        </div>
      )}
    </div>
  )
})

export default WebGLPileupComponent
