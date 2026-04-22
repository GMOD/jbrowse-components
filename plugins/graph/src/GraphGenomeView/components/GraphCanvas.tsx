import { useEffect, useRef, useState } from 'react'

import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'
import { useGpuModelLifecycle } from '@jbrowse/core/util'
import { LinearProgress, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import GraphToolbar from './GraphToolbar.tsx'
import { createGraphRenderer } from '../../renderer/GraphRenderer.ts'
import { findHoveredEdge, findHoveredNode } from '../../util/hitDetection.ts'

import type { GraphGenomeViewModel } from '../model.ts'

const tooltipStyle = {
  position: 'absolute' as const,
  bottom: 8,
  left: 8,
  background: 'rgba(0,0,0,0.75)',
  color: 'white',
  padding: '4px 8px',
  borderRadius: 4,
  fontSize: 12,
  pointerEvents: 'none' as const,
}

const HoverTooltips = observer(function HoverTooltips({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  const hoveredNodeData = model.hoveredNode
    ? model.nodeById?.get(model.hoveredNode)
    : null

  const hoveredEdgeData =
    model.hoveredEdge !== null && model.graph
      ? model.graph.edges[model.hoveredEdge]
      : null

  return (
    <>
      {hoveredNodeData ? (
        <div style={tooltipStyle}>
          <strong>{hoveredNodeData.name}</strong> — length:{' '}
          {hoveredNodeData.length.toLocaleString()}, depth:{' '}
          {hoveredNodeData.depth.toFixed(1)}
        </div>
      ) : null}
      {hoveredEdgeData ? (
        <div style={tooltipStyle}>
          Edge: {hoveredEdgeData.from} → {hoveredEdgeData.to}
        </div>
      ) : null}
    </>
  )
})

const GraphCanvas = observer(function GraphCanvas({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  const { canvasRef, canvas } = useGpuModelLifecycle(createGraphRenderer, model)
  const isDraggingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const lastMouseRef = useRef({ x: 0, y: 0 })

  // wheel events need passive:false to call preventDefault — React registers
  // wheel listeners as passive, so we must add this imperatively
  useEffect(() => {
    if (canvas) {
      const c = canvas
      function handleWheel(e: WheelEvent) {
        e.preventDefault()
        const rect = c.getBoundingClientRect()
        model.zoom(
          e.deltaY < 0 ? 1.1 : 1 / 1.1,
          e.clientX - rect.left,
          e.clientY - rect.top,
        )
      }
      c.addEventListener('wheel', handleWheel, { passive: false })
      return () => {
        c.removeEventListener('wheel', handleWheel)
      }
    }
    return undefined
  }, [canvas, model])

  function screenToGraph(screenX: number, screenY: number) {
    return {
      x: (screenX - model.translateX) / model.scale,
      y: (screenY - model.translateY) / model.scale,
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button === 0) {
      if (model.nodePositions) {
        const rect = (
          e.currentTarget as HTMLCanvasElement
        ).getBoundingClientRect()
        const { x, y } = screenToGraph(
          e.clientX - rect.left,
          e.clientY - rect.top,
        )
        const node = findHoveredNode(model.nodePositions, x, y, model.scale)
        if (node) {
          model.setDraggingNode(node)
        } else {
          isDraggingRef.current = true
          setIsDragging(true)
        }
      } else {
        isDraggingRef.current = true
        setIsDragging(true)
      }
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    const dx = e.clientX - lastMouseRef.current.x
    const dy = e.clientY - lastMouseRef.current.y
    lastMouseRef.current = { x: e.clientX, y: e.clientY }

    if (model.draggingNode) {
      model.moveNode(model.draggingNode, dx / model.scale, dy / model.scale)
    } else if (isDraggingRef.current) {
      model.setTransform(
        model.scale,
        model.translateX + dx,
        model.translateY + dy,
      )
    } else if (model.nodePositions && model.graph) {
      const rect = (
        e.currentTarget as HTMLCanvasElement
      ).getBoundingClientRect()
      const { x, y } = screenToGraph(
        e.clientX - rect.left,
        e.clientY - rect.top,
      )
      const node = findHoveredNode(model.nodePositions, x, y, model.scale)
      model.setHoveredNode(node)
      model.setHoveredEdge(
        node
          ? null
          : findHoveredEdge(
              model.nodePositions,
              model.graph,
              x,
              y,
              model.scale,
              model.drawPaths,
            ),
      )
    }
  }

  function handleMouseUp() {
    isDraggingRef.current = false
    setIsDragging(false)
    model.setDraggingNode(null)
  }

  function handleMouseLeave() {
    isDraggingRef.current = false
    setIsDragging(false)
    model.setDraggingNode(null)
    model.setHoveredNode(null)
    model.setHoveredEdge(null)
  }

  function handleClick(e: React.MouseEvent) {
    if (model.nodePositions) {
      const rect = (
        e.currentTarget as HTMLCanvasElement
      ).getBoundingClientRect()
      const { x, y } = screenToGraph(
        e.clientX - rect.left,
        e.clientY - rect.top,
      )
      model.setSelectedNode(
        findHoveredNode(model.nodePositions, x, y, model.scale),
      )
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <GraphToolbar model={model} />

      {model.isLoading ? (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            background: 'rgba(255,255,255,0.8)',
            padding: 16,
            borderRadius: 8,
            minWidth: 200,
          }}
        >
          <Typography>{model.statusMessage || 'Loading...'}</Typography>
          <LinearProgress variant="indeterminate" style={{ marginTop: 8 }} />
        </div>
      ) : null}

      <canvas
        ref={canvasRef}
        style={{
          width: model.width,
          height: model.canvasHeight,
          cursor: isDragging || model.draggingNode ? 'grabbing' : 'grab',
          display: 'block',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />

      <HoverTooltips model={model} />

      {model.error ? <ErrorMessage error={model.error} /> : null}
    </div>
  )
})

export default GraphCanvas
