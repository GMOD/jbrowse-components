import React, { useRef, useEffect, useCallback, useState } from 'react'
import { observer } from 'mobx-react'
import { getContainingView } from '@jbrowse/core/util'

import { WebGLRenderer } from './WebGLRenderer'

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

  // Local Y scroll state (not synced across canvases)
  const rangeYRef = useRef<[number, number]>([0, 600])
  const [maxY, setMaxY] = useState(0)
  const [rendererReady, setRendererReady] = useState(false)

  // Debounce timer for data fetching
  const pendingDataRequestRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRequestedRegionRef = useRef<{ start: number; end: number } | null>(null)
  const renderRAFRef = useRef<number | null>(null)

  // Drag state
  const dragRef = useRef({
    isDragging: false,
    lastX: 0,
    lastY: 0,
  })

  // Get view for dimensions and position
  const view = getContainingView(model) as LinearGenomeViewModel | undefined

  const {
    webglFeatures,
    isLoading,
    error,
    featureHeight,
    featureSpacing,
    colorSchemeIndex,
    visibleRegion,
    showCoverage,
    coverageHeight,
    coverageData,
  } = model

  // View position - these are the source of truth, observed via mobx
  const offsetPx = view?.offsetPx ?? 0
  const bpPerPx = view?.bpPerPx ?? 1
  const width = view?.initialized ? view.width : undefined
  const height = model.height

  // Compute domain from view position
  const domain: [number, number] | null =
    visibleRegion && width !== undefined
      ? [visibleRegion.start, visibleRegion.end]
      : null

  // Render function
  const renderNow = useCallback(() => {
    if (!rendererRef.current || !domain) {
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
  }, [domain, colorSchemeIndex, featureHeight, featureSpacing, showCoverage, coverageHeight])

  // Schedule a render on next animation frame
  const scheduleRender = useCallback(() => {
    if (renderRAFRef.current !== null) {
      cancelAnimationFrame(renderRAFRef.current)
    }
    renderRAFRef.current = requestAnimationFrame(() => {
      renderRAFRef.current = null
      renderNow()
    })
  }, [renderNow])

  // Check if we need more data (debounced)
  const checkDataNeeds = useCallback(
    (newDomain: [number, number]) => {
      const loadedRegion = model.loadedRegion
      if (!loadedRegion || model.isLoading) {
        return
      }

      const buffer = (newDomain[1] - newDomain[0]) * 0.5
      const needsData =
        newDomain[0] - buffer < loadedRegion.start ||
        newDomain[1] + buffer > loadedRegion.end

      if (needsData) {
        if (pendingDataRequestRef.current) {
          clearTimeout(pendingDataRequestRef.current)
        }

        pendingDataRequestRef.current = setTimeout(() => {
          if (model.isLoading) {
            return
          }

          const requested = lastRequestedRegionRef.current
          if (
            requested &&
            newDomain[0] >= requested.start &&
            newDomain[1] <= requested.end
          ) {
            return
          }

          lastRequestedRegionRef.current = {
            start: newDomain[0],
            end: newDomain[1],
          }

          model.handleNeedMoreData({
            start: newDomain[0],
            end: newDomain[1],
          })
          pendingDataRequestRef.current = null
        }, 200)
      }
    },
    [model],
  )

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    try {
      rendererRef.current = new WebGLRenderer(canvas)
      setRendererReady(true)
      console.log('WebGL initialized successfully')
    } catch (e) {
      console.error('Failed to initialize WebGL:', e)
    }

    return () => {
      rendererRef.current?.destroy()
      rendererRef.current = null
      setRendererReady(false)
    }
  }, [])

  // Upload features when they change
  useEffect(() => {
    if (!rendererRef.current || webglFeatures.length === 0) {
      return
    }

    console.log(`Uploading ${webglFeatures.length} features`)
    const result = rendererRef.current.uploadFeatures(webglFeatures)
    setMaxY(result.maxY)
    model.setMaxY(result.maxY)
    scheduleRender()
  }, [webglFeatures, model, scheduleRender])

  // Upload coverage when it changes
  useEffect(() => {
    if (!rendererRef.current || !showCoverage || coverageData.data.length === 0) {
      return
    }

    const binSize =
      coverageData.data.length > 1
        ? coverageData.data[1].position - coverageData.data[0].position
        : 1

    console.log(
      `Uploading ${coverageData.data.length} coverage bins, maxDepth=${coverageData.maxDepth}`,
    )
    rendererRef.current.uploadCoverage(
      coverageData.data,
      coverageData.maxDepth,
      binSize,
    )
    scheduleRender()
  }, [coverageData, showCoverage, scheduleRender])

  // Re-render when view position or settings change
  // This is the key mobx observation - when offsetPx/bpPerPx change, we re-render
  useEffect(() => {
    if (rendererReady && domain) {
      scheduleRender()
    }
  }, [rendererReady, domain, offsetPx, bpPerPx, colorSchemeIndex, featureHeight, featureSpacing, showCoverage, coverageHeight, scheduleRender, webglFeatures])

  // Reset request tracking when loaded region changes
  useEffect(() => {
    lastRequestedRegionRef.current = null
  }, [model.loadedRegion])

  // Cleanup on unmount
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

  // Wheel handler - directly updates view position
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !view?.initialized) {
      return
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (width === undefined) {
        return
      }

      // Horizontal scroll (trackpad sideways) - pan
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        view.scroll(e.deltaX)
        if (domain) {
          checkDataNeeds(domain)
        }
        return
      }

      if (e.shiftKey) {
        // Vertical scroll with shift - scroll Y
        const rowHeight = featureHeight + featureSpacing
        const totalHeight = maxY * rowHeight
        const panAmount = e.deltaY * 0.5

        const prev = rangeYRef.current
        let newY: [number, number] = [
          prev[0] + panAmount,
          prev[1] + panAmount,
        ]
        if (newY[0] < 0) {
          newY = [0, newY[1] - newY[0]]
        }
        if (newY[1] > totalHeight + 50) {
          const overflow = newY[1] - totalHeight - 50
          newY = [newY[0] - overflow, newY[1] - overflow]
        }
        rangeYRef.current = newY
        scheduleRender()
      } else {
        // Vertical wheel - zoom
        const rect = canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left

        // Use view's zoom method with the mouse position as center
        const zoomFactor = e.deltaY > 0 ? 1.15 : 1 / 1.15
        view.zoomTo(bpPerPx * zoomFactor, mouseX)

        if (domain) {
          checkDataNeeds(domain)
        }
      }
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [view, width, domain, bpPerPx, maxY, featureHeight, featureSpacing, scheduleRender, checkDataNeeds])

  // Pan handlers - directly update view position
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = {
      isDragging: true,
      lastX: e.clientX,
      lastY: e.clientY,
    }
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragRef.current.isDragging || !view?.initialized) {
        return
      }

      const dx = e.clientX - dragRef.current.lastX
      const dy = e.clientY - dragRef.current.lastY
      dragRef.current.lastX = e.clientX
      dragRef.current.lastY = e.clientY

      // Pan X - directly update view
      if (dx !== 0) {
        view.scroll(-dx)
      }

      // Pan Y - local state only
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
        scheduleRender()
      }

      if (domain) {
        checkDataNeeds(domain)
      }
    },
    [view, height, domain, scheduleRender, checkDataNeeds],
  )

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

  const isReady = width !== undefined && domain !== null
  const displayBpPerPx = isReady ? (domain[1] - domain[0]) / width : 0

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
          {Math.round(domain[0])}-{Math.round(domain[1])} | {displayBpPerPx.toFixed(2)}{' '}
          bp/px | {webglFeatures.length} reads
          {showCoverage && coverageData.maxDepth > 0
            ? ` | max depth: ${coverageData.maxDepth}`
            : ''}
        </div>
      )}
    </div>
  )
})

export default WebGLPileupComponent
