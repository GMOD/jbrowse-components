import { useEffect, useRef, useState } from 'react'
import { autorun, untracked } from 'mobx'
import { observer } from 'mobx-react'
import { Typography, LinearProgress } from '@mui/material'

import {
  buildGeometry,
  brightenColors,
  extractColorSlice,
} from '../../renderer/GeometryBuilder.ts'
import { GraphRenderer } from '../../renderer/GraphRenderer.ts'
import { findHoveredNode, findHoveredEdge } from '../../util/hitDetection.ts'
import GraphToolbar from './GraphToolbar.tsx'
import useRafCallback from '../../util/useRafCallback.ts'

import type { GraphGenomeViewModel } from '../model.ts'

export const CANVAS_HEIGHT = 600
const HOVER_BRIGHTEN = 1.4
const SELECT_BRIGHTEN = 1.6
const VIEWPORT_DEBOUNCE_MS = 150

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

function renderFrame(renderer: GraphRenderer, model: GraphGenomeViewModel) {
  const dpr = window.devicePixelRatio || 1
  renderer.updateTransform({
    scaleX: model.scale * dpr,
    scaleY: model.scale * dpr,
    translateX: model.translateX * dpr,
    translateY: model.translateY * dpr,
    viewportWidth: model.width * dpr,
    viewportHeight: CANVAS_HEIGHT * dpr,
  })
  renderer.render(
    model.darkMode ? [0.12, 0.12, 0.12, 1.0] : [1.0, 1.0, 1.0, 1.0],
  )
}

function computeViewportBounds(model: GraphGenomeViewModel) {
  const padding = 0.2
  const minX = -model.translateX / model.scale
  const minY = -model.translateY / model.scale
  const maxX = (model.width - model.translateX) / model.scale
  const maxY = (CANVAS_HEIGHT - model.translateY) / model.scale
  const w = maxX - minX
  const h = maxY - minY
  return {
    minX: minX - w * padding,
    minY: minY - h * padding,
    maxX: maxX + w * padding,
    maxY: maxY + h * padding,
  }
}

const HoverTooltips = observer(function HoverTooltips({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  const hoveredNodeData =
    model.hoveredNode && model.graph
      ? model.graph.nodes.find(n => n.id === model.hoveredNode)
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<GraphRenderer | null>(null)
  const [rendererReady, setRendererReady] = useState(false)
  const isDraggingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const lastMouseRef = useRef({ x: 0, y: 0 })

  const scheduleRender = useRafCallback(() => {
    const renderer = rendererRef.current
    if (renderer) {
      renderFrame(renderer, model)
    }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const renderer = new GraphRenderer(canvas)
    let destroyed = false

    renderer.init().then(() => {
      if (destroyed) {
        renderer.destroy()
        return
      }
      renderer.resize(model.width, CANVAS_HEIGHT)
      rendererRef.current = renderer
      setRendererReady(true)
    })

    return () => {
      destroyed = true
      rendererRef.current?.destroy()
      rendererRef.current = null
      setRendererReady(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.resize(model.width, CANVAS_HEIGHT)
    }
  }, [model.width])

  useEffect(() => {
    let first = true
    return autorun(() => {
      const lr = model.layoutResult
      if (first) {
        first = false
        return
      }
      if (lr) {
        model.zoomToFit(CANVAS_HEIGHT)
      }
    })
  }, [model])

  // Autorun 1: Rebuild geometry when graph data or display options change.
  // computeViewportBounds is wrapped in untracked so scale/translate changes
  // don't trigger a rebuild — only the debounced viewportDirty flag does.
  useEffect(() => {
    if (!rendererReady) {
      return
    }
    return autorun(() => {
      const renderer = rendererRef.current
      if (!renderer || !model.nodePositions || !model.graph) {
        return
      }
      const _vd = model.viewportDirty
      const batch = buildGeometry({
        nodePositions: model.nodePositions,
        graph: model.graph,
        colorScheme: model.colorScheme,
        contigThickness: model.contigThickness,
        connectorThickness: model.connectorThickness,
        drawPaths: model.drawPaths,
        viewportBounds: untracked(() => computeViewportBounds(model)),
      })
      model.storeRenderBatchMeta(
        batch.nodeVertexRanges,
        batch.edgeVertexRanges,
        batch.arrowVertexRanges,
        batch.nodes.colors,
        batch.edges.colors,
        batch.arrows.colors,
      )
      renderer.uploadGeometry(batch)
      scheduleRender()
    })
  }, [model, rendererReady])

  // Autorun 2: Hover/select color-only updates — no geometry rebuild.
  useEffect(() => {
    if (!rendererReady) {
      return
    }

    let prevHoveredNode: string | null = null
    let prevHoveredEdge: number | null = null
    let prevSelectedNode: string | null = null

    return autorun(() => {
      const hoveredNode = model.hoveredNode
      const hoveredEdge = model.hoveredEdge
      const selectedNode = model.selectedNode
      const renderer = rendererRef.current
      if (!renderer) {
        return
      }

      // Restore previous node highlights
      if (prevHoveredNode && model.baseNodeColors && model.nodeVertexRanges) {
        const range = model.nodeVertexRanges.get(prevHoveredNode)
        if (range) {
          const original = extractColorSlice(model.baseNodeColors, range)
          renderer.updateSubBatchColors('nodes', original, range.start)
        }
      }
      if (
        prevSelectedNode &&
        prevSelectedNode !== prevHoveredNode &&
        model.baseNodeColors &&
        model.nodeVertexRanges
      ) {
        const range = model.nodeVertexRanges.get(prevSelectedNode)
        if (range) {
          const original = extractColorSlice(model.baseNodeColors, range)
          renderer.updateSubBatchColors('nodes', original, range.start)
        }
      }

      // Restore previous edge highlights
      if (prevHoveredEdge !== null) {
        if (model.baseEdgeColors && model.edgeVertexRanges) {
          const range = model.edgeVertexRanges.get(prevHoveredEdge)
          if (range) {
            const original = extractColorSlice(model.baseEdgeColors, range)
            renderer.updateSubBatchColors('edges', original, range.start)
          }
        }
        if (model.baseArrowColors && model.arrowVertexRanges) {
          const range = model.arrowVertexRanges.get(prevHoveredEdge)
          if (range) {
            const original = extractColorSlice(model.baseArrowColors, range)
            renderer.updateSubBatchColors('arrows', original, range.start)
          }
        }
      }

      // Apply selected node highlight
      if (selectedNode && model.baseNodeColors && model.nodeVertexRanges) {
        const range = model.nodeVertexRanges.get(selectedNode)
        if (range) {
          const brightened = brightenColors(
            model.baseNodeColors,
            range,
            SELECT_BRIGHTEN,
          )
          renderer.updateSubBatchColors('nodes', brightened, range.start)
        }
      }

      // Apply hovered node highlight
      if (
        hoveredNode &&
        hoveredNode !== selectedNode &&
        model.baseNodeColors &&
        model.nodeVertexRanges
      ) {
        const range = model.nodeVertexRanges.get(hoveredNode)
        if (range) {
          const brightened = brightenColors(
            model.baseNodeColors,
            range,
            HOVER_BRIGHTEN,
          )
          renderer.updateSubBatchColors('nodes', brightened, range.start)
        }
      }

      // Apply hovered edge highlight
      if (hoveredEdge !== null) {
        if (model.baseEdgeColors && model.edgeVertexRanges) {
          const range = model.edgeVertexRanges.get(hoveredEdge)
          if (range) {
            const brightened = brightenColors(
              model.baseEdgeColors,
              range,
              HOVER_BRIGHTEN,
            )
            renderer.updateSubBatchColors('edges', brightened, range.start)
          }
        }
        if (model.baseArrowColors && model.arrowVertexRanges) {
          const range = model.arrowVertexRanges.get(hoveredEdge)
          if (range) {
            const brightened = brightenColors(
              model.baseArrowColors,
              range,
              HOVER_BRIGHTEN,
            )
            renderer.updateSubBatchColors('arrows', brightened, range.start)
          }
        }
      }

      prevHoveredNode = hoveredNode
      prevHoveredEdge = hoveredEdge
      prevSelectedNode = selectedNode

      scheduleRender()
    })
  }, [model, rendererReady])

  // Autorun 3: Re-render on pan/zoom/darkMode without rebuilding geometry (cheap).
  // Uses autorun so MobX automatically tracks all observables read by renderFrame.
  useEffect(() => {
    if (!rendererReady) {
      return
    }
    return autorun(() => {
      const renderer = rendererRef.current
      if (!renderer || !model.nodePositions) {
        return
      }
      renderFrame(renderer, model)
    })
  }, [model, rendererReady])

  // Autorun 4: Debounced viewport culling — rebuild geometry after pan/zoom settles
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let first = true
    return autorun(() => {
      // Read scale/translate to track them as dependencies
      const _s = model.scale
      const _tx = model.translateX
      const _ty = model.translateY
      if (first) {
        first = false
        return
      }
      if (timer) {
        clearTimeout(timer)
      }
      timer = setTimeout(() => {
        model.setViewportDirty()
      }, VIEWPORT_DEBOUNCE_MS)
    })
  }, [model])

  function screenToGraph(screenX: number, screenY: number) {
    return {
      x: (screenX - model.translateX) / model.scale,
      y: (screenY - model.translateY) / model.scale,
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button === 0) {
      isDraggingRef.current = true
      setIsDragging(true)
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (isDraggingRef.current) {
      const dx = e.clientX - lastMouseRef.current.x
      const dy = e.clientY - lastMouseRef.current.y
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
      model.setTransform(
        model.scale,
        model.translateX + dx,
        model.translateY + dy,
      )
    } else if (model.nodePositions && model.graph) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) {
        return
      }
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
  }

  function handleMouseLeave() {
    isDraggingRef.current = false
    setIsDragging(false)
    model.setHoveredNode(null)
    model.setHoveredEdge(null)
  }

  function handleClick(e: React.MouseEvent) {
    if (model.nodePositions) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) {
        return
      }
      const { x, y } = screenToGraph(
        e.clientX - rect.left,
        e.clientY - rect.top,
      )
      model.setSelectedNode(
        findHoveredNode(model.nodePositions, x, y, model.scale),
      )
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return undefined
    }
    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = canvas!.getBoundingClientRect()
      model.zoom(
        e.deltaY < 0 ? 1.1 : 1 / 1.1,
        e.clientX - rect.left,
        e.clientY - rect.top,
      )
    }
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [model])

  return (
    <div style={{ position: 'relative' }}>
      <GraphToolbar model={model} canvasHeight={CANVAS_HEIGHT} />

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
          height: CANVAS_HEIGHT,
          cursor: isDragging ? 'grabbing' : 'grab',
          display: 'block',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />

      <HoverTooltips model={model} />

      {model.error ? (
        <Typography color="error" variant="body2" style={{ padding: 8 }}>
          {model.error}
        </Typography>
      ) : null}
    </div>
  )
})

export default GraphCanvas
