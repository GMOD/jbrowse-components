import { useEffect, useRef, useState } from 'react'

import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'
import { LinearProgress, Typography } from '@mui/material'
import { autorun, untracked } from 'mobx'
import { observer } from 'mobx-react'

import GraphToolbar from './GraphToolbar.tsx'
import {
  brightenColors,
  buildGeometry,
  extractColorSlice,
} from '../../renderer/GeometryBuilder.ts'
import { GraphRenderer } from '../../renderer/GraphRenderer.ts'
import { findHoveredEdge, findHoveredNode } from '../../util/hitDetection.ts'
import useDebouncedCallback from '../../util/useDebouncedCallback.ts'
import useRafCallback from '../../util/useRafCallback.ts'

import type { SubBatchKey, VertexRange } from '../../renderer/types.ts'
import type { GraphGenomeViewModel } from '../model.ts'

const CANVAS_HEIGHT = 600
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
  renderer.render(model.darkMode ? [0.12, 0.12, 0.12, 1] : [1, 1, 1, 1])
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

function restoreVertexColors<K extends string | number>(
  renderer: GraphRenderer,
  target: SubBatchKey,
  ranges: Map<K, VertexRange> | undefined,
  baseColors: Uint32Array | undefined,
  key: K | null,
) {
  if (key !== null && ranges && baseColors) {
    const range = ranges.get(key)
    if (range) {
      renderer.updateSubBatchColors(target, extractColorSlice(baseColors, range), range.start)
    }
  }
}

function brightenVertexColors<K extends string | number>(
  renderer: GraphRenderer,
  target: SubBatchKey,
  ranges: Map<K, VertexRange> | undefined,
  baseColors: Uint32Array | undefined,
  key: K | null,
  factor: number,
) {
  if (key !== null && ranges && baseColors) {
    const range = ranges.get(key)
    if (range) {
      renderer.updateSubBatchColors(target, brightenColors(baseColors, range, factor), range.start)
    }
  }
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

  const scheduleViewportDirty = useDebouncedCallback(() => {
    model.setViewportDirty()
  }, VIEWPORT_DEBOUNCE_MS)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      const renderer = new GraphRenderer(canvas)
      let destroyed = false

      void renderer.init().then(() => {
        if (destroyed) {
          renderer.destroy()
        } else {
          renderer.resize(model.width, CANVAS_HEIGHT)
          rendererRef.current = renderer
          setRendererReady(true)
        }
      }).catch((e: unknown) => {
        if (!destroyed) {
          model.setError(e)
        }
      })

      return () => {
        destroyed = true
        rendererRef.current?.destroy()
        rendererRef.current = null
        setRendererReady(false)
      }
    }
    return undefined
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
      } else if (lr) {
        model.zoomToFit(CANVAS_HEIGHT)
      }
    })
  }, [model])

  // Autorun 1: Rebuild geometry when graph data or display options change.
  // computeViewportBounds is wrapped in untracked so scale/translate changes
  // don't trigger a rebuild — only the debounced viewportDirty flag does.
  useEffect(() => {
    if (rendererReady) {
      return autorun(() => {
        const renderer = rendererRef.current
        const nodeById = model.nodeById
        if (renderer && model.nodePositions && model.graph && nodeById) {
          void model.viewportDirty
          const batch = buildGeometry({
            nodePositions: model.nodePositions,
            graph: model.graph,
            nodeById,
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
        }
      })
    }
    return undefined
  }, [model, rendererReady, scheduleRender])

  // Autorun 2: Hover/select color-only updates — no geometry rebuild.
  useEffect(() => {
    if (rendererReady) {
      let prevHoveredNode: string | null = null
      let prevHoveredEdge: number | null = null
      let prevSelectedNode: string | null = null

      return autorun(() => {
        const hoveredNode = model.hoveredNode
        const hoveredEdge = model.hoveredEdge
        const selectedNode = model.selectedNode
        const renderer = rendererRef.current
        if (renderer) {
          // Restore previous highlights
          restoreVertexColors(renderer, 'nodes', model.nodeVertexRanges, model.baseNodeColors, prevHoveredNode)
          if (prevSelectedNode !== prevHoveredNode) {
            restoreVertexColors(renderer, 'nodes', model.nodeVertexRanges, model.baseNodeColors, prevSelectedNode)
          }
          restoreVertexColors(renderer, 'edges', model.edgeVertexRanges, model.baseEdgeColors, prevHoveredEdge)
          restoreVertexColors(renderer, 'arrows', model.arrowVertexRanges, model.baseArrowColors, prevHoveredEdge)

          // Apply current highlights
          brightenVertexColors(renderer, 'nodes', model.nodeVertexRanges, model.baseNodeColors, selectedNode, SELECT_BRIGHTEN)
          if (hoveredNode !== selectedNode) {
            brightenVertexColors(renderer, 'nodes', model.nodeVertexRanges, model.baseNodeColors, hoveredNode, HOVER_BRIGHTEN)
          }
          brightenVertexColors(renderer, 'edges', model.edgeVertexRanges, model.baseEdgeColors, hoveredEdge, HOVER_BRIGHTEN)
          brightenVertexColors(renderer, 'arrows', model.arrowVertexRanges, model.baseArrowColors, hoveredEdge, HOVER_BRIGHTEN)

          prevHoveredNode = hoveredNode
          prevHoveredEdge = hoveredEdge
          prevSelectedNode = selectedNode

          scheduleRender()
        }
      })
    }
    return undefined
  }, [model, rendererReady, scheduleRender])

  // Autorun 3: Re-render on pan/zoom/darkMode without rebuilding geometry (cheap).
  // Uses autorun so MobX automatically tracks all observables read by renderFrame.
  useEffect(() => {
    if (rendererReady) {
      return autorun(() => {
        const renderer = rendererRef.current
        if (renderer && model.nodePositions) {
          renderFrame(renderer, model)
        }
      })
    }
    return undefined
  }, [model, rendererReady])

  // Autorun 4: Debounced viewport culling — rebuild geometry after pan/zoom settles
  useEffect(() => {
    let first = true
    return autorun(() => {
      void model.scale
      void model.translateX
      void model.translateY
      if (first) {
        first = false
      } else {
        scheduleViewportDirty()
      }
    })
  }, [model, scheduleViewportDirty])

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
      if (rect) {
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
      if (rect) {
        const { x, y } = screenToGraph(
          e.clientX - rect.left,
          e.clientY - rect.top,
        )
        model.setSelectedNode(
          findHoveredNode(model.nodePositions, x, y, model.scale),
        )
      }
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      function handleWheel(e: WheelEvent) {
        e.preventDefault()
        const c = canvasRef.current
        if (c) {
          const rect = c.getBoundingClientRect()
          model.zoom(
            e.deltaY < 0 ? 1.1 : 1 / 1.1,
            e.clientX - rect.left,
            e.clientY - rect.top,
          )
        }
      }
      canvas.addEventListener('wheel', handleWheel, { passive: false })
      return () => {
        canvas.removeEventListener('wheel', handleWheel)
      }
    }
    return undefined
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

      {model.error ? <ErrorMessage error={model.error} /> : null}
    </div>
  )
})

export default GraphCanvas
