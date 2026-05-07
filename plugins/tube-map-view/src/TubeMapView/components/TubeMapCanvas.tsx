import { useRef } from 'react'

import { observer } from 'mobx-react'

import { CANVAS_HEIGHT } from '../model.ts'

import type { TubeMapLayout, TubeMapNode } from '../../layout/types.ts'
import type { TubeMapViewModel } from '../model.ts'

// color palette for tracks (similar to sequenceTubeMap)
const TRACK_COLORS = [
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
  '#bcbd22',
  '#17becf',
]

function getTrackColor(idx: number) {
  return TRACK_COLORS[idx % TRACK_COLORS.length]
}

const NODE_RADIUS = 4

const MIN_SEQ_DISPLAY_WIDTH = 50
function NodeRect({
  node,
  isHovered,
  isSelected,
  scale,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  node: TubeMapNode
  isHovered: boolean
  isSelected: boolean
  scale: number
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
}) {
  const screenWidth = node.pixelWidth * scale
  const nodeHeight = Math.max(node.contentHeight, 6)
  const seq = screenWidth > MIN_SEQ_DISPLAY_WIDTH ? node.sequence : undefined
  const fontSize = seq
    ? Math.min(
        10,
        nodeHeight * 0.7,
        (node.pixelWidth / node.sequenceLength) * 0.9,
      )
    : 0
  const maxChars = seq ? Math.floor(node.pixelWidth / (fontSize * 0.6)) : 0
  const displaySeq = seq ? seq.slice(0, maxChars) : ''

  return (
    <g>
      <rect
        x={node.x}
        y={node.y}
        width={node.pixelWidth}
        height={nodeHeight}
        rx={NODE_RADIUS}
        ry={NODE_RADIUS}
        fill={isSelected ? '#ffeb3b' : isHovered ? '#e3f2fd' : '#f5f5f5'}
        stroke={isSelected ? '#f57f17' : isHovered ? '#1976d2' : '#999'}
        strokeWidth={isSelected || isHovered ? 2 : 1}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        style={{ cursor: 'pointer' }}
      />
      <text
        x={node.x + node.pixelWidth / 2}
        y={node.y - 4}
        textAnchor="middle"
        fontSize={9}
        fill="#666"
      >
        {node.name}
        {node.sequence ? ` (${node.sequenceLength}bp)` : ''}
      </text>
      {displaySeq ? (
        <text
          x={node.x + 2}
          y={node.y + nodeHeight / 2 + fontSize * 0.35}
          fontSize={fontSize}
          fontFamily="monospace"
          fill="#333"
          pointerEvents="none"
        >
          {displaySeq}
        </text>
      ) : null}
    </g>
  )
}

function TrackPaths({
  layout,
  hoveredTrack,
  xMin,
  xMax,
}: {
  layout: TubeMapLayout
  hoveredTrack: number | null
  xMin: number
  xMax: number
}) {
  return (
    <>
      {layout.tracks.map((track, trackIdx) => {
        const color = getTrackColor(trackIdx)
        const isHovered = hoveredTrack === trackIdx
        const pathSegments = track.path

        const hasVisible = pathSegments.some(seg => {
          if (seg.node === null) {
            return false
          }
          const n = layout.nodes[seg.node]!
          return n.x + n.pixelWidth >= xMin && n.x <= xMax
        })
        if (!hasVisible) {
          return null
        }

        const pathParts: string[] = []

        for (let i = 0; i < pathSegments.length; i++) {
          const seg = pathSegments[i]!
          const node = seg.node !== null ? layout.nodes[seg.node] : undefined

          if (i === 0) {
            if (node) {
              pathParts.push(
                `M ${node.x} ${seg.y + 3.5}`,
                `L ${node.x + node.pixelWidth} ${seg.y + 3.5}`,
              )
            } else {
              // edge segment at an intermediate order - find x from nodes at this order
              const x = layout.orderToX[seg.order]!
              pathParts.push(`M ${x} ${seg.y + 3.5}`)
            }
          } else {
            const prev = pathSegments[i - 1]!
            const prevNode =
              prev.node !== null ? layout.nodes[prev.node] : undefined

            const prevX = prevNode
              ? prevNode.x + prevNode.pixelWidth
              : layout.orderToX[prev.order]! + 5

            if (node) {
              // curve from previous segment to this node
              const targetX = node.x
              const targetY = seg.y + 3.5
              const prevY = prev.y + 3.5
              if (Math.abs(targetY - prevY) < 1) {
                pathParts.push(`L ${targetX} ${targetY}`)
              } else {
                const midX = (prevX + targetX) / 2
                pathParts.push(
                  `C ${midX} ${prevY}, ${midX} ${targetY}, ${targetX} ${targetY}`,
                )
              }
              pathParts.push(`L ${node.x + node.pixelWidth} ${targetY}`)
            } else {
              const x = layout.orderToX[seg.order]!
              const targetY = seg.y + 3.5
              const prevY = prev.y + 3.5
              if (Math.abs(targetY - prevY) < 1) {
                pathParts.push(`L ${x + 5} ${targetY}`)
              } else {
                const midX = (prevX + x) / 2
                pathParts.push(
                  `C ${midX} ${prevY}, ${midX} ${targetY}, ${x + 5} ${targetY}`,
                )
              }
            }
          }
        }

        return (
          <path
            key={track.id}
            d={pathParts.join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={isHovered ? 5 : 3}
            strokeLinecap="round"
            opacity={hoveredTrack !== null && !isHovered ? 0.3 : 0.85}
          />
        )
      })}
    </>
  )
}

function TrackLegend({
  layout,
  hoveredTrack,
  onHoverTrack,
}: {
  layout: TubeMapLayout
  hoveredTrack: number | null
  onHoverTrack: (idx: number | null) => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid #ccc',
        borderRadius: 4,
        padding: '6px 10px',
        fontSize: 12,
        zIndex: 10,
        maxHeight: 200,
        overflowY: 'auto',
      }}
    >
      {layout.tracks.map((track, idx) => (
        <div
          key={track.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 0',
            opacity: hoveredTrack !== null && hoveredTrack !== idx ? 0.4 : 1,
            cursor: 'pointer',
            fontWeight: hoveredTrack === idx ? 600 : 400,
          }}
          onMouseEnter={() => {
            onHoverTrack(idx)
          }}
          onMouseLeave={() => {
            onHoverTrack(null)
          }}
        >
          <div
            style={{
              width: 14,
              height: 4,
              borderRadius: 2,
              background: getTrackColor(idx),
              flexShrink: 0,
            }}
          />
          <span>{track.name}</span>
        </div>
      ))}
    </div>
  )
}

function getVisibleRange(
  scale: number,
  translateX: number,
  translateY: number,
  viewWidth: number,
  viewHeight: number,
) {
  const xMin = -translateX / scale
  const xMax = (viewWidth - translateX) / scale
  const yMin = -translateY / scale
  const yMax = (viewHeight - translateY) / scale
  return { xMin, xMax, yMin, yMax }
}

const TubeMapCanvas = observer(function TubeMapCanvas({
  model,
}: {
  model: TubeMapViewModel
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const { xMin, xMax, yMin, yMax } = getVisibleRange(
    model.scale,
    model.translateX,
    model.translateY,
    model.width,
    CANVAS_HEIGHT,
  )

  const layout = model.layout
  if (!layout) {
    return null
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    const rect = svgRef.current?.getBoundingClientRect()
    if (rect) {
      model.zoom(factor, e.clientX - rect.left, e.clientY - rect.top)
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button === 0) {
      isPanning.current = true
      lastPos.current = { x: e.clientX, y: e.clientY }
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (isPanning.current) {
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      lastPos.current = { x: e.clientX, y: e.clientY }
      model.setTransform(
        model.scale,
        model.translateX + dx,
        model.translateY + dy,
      )
    }
  }

  function handleMouseUp() {
    isPanning.current = false
  }

  return (
    <div
      style={{
        overflow: 'hidden',
        height: CANVAS_HEIGHT,
        background: '#fff',
        position: 'relative',
      }}
    >
      <TrackLegend
        layout={layout}
        hoveredTrack={model.hoveredTrack}
        onHoverTrack={idx => {
          model.setHoveredTrack(idx)
        }}
      />
      <svg
        ref={svgRef}
        width={model.width}
        height={CANVAS_HEIGHT}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning.current ? 'grabbing' : 'grab' }}
      >
        <g
          transform={`translate(${model.translateX},${model.translateY}) scale(${model.scale})`}
        >
          <TrackPaths
            layout={layout}
            hoveredTrack={model.hoveredTrack}
            xMin={xMin}
            xMax={xMax}
          />
          {layout.nodes.map((node, i) => {
            if (node.x + node.pixelWidth < xMin || node.x > xMax) {
              return null
            }
            if (node.y + node.contentHeight < yMin || node.y > yMax) {
              return null
            }
            return (
              <NodeRect
                key={node.name}
                node={node}
                isHovered={model.hoveredNode === i}
                isSelected={model.selectedNode === i}
                scale={model.scale}
                onMouseEnter={() => {
                  model.setHoveredNode(i)
                }}
                onMouseLeave={() => {
                  model.setHoveredNode(null)
                }}
                onClick={() => {
                  model.setSelectedNode(model.selectedNode === i ? null : i)
                }}
              />
            )
          })}
        </g>
      </svg>
    </div>
  )
})

export default TubeMapCanvas
