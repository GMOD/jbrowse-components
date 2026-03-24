import { useEffect, useRef, useState } from 'react'
import { autorun, reaction } from 'mobx'
import { observer } from 'mobx-react'
import {
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  IconButton,
  ToggleButton,
  LinearProgress,
} from '@mui/material'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import CropFreeIcon from '@mui/icons-material/CropFree'
import DeleteIcon from '@mui/icons-material/Delete'
import LinearScaleIcon from '@mui/icons-material/LinearScale'

import {
  buildGeometry,
  brightenColors,
  extractColorSlice,
} from '../../renderer/GeometryBuilder.ts'
import { GraphRenderer } from '../../renderer/GraphRenderer.ts'
import { findHoveredNode, findHoveredEdge } from '../../util/hitDetection.ts'

import type { GraphGenomeViewModel } from '../model.ts'
import type { ColorScheme } from '../../types.ts'

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

function renderFrame(
  renderer: GraphRenderer,
  model: GraphGenomeViewModel,
  darkMode: boolean,
) {
  const dpr = window.devicePixelRatio || 1
  renderer.updateTransform({
    scaleX: model.scale * dpr,
    scaleY: model.scale * dpr,
    translateX: model.translateX * dpr,
    translateY: model.translateY * dpr,
    viewportWidth: model.width * dpr,
    viewportHeight: CANVAS_HEIGHT * dpr,
  })
  renderer.render(darkMode ? [0.12, 0.12, 0.12, 1.0] : [1.0, 1.0, 1.0, 1.0])
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

const ZoomDisplay = observer(function ZoomDisplay({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  return (
    <Typography variant="body2" style={{ marginLeft: 8 }}>
      {model.zoomPercent}
    </Typography>
  )
})

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
    return reaction(
      () => model.layoutResult,
      () => {
        if (model.layoutResult) {
          model.zoomToFit(CANVAS_HEIGHT)
        }
      },
    )
  }, [model])

  // Reaction 1: Rebuild geometry when graph data or display options change.
  // Does NOT trigger on hover, select, scale, or translate — those are read
  // only in the effect body which is untracked by MobX.
  useEffect(() => {
    if (!rendererReady) {
      return
    }
    return reaction(
      () => ({
        nodePositions: model.nodePositions,
        graph: model.graph,
        colorScheme: model.colorScheme,
        contigThickness: model.contigThickness,
        connectorThickness: model.connectorThickness,
        drawPaths: model.drawPaths,
        darkMode: model.darkMode,
        viewportDirty: model.viewportDirty,
      }),
      ({ nodePositions, graph, colorScheme, contigThickness, connectorThickness, drawPaths, darkMode }) => {
        const renderer = rendererRef.current
        if (!renderer || !nodePositions || !graph) {
          return
        }
        const viewportBounds = computeViewportBounds(model)
        const batch = buildGeometry({
          nodePositions,
          graph,
          colorScheme,
          contigThickness,
          connectorThickness,
          drawPaths,
          viewportBounds,
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
        renderFrame(renderer, model, darkMode)
      },
      { fireImmediately: true },
    )
  }, [model, rendererReady])

  // Reaction 2: Hover/select color-only updates — no geometry rebuild.
  useEffect(() => {
    if (!rendererReady) {
      return
    }

    let prevHoveredNode: string | null = null
    let prevHoveredEdge: number | null = null
    let prevSelectedNode: string | null = null

    return reaction(
      () => ({
        hoveredNode: model.hoveredNode,
        hoveredEdge: model.hoveredEdge,
        selectedNode: model.selectedNode,
      }),
      ({ hoveredNode, hoveredEdge, selectedNode }) => {
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

        renderFrame(renderer, model, model.darkMode)
      },
    )
  }, [model, rendererReady])

  // Autorun 3: Re-render on pan/zoom without rebuilding geometry (cheap)
  useEffect(() => {
    if (!rendererReady) {
      return
    }
    return autorun(() => {
      const renderer = rendererRef.current
      if (!renderer || !model.nodePositions) {
        return
      }
      renderFrame(renderer, model, model.darkMode)
    })
  }, [model, rendererReady])

  // Reaction 4: Debounced viewport culling — rebuild geometry after pan/zoom settles
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    return reaction(
      () => ({
        scale: model.scale,
        translateX: model.translateX,
        translateY: model.translateY,
      }),
      () => {
        if (timer) {
          clearTimeout(timer)
        }
        timer = setTimeout(() => {
          model.setViewportDirty()
        }, VIEWPORT_DEBOUNCE_MS)
      },
    )
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          borderBottom: '1px solid #ddd',
          flexWrap: 'wrap',
        }}
      >
        <FormControl size="small" style={{ minWidth: 120 }}>
          <InputLabel>Color</InputLabel>
          <Select
            value={model.colorScheme}
            label="Color"
            onChange={e => model.setColorScheme(e.target.value as ColorScheme)}
          >
            <MenuItem value="uniform">Uniform</MenuItem>
            <MenuItem value="random">Random</MenuItem>
            <MenuItem value="depth">Depth</MenuItem>
            <MenuItem value="gc-content">GC Content</MenuItem>
            <MenuItem value="grey">Grey</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" style={{ minWidth: 100 }}>
          <InputLabel>Quality</InputLabel>
          <Select
            value={model.layoutQuality}
            label="Quality"
            onChange={e => {
              model.setLayoutQuality(Number(e.target.value))
              model.recomputeLayout()
            }}
          >
            <MenuItem value={0}>Lowest</MenuItem>
            <MenuItem value={1}>Low</MenuItem>
            <MenuItem value={2}>Medium</MenuItem>
            <MenuItem value={3}>High</MenuItem>
            <MenuItem value={4}>Highest</MenuItem>
          </Select>
        </FormControl>

        <Tooltip title="Linear layout">
          <ToggleButton
            size="small"
            value="linear"
            selected={model.linearLayout}
            onChange={() => {
              model.setLinearLayout(!model.linearLayout)
              model.recomputeLayout()
            }}
          >
            <LinearScaleIcon />
          </ToggleButton>
        </Tooltip>

        <Tooltip title="Zoom in">
          <IconButton
            size="small"
            onClick={() => model.zoom(1.5, model.width / 2, CANVAS_HEIGHT / 2)}
          >
            <ZoomInIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Zoom out">
          <IconButton
            size="small"
            onClick={() =>
              model.zoom(1 / 1.5, model.width / 2, CANVAS_HEIGHT / 2)
            }
          >
            <ZoomOutIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Zoom to fit">
          <IconButton
            size="small"
            onClick={() => model.zoomToFit(CANVAS_HEIGHT)}
          >
            <CropFreeIcon />
          </IconButton>
        </Tooltip>

        <ZoomDisplay model={model} />

        <Typography variant="body2" style={{ marginLeft: 'auto' }}>
          {model.nodeCount} nodes, {model.edgeCount} edges
          {model.pathCount > 0 ? `, ${model.pathCount} paths` : ''}
        </Typography>

        <Tooltip title="Close graph">
          <IconButton size="small" onClick={() => model.clearGraph()}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </div>

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
