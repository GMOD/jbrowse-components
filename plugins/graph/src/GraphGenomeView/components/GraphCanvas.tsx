import { useEffect, useRef } from 'react'
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

import { buildGeometry } from '../../renderer/GeometryBuilder.ts'
import { GraphRenderer } from '../../renderer/GraphRenderer.ts'
import { findHoveredNode, findHoveredEdge } from '../../util/hitDetection.ts'

import type { GraphGenomeViewModel } from '../model.ts'
import type { ColorScheme } from '../../types.ts'

const CANVAS_HEIGHT = 600

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

const GraphCanvas = observer(function GraphCanvas({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<GraphRenderer | null>(null)
  const isDraggingRef = useRef(false)
  const lastMouseRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const renderer = GraphRenderer.getOrCreate(canvas)
    let destroyed = false

    renderer.init().then(() => {
      if (destroyed) {
        renderer.destroy()
        return
      }
      renderer.resize(model.width, CANVAS_HEIGHT)
      rendererRef.current = renderer
    })

    return () => {
      destroyed = true
      rendererRef.current?.destroy()
      rendererRef.current = null
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

  useEffect(() => {
    return autorun(() => {
      const renderer = rendererRef.current
      if (!renderer || !model.nodePositions || !model.graph) {
        return
      }

      const batch = buildGeometry({
        nodePositions: model.nodePositions,
        graph: model.graph,
        colorScheme: model.colorScheme,
        contigThickness: model.contigThickness,
        connectorThickness: model.connectorThickness,
        drawPaths: model.drawPaths,
        hoveredNode: model.hoveredNode,
        hoveredEdge: model.hoveredEdge,
        selectedNode: model.selectedNode,
        scale: model.scale,
      })

      renderer.uploadGeometry(batch)

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
        model.darkMode
          ? [0.12, 0.12, 0.12, 1.0]
          : [1.0, 1.0, 1.0, 1.0],
      )
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
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (isDraggingRef.current) {
      const dx = e.clientX - lastMouseRef.current.x
      const dy = e.clientY - lastMouseRef.current.y
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
      model.setTransform(model.scale, model.translateX + dx, model.translateY + dy)
    } else if (model.nodePositions && model.graph) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) {
        return
      }
      const { x, y } = screenToGraph(e.clientX - rect.left, e.clientY - rect.top)

      const node = findHoveredNode(model.nodePositions, x, y, model.scale)
      model.setHoveredNode(node)
      model.setHoveredEdge(
        node
          ? null
          : findHoveredEdge(model.nodePositions, model.graph, x, y, model.scale, model.drawPaths),
      )
    }
  }

  function handleMouseUp() {
    isDraggingRef.current = false
  }

  function handleMouseLeave() {
    isDraggingRef.current = false
    model.setHoveredNode(null)
    model.setHoveredEdge(null)
  }

  function handleClick(e: React.MouseEvent) {
    if (model.nodePositions) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) {
        return
      }
      const { x, y } = screenToGraph(e.clientX - rect.left, e.clientY - rect.top)
      model.setSelectedNode(findHoveredNode(model.nodePositions, x, y, model.scale))
    }
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }
    model.zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - rect.left, e.clientY - rect.top)
  }

  const hoveredNodeData =
    model.hoveredNode && model.graph
      ? model.graph.nodes.find(n => n.id === model.hoveredNode)
      : null

  const hoveredEdgeData =
    model.hoveredEdge !== null && model.graph
      ? model.graph.edges[model.hoveredEdge]
      : null

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
              model.recomputeLayout().catch((err: unknown) => {
                model.setError(`Layout failed: ${err}`)
              })
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
              model.recomputeLayout().catch((err: unknown) => {
                model.setError(`Layout failed: ${err}`)
              })
            }}
          >
            <LinearScaleIcon />
          </ToggleButton>
        </Tooltip>

        <Tooltip title="Zoom in">
          <IconButton size="small" onClick={() => model.zoom(1.5, model.width / 2, CANVAS_HEIGHT / 2)}>
            <ZoomInIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Zoom out">
          <IconButton size="small" onClick={() => model.zoom(1 / 1.5, model.width / 2, CANVAS_HEIGHT / 2)}>
            <ZoomOutIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Zoom to fit">
          <IconButton size="small" onClick={() => model.zoomToFit(CANVAS_HEIGHT)}>
            <CropFreeIcon />
          </IconButton>
        </Tooltip>

        <Typography variant="body2" style={{ marginLeft: 8 }}>
          {model.zoomPercent}
        </Typography>

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
          <Typography>{model.layoutStage || 'Computing layout...'}</Typography>
          <LinearProgress
            variant={model.layoutProgress > 0 ? 'determinate' : 'indeterminate'}
            value={model.layoutProgress}
            style={{ marginTop: 8 }}
          />
        </div>
      ) : null}

      <canvas
        ref={canvasRef}
        style={{
          width: model.width,
          height: CANVAS_HEIGHT,
          cursor: isDraggingRef.current ? 'grabbing' : 'grab',
          display: 'block',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onWheel={handleWheel}
      />

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

      {model.error ? (
        <Typography color="error" variant="body2" style={{ padding: 8 }}>
          {model.error}
        </Typography>
      ) : null}
    </div>
  )
})

export default GraphCanvas
