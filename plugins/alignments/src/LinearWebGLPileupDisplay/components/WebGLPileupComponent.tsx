import React, { useRef, useEffect, useCallback, useState } from 'react'
import { observer } from 'mobx-react'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import { WebGLRenderer } from './WebGLRenderer'

import type { LinearWebGLPileupDisplayModel, FeatureData } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  container: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  canvas: {
    display: 'block',
    cursor: 'grab',
    '&:active': {
      cursor: 'grabbing',
    },
  },
  overlay: {
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
  },
  loading: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(255,255,255,0.9)',
    padding: '8px 16px',
    borderRadius: 4,
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
  error: {
    color: '#c00',
    padding: 16,
  },
})

interface Props {
  model: LinearWebGLPileupDisplayModel
}

const WebGLPileupComponent = observer(function WebGLPileupComponent({
  model,
}: Props) {
  const { classes } = useStyles()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Local state for smooth interaction (bypasses mobx)
  const [localDomain, setLocalDomain] = useState<[number, number] | null>(null)
  const [localRangeY, setLocalRangeY] = useState<[number, number]>([0, 600])
  const [maxY, setMaxY] = useState(0)

  // Drag state
  const dragRef = useRef({
    isDragging: false,
    lastX: 0,
    lastY: 0,
  })

  // Get view for dimensions and current domain
  const view = getContainingView(model) as LinearGenomeViewModel | undefined

  const {
    webglFeatures,
    isLoading,
    error,
    featureHeight,
    featureSpacing,
    colorSchemeIndex,
    showMismatches,
    visibleRegion,
  } = model

  // Dimensions - use fallback if view not ready
  const width = view?.initialized ? view.width : 800
  const height = model.height

  // Get domain from local state or view
  const domain: [number, number] = localDomain ?? [
    visibleRegion?.start ?? 0,
    visibleRegion?.end ?? 10000,
  ]

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
    if (!rendererRef.current || webglFeatures.length === 0) {
      return
    }

    const result = rendererRef.current.uploadFeatures(webglFeatures)
    setMaxY(result.maxY)
    model.setMaxY(result.maxY)
  }, [webglFeatures, model])

  // Render when state changes
  useEffect(() => {
    if (!rendererRef.current) {
      return
    }

    const bpPerPx = (domain[1] - domain[0]) / width

    rendererRef.current.render({
      domainX: domain,
      rangeY: localRangeY,
      colorScheme: colorSchemeIndex,
      featureHeight,
      featureSpacing,
      showMismatches: showMismatches && bpPerPx < 10,
    })
  }, [
    domain,
    localRangeY,
    colorSchemeIndex,
    featureHeight,
    featureSpacing,
    showMismatches,
    width,
    webglFeatures, // Re-render when features change
  ])

  // Sync domain from view when it changes externally
  useEffect(() => {
    if (visibleRegion && !dragRef.current.isDragging) {
      setLocalDomain([visibleRegion.start, visibleRegion.end])
    }
  }, [visibleRegion?.start, visibleRegion?.end])

  // Check if we need more data
  const checkDataNeeds = useCallback(
    (newDomain: [number, number]) => {
      const loadedRegion = model.loadedRegion
      if (!loadedRegion) {
        return
      }

      const buffer = (newDomain[1] - newDomain[0]) * 0.5
      if (
        newDomain[0] - buffer < loadedRegion.start ||
        newDomain[1] + buffer > loadedRegion.end
      ) {
        model.handleNeedMoreData({
          start: newDomain[0],
          end: newDomain[1],
        })
      }
    },
    [model],
  )

  // Zoom handler
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.shiftKey) {
        // Vertical scroll
        const rowHeight = featureHeight + featureSpacing
        const totalHeight = maxY * rowHeight
        const panAmount = e.deltaY * 0.5

        setLocalRangeY(prev => {
          let newY: [number, number] = [
            prev[0] + panAmount,
            prev[1] + panAmount,
          ]
          // Clamp
          if (newY[0] < 0) {
            newY = [0, newY[1] - newY[0]]
          }
          if (newY[1] > totalHeight + 50) {
            const overflow = newY[1] - totalHeight - 50
            newY = [newY[0] - overflow, newY[1] - overflow]
          }
          return newY
        })
      } else {
        // Horizontal zoom
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) {
          return
        }

        const mouseX = e.clientX - rect.left
        const frac = mouseX / width

        const zoomFactor = e.deltaY > 0 ? 1.15 : 1 / 1.15

        setLocalDomain(prev => {
          const currentDomain = prev ?? domain
          const domainWidth = currentDomain[1] - currentDomain[0]
          const mousePos = currentDomain[0] + domainWidth * frac

          let newWidth = domainWidth * zoomFactor
          newWidth = Math.max(50, Math.min(10000000, newWidth))

          const newDomain: [number, number] = [
            mousePos - newWidth * frac,
            mousePos + newWidth * (1 - frac),
          ]

          // Check if we need more data
          checkDataNeeds(newDomain)

          return newDomain
        })
      }
    },
    [domain, featureHeight, featureSpacing, maxY, width, checkDataNeeds],
  )

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
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

      // Pan X
      setLocalDomain(prev => {
        const currentDomain = prev ?? domain
        const domainWidth = currentDomain[1] - currentDomain[0]
        const bpPerPx = domainWidth / width
        const panX = -dx * bpPerPx

        const newDomain: [number, number] = [
          currentDomain[0] + panX,
          currentDomain[1] + panX,
        ]

        checkDataNeeds(newDomain)
        return newDomain
      })

      // Pan Y
      setLocalRangeY(prev => {
        const yRange = prev[1] - prev[0]
        const pxPerY = yRange / height
        const panY = dy * pxPerY

        let newY: [number, number] = [prev[0] + panY, prev[1] + panY]
        if (newY[0] < 0) {
          newY = [0, newY[1] - newY[0]]
        }
        return newY
      })
    },
    [domain, width, height, checkDataNeeds],
  )

  const handleMouseUp = useCallback(() => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false
      // Optionally sync back to view
      // view.navTo({ start: localDomain[0], end: localDomain[1] })
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    dragRef.current.isDragging = false
  }, [])

  // Calculate stats
  const bpPerPx = (domain[1] - domain[0]) / width

  if (error) {
    return <div className={classes.error}>Error: {error.message}</div>
  }

  return (
    <div ref={containerRef} className={classes.container} style={{ height }}>
      <canvas
        ref={canvasRef}
        className={classes.canvas}
        width={width}
        height={height}
        style={{ width, height }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />

      {isLoading && <div className={classes.loading}>Loading features...</div>}

      <div className={classes.overlay}>
        {Math.round(domain[0])}-{Math.round(domain[1])} | {bpPerPx.toFixed(2)}{' '}
        bp/px | {webglFeatures.length} reads
      </div>
    </div>
  )
})

export default WebGLPileupComponent
