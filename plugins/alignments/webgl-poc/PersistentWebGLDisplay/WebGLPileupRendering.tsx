/**
 * WebGLPileupRendering - React component with persistent WebGL canvas
 *
 * This component:
 * - Owns and manages a WebGL canvas that persists across renders
 * - Handles zoom/pan directly (bypassing mobx for instant response)
 * - Notifies parent of view changes (mobx catches up asynchronously)
 * - Requests data fetch when scrolling beyond buffered region
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

import { WebGLRenderer } from './WebGLRenderer.ts'

import type { FeatureData, RenderState } from './WebGLRenderer'

export interface WebGLPileupRenderingProps {
  // Initial view state
  width: number
  height: number
  initialDomainX: [number, number]

  // Data
  features: FeatureData[]
  loadedRegion: { start: number; end: number } | null

  // Display settings
  featureHeight?: number
  featureSpacing?: number
  colorScheme?: number
  showMismatches?: boolean

  // Callbacks
  onViewChange?: (domainX: [number, number], rangeY: [number, number]) => void
  onNeedMoreData?: (region: { start: number; end: number }) => void
}

export interface WebGLPileupRenderingHandle {
  setColorScheme: (scheme: number) => void
  setDomain: (domainX: [number, number]) => void
  refresh: () => void
}

export const WebGLPileupRendering = forwardRef<
  WebGLPileupRenderingHandle,
  WebGLPileupRenderingProps
>(function WebGLPileupRendering(props, ref) {
  const {
    width,
    height,
    initialDomainX,
    features,
    loadedRegion,
    featureHeight = 7,
    featureSpacing = 1,
    colorScheme: initialColorScheme = 0,
    showMismatches = true,
    onViewChange,
    onNeedMoreData,
  } = props

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLRenderer | null>(null)

  // View state - managed directly, not through mobx
  const [viewState, setViewState] = useState<RenderState>({
    domainX: initialDomainX,
    rangeY: [0, height],
    colorScheme: initialColorScheme,
    featureHeight,
    featureSpacing,
    showMismatches,
  })

  // Track layout height
  const [maxY, setMaxY] = useState(0)

  // Drag state - use state for cursor to avoid reading ref during render
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef({
    lastX: 0,
    lastY: 0,
  })

  // Initialize WebGL
  useEffect(() => {
    if (!canvasRef.current) {
      return
    }

    try {
      rendererRef.current = new WebGLRenderer(canvasRef.current)
    } catch (e) {
      console.error('Failed to initialize WebGL:', e)
    }

    return () => {
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [])

  // Upload features when they change
  useEffect(() => {
    if (!rendererRef.current || features.length === 0) {
      return
    }

    const { maxY: newMaxY } = rendererRef.current.uploadFeatures(features)
    setMaxY(newMaxY)
  }, [features])

  // Re-render when view state changes
  useEffect(() => {
    if (!rendererRef.current) {
      return
    }
    rendererRef.current.render(viewState)
  }, [viewState])

  // Update view state when props change
  useEffect(() => {
    setViewState(prev => ({
      ...prev,
      featureHeight,
      featureSpacing,
      showMismatches,
    }))
  }, [featureHeight, featureSpacing, showMismatches])

  // Check if we need more data
  const checkDataNeeds = useCallback(
    (domainX: [number, number]) => {
      if (!loadedRegion || !onNeedMoreData) {
        return
      }

      const bufferRatio = 0.2
      const visibleWidth = domainX[1] - domainX[0]
      const buffer = visibleWidth * bufferRatio

      // Check if we're approaching the edge of loaded data
      if (
        domainX[0] - buffer < loadedRegion.start ||
        domainX[1] + buffer > loadedRegion.end
      ) {
        // Request expanded region
        const expandFactor = 3
        const centerX = (domainX[0] + domainX[1]) / 2
        const halfWidth = (visibleWidth * expandFactor) / 2
        onNeedMoreData({
          start: Math.floor(centerX - halfWidth),
          end: Math.ceil(centerX + halfWidth),
        })
      }
    },
    [loadedRegion, onNeedMoreData],
  )

  // Zoom handler (wheel)
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()

      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      if (e.shiftKey) {
        // Vertical scroll
        const rowHeight = featureHeight + featureSpacing
        const totalHeight = maxY * rowHeight
        const panAmount = e.deltaY * 0.5

        setViewState(prev => {
          const newRangeY: [number, number] = [
            Math.max(0, prev.rangeY[0] + panAmount),
            Math.max(height, prev.rangeY[1] + panAmount),
          ]
          // Clamp to content
          if (newRangeY[1] > totalHeight + 50) {
            const overflow = newRangeY[1] - totalHeight - 50
            newRangeY[0] -= overflow
            newRangeY[1] -= overflow
          }
          if (newRangeY[0] < 0) {
            newRangeY[1] -= newRangeY[0]
            newRangeY[0] = 0
          }
          return { ...prev, rangeY: newRangeY }
        })
      } else {
        // Horizontal zoom
        const rect = canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseFrac = mouseX / rect.width

        const zoomFactor = e.deltaY > 0 ? 1.15 : 1 / 1.15

        setViewState(prev => {
          const domainWidth = prev.domainX[1] - prev.domainX[0]
          const mouseGenomicPos = prev.domainX[0] + domainWidth * mouseFrac

          let newWidth = domainWidth * zoomFactor
          // Clamp zoom
          newWidth = Math.max(50, Math.min(10000000, newWidth))

          const newDomainX: [number, number] = [
            mouseGenomicPos - newWidth * mouseFrac,
            mouseGenomicPos + newWidth * (1 - mouseFrac),
          ]

          // Notify parent (asynchronously)
          onViewChange?.(newDomainX, prev.rangeY)
          checkDataNeeds(newDomainX)

          return { ...prev, domainX: newDomainX }
        })
      }
    },
    [height, maxY, featureHeight, featureSpacing, onViewChange, checkDataNeeds],
  )

  // Pan handlers (drag)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    dragRef.current = {
      lastX: e.clientX,
      lastY: e.clientY,
    }
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) {
        return
      }

      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      const dx = e.clientX - dragRef.current.lastX
      const dy = e.clientY - dragRef.current.lastY
      dragRef.current.lastX = e.clientX
      dragRef.current.lastY = e.clientY

      setViewState(prev => {
        const domainWidth = prev.domainX[1] - prev.domainX[0]
        const bpPerPx = domainWidth / canvas.clientWidth
        const panX = -dx * bpPerPx

        const yRange = prev.rangeY[1] - prev.rangeY[0]
        const pxPerY = yRange / canvas.clientHeight
        const panY = dy * pxPerY

        const newDomainX: [number, number] = [
          prev.domainX[0] + panX,
          prev.domainX[1] + panX,
        ]

        const newRangeY: [number, number] = [
          prev.rangeY[0] + panY,
          prev.rangeY[1] + panY,
        ]

        // Clamp Y
        if (newRangeY[0] < 0) {
          newRangeY[1] -= newRangeY[0]
          newRangeY[0] = 0
        }

        // Notify parent
        onViewChange?.(newDomainX, newRangeY)
        checkDataNeeds(newDomainX)

        return { ...prev, domainX: newDomainX, rangeY: newRangeY }
      })
    },
    [isDragging, onViewChange, checkDataNeeds],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Expose imperative methods
  useImperativeHandle(ref, () => ({
    setColorScheme(scheme: number) {
      setViewState(prev => ({ ...prev, colorScheme: scheme }))
    },
    setDomain(domainX: [number, number]) {
      setViewState(prev => ({ ...prev, domainX }))
    },
    refresh() {
      rendererRef.current?.render(viewState)
    },
  }))

  // Calculate some stats for display
  const bpPerPx = (viewState.domainX[1] - viewState.domainX[0]) / width

  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: '100%',
          height: '100%',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
      {/* Debug overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 4,
          left: 4,
          fontSize: 10,
          color: '#666',
          pointerEvents: 'none',
          fontFamily: 'monospace',
        }}
      >
        {Math.round(viewState.domainX[0])}-{Math.round(viewState.domainX[1])} |
        {bpPerPx.toFixed(2)} bp/px |{features.length} reads
      </div>
    </div>
  )
})

export default WebGLPileupRendering
