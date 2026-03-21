import { computeEdgeCurves } from './geometry.ts'
import { SpatialIndex, EdgeSpatialIndex } from './SpatialIndex.ts'

import type { Graph, NodeSegment } from '../types.ts'
import type { BezierCurve } from './geometry.ts'

export function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) {
    return Math.hypot(px - x1, py - y1)
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

export function distanceToCubicBezier(
  px: number,
  py: number,
  x1: number,
  y1: number,
  cx1: number,
  cy1: number,
  cx2: number,
  cy2: number,
  x2: number,
  y2: number,
) {
  let minDist = Infinity
  const samples = 20
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const u = 1 - t
    const bx =
      u * u * u * x1 +
      3 * u * u * t * cx1 +
      3 * u * t * t * cx2 +
      t * t * t * x2
    const by =
      u * u * u * y1 +
      3 * u * u * t * cy1 +
      3 * u * t * t * cy2 +
      t * t * t * y2
    const dist = Math.hypot(px - bx, py - by)
    if (dist < minDist) {
      minDist = dist
    }
  }
  return minDist
}

function distanceToBezierCurve(px: number, py: number, c: BezierCurve) {
  return distanceToCubicBezier(
    px,
    py,
    c.x0,
    c.y0,
    c.cx0,
    c.cy0,
    c.cx1,
    c.cy1,
    c.x1,
    c.y1,
  )
}

function distanceToEdgeCurves(px: number, py: number, curves: BezierCurve[]) {
  let minDist = Infinity
  for (const c of curves) {
    const d = distanceToBezierCurve(px, py, c)
    if (d < minDist) {
      minDist = d
    }
  }
  return minDist
}

let cachedIndex: SpatialIndex | null = null
let cachedPositions: Record<string, NodeSegment[]> | null = null

function getSpatialIndex(nodePositions: Record<string, NodeSegment[]>) {
  if (cachedPositions !== nodePositions) {
    cachedPositions = nodePositions
    cachedIndex = new SpatialIndex(nodePositions)
  }
  return cachedIndex!
}

let cachedEdgeIndex: EdgeSpatialIndex | null = null
let cachedEdgePositions: Record<string, NodeSegment[]> | null = null
let cachedEdgeGraph: Graph | null = null
let cachedEdgeDrawPaths = false

function getEdgeSpatialIndex(
  nodePositions: Record<string, NodeSegment[]>,
  graph: Graph,
  drawPaths: boolean,
) {
  if (
    cachedEdgePositions !== nodePositions ||
    cachedEdgeGraph !== graph ||
    cachedEdgeDrawPaths !== drawPaths
  ) {
    cachedEdgePositions = nodePositions
    cachedEdgeGraph = graph
    cachedEdgeDrawPaths = drawPaths
    cachedEdgeIndex = new EdgeSpatialIndex(nodePositions, graph, drawPaths)
  }
  return cachedEdgeIndex!
}

export function findHoveredNode(
  nodePositions: Record<string, NodeSegment[]>,
  graphX: number,
  graphY: number,
  scale: number,
) {
  const nodeThreshold = 5 / scale
  const index = getSpatialIndex(nodePositions)
  const candidates = index.query(graphX, graphY, nodeThreshold)

  for (const { nodeId, segmentIdx } of candidates) {
    const segments = nodePositions[nodeId]!
    const dist = distanceToSegment(
      graphX,
      graphY,
      segments[segmentIdx]!.x,
      segments[segmentIdx]!.y,
      segments[segmentIdx + 1]!.x,
      segments[segmentIdx + 1]!.y,
    )
    if (dist < nodeThreshold) {
      return nodeId
    }
  }
  return null
}

export function findHoveredEdge(
  nodePositions: Record<string, NodeSegment[]>,
  graph: Graph,
  graphX: number,
  graphY: number,
  scale: number,
  drawPaths: boolean,
) {
  const edgeThreshold = 10 / scale
  const edgeIndex = getEdgeSpatialIndex(nodePositions, graph, drawPaths)
  const candidates = edgeIndex.query(graphX, graphY, edgeThreshold)

  for (const edgeIdx of candidates) {
    const edge = graph.edges[edgeIdx]!
    const fromSegments = nodePositions[edge.from]
    const toSegments = nodePositions[edge.to]
    if (!fromSegments?.length || !toSegments?.length) {
      continue
    }

    const isSelfLoop = edge.from === edge.to
    const numPaths = edge.pathIds?.length ?? 0
    let dist: number

    if (!drawPaths || numPaths === 0) {
      const curves = computeEdgeCurves(
        fromSegments,
        toSegments,
        isSelfLoop,
        0,
        0,
      )
      dist = distanceToEdgeCurves(graphX, graphY, curves)
    } else {
      const fromEnd = fromSegments[fromSegments.length - 1]!
      const toStart = toSegments[0]!
      const edgeDx = toStart.x - fromEnd.x
      const edgeDy = toStart.y - fromEnd.y
      const len = Math.hypot(edgeDx, edgeDy)
      if (len === 0) {
        continue
      }

      const perpX = -edgeDy / len
      const perpY = edgeDx / len
      const offsetDist = 3

      let minDist = Infinity
      for (let pathIdx = 0; pathIdx < numPaths; pathIdx++) {
        const pathOffset = (pathIdx - (numPaths - 1) / 2) * offsetDist
        const curves = computeEdgeCurves(
          fromSegments,
          toSegments,
          isSelfLoop,
          perpX * pathOffset,
          perpY * pathOffset,
        )
        const d = distanceToEdgeCurves(graphX, graphY, curves)
        if (d < minDist) {
          minDist = d
        }
      }
      dist = minDist
    }

    if (dist < edgeThreshold) {
      return edgeIdx
    }
  }
  return null
}
