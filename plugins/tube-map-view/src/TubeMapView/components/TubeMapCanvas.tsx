import { useRef } from 'react'

import { observer } from 'mobx-react'

import type { TubeMapViewModel } from '../model.ts'
import type { TubeMapLayout, TubeMapNode } from '../../layout/types.ts'

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
  return TRACK_COLORS[idx % TRACK_COLORS.length]!
}

const NODE_RADIUS = 4

function NodeRect({
  node,
  isHovered,
  isSelected,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  node: TubeMapNode
  isHovered: boolean
  isSelected: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
}) {
  return (
    <g>
      <rect
        x={node.x}
        y={node.y}
        width={node.pixelWidth}
        height={Math.max(node.contentHeight, 6)}
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
      </text>
    </g>
  )
}

function TrackPaths({
  layout,
  hoveredTrack,
}: {
  layout: TubeMapLayout
  hoveredTrack: number | null
}) {
  return (
    <>
      {layout.tracks.map((track, trackIdx) => {
        const color = getTrackColor(trackIdx)
        const isHovered = hoveredTrack === trackIdx
        const pathSegments = track.path
        const pathParts: string[] = []

        for (let i = 0; i < pathSegments.length; i++) {
          const seg = pathSegments[i]!
          const node =
            seg.node !== null ? layout.nodes[seg.node] : undefined

          if (i === 0) {
            if (node) {
              pathParts.push(`M ${node.x} ${seg.y + 3.5}`)
              pathParts.push(`L ${node.x + node.pixelWidth} ${seg.y + 3.5}`)
            } else {
              // edge segment at an intermediate order - find x from nodes at this order
              const x = getXForOrder(layout, seg.order)
              pathParts.push(`M ${x} ${seg.y + 3.5}`)
            }
          } else {
            const prev = pathSegments[i - 1]!
            const prevNode =
              prev.node !== null ? layout.nodes[prev.node] : undefined

            const prevX = prevNode
              ? prevNode.x + prevNode.pixelWidth
              : getXForOrder(layout, prev.order) + 5

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
              const x = getXForOrder(layout, seg.order)
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
            opacity={
              hoveredTrack !== null && !isHovered ? 0.3 : 0.85
            }
          />
        )
      })}
    </>
  )
}

function getXForOrder(layout: TubeMapLayout, order: number) {
  for (const node of layout.nodes) {
    if (node.order === order) {
      return node.x
    }
  }
  return 0
}

const TubeMapCanvas = observer(function TubeMapCanvas({
  model,
}: {
  model: TubeMapViewModel
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

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
    <div style={{ overflow: 'hidden', height: 500, background: '#fff' }}>
      <svg
        ref={svgRef}
        width={model.width}
        height={500}
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
          <TrackPaths layout={layout} hoveredTrack={model.hoveredTrack} />
          {layout.nodes.map((node, i) => (
            <NodeRect
              key={node.name}
              node={node}
              isHovered={model.hoveredNode === i}
              isSelected={model.selectedNode === i}
              onMouseEnter={() => {
                model.setHoveredNode(i)
              }}
              onMouseLeave={() => {
                model.setHoveredNode(null)
              }}
              onClick={() => {
                model.setSelectedNode(
                  model.selectedNode === i ? null : i,
                )
              }}
            />
          ))}
        </g>
      </svg>
    </div>
  )
})

export default TubeMapCanvas
