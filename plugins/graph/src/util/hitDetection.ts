import { projectLine } from './geometry.ts'

import type { Graph, NodeSegment } from '../types.ts'

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
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const closestX = x1 + t * dx
  const closestY = y1 + t * dy
  return Math.hypot(px - closestX, py - closestY)
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
    const oneMinusT = 1 - t
    const bx =
      oneMinusT * oneMinusT * oneMinusT * x1 +
      3 * oneMinusT * oneMinusT * t * cx1 +
      3 * oneMinusT * t * t * cx2 +
      t * t * t * x2
    const by =
      oneMinusT * oneMinusT * oneMinusT * y1 +
      3 * oneMinusT * oneMinusT * t * cy1 +
      3 * oneMinusT * t * t * cy2 +
      t * t * t * y2
    const dist = Math.hypot(px - bx, py - by)
    if (dist < minDist) {
      minDist = dist
    }
  }
  return minDist
}

export function findHoveredNode(
  nodePositions: Record<string, NodeSegment[]>,
  graphX: number,
  graphY: number,
  scale: number,
) {
  const nodeThreshold = 5 / scale
  for (const [nodeId, segments] of Object.entries(nodePositions)) {
    for (let i = 0; i < segments.length - 1; i++) {
      const dist = distanceToSegment(
        graphX,
        graphY,
        segments[i]!.x,
        segments[i]!.y,
        segments[i + 1]!.x,
        segments[i + 1]!.y,
      )
      if (dist < nodeThreshold) {
        return nodeId
      }
    }
  }
  return null
}

function checkEdgeDistance(
  graphX: number,
  graphY: number,
  fromSegments: NodeSegment[],
  toSegments: NodeSegment[],
  fromEnd: NodeSegment,
  toStart: NodeSegment,
  isSelfLoop: boolean,
  scale: number,
  offsetX: number,
  offsetY: number,
) {
  if (isSelfLoop) {
    let segmentDirX = 1,
      segmentDirY = 0
    if (fromSegments.length >= 2) {
      const prevSeg = fromSegments[fromSegments.length - 2]!
      const lastSeg = fromSegments[fromSegments.length - 1]!
      const edgeDx = lastSeg.x - prevSeg.x
      const edgeDy = lastSeg.y - prevSeg.y
      const len = Math.hypot(edgeDx, edgeDy)
      if (len > 0) {
        segmentDirX = edgeDx / len
        segmentDirY = edgeDy / len
      }
    }

    const extensionLength = 50 / Math.pow(scale, 0.7)
    const cp1x = fromEnd.x + offsetX + segmentDirX * extensionLength
    const cp1y = fromEnd.y + offsetY + segmentDirY * extensionLength
    const cp2x = toStart.x + offsetX - segmentDirX * extensionLength
    const cp2y = toStart.y + offsetY - segmentDirY * extensionLength

    const perpX = -segmentDirY
    const perpY = segmentDirX
    const perpShift = extensionLength

    const nodeMidX = (fromEnd.x + toStart.x) / 2 + offsetX
    const nodeMidY = (fromEnd.y + toStart.y) / 2 + offsetY
    const cp1ShiftedX = cp1x + perpX * perpShift
    const cp1ShiftedY = cp1y + perpY * perpShift
    const nodeMidShiftedX = nodeMidX + perpX * perpShift
    const nodeMidShiftedY = nodeMidY + perpY * perpShift
    const cp2ShiftedX = cp2x + perpX * perpShift
    const cp2ShiftedY = cp2y + perpY * perpShift

    const dist1 = distanceToCubicBezier(
      graphX,
      graphY,
      fromEnd.x + offsetX,
      fromEnd.y + offsetY,
      cp1x,
      cp1y,
      cp1ShiftedX,
      cp1ShiftedY,
      nodeMidShiftedX,
      nodeMidShiftedY,
    )
    const dist2 = distanceToCubicBezier(
      graphX,
      graphY,
      nodeMidShiftedX,
      nodeMidShiftedY,
      cp2ShiftedX,
      cp2ShiftedY,
      cp2x,
      cp2y,
      toStart.x + offsetX,
      toStart.y + offsetY,
    )
    return Math.min(dist1, dist2)
  } else {
    let fromPrev = fromSegments[fromSegments.length - 2]
    if (!fromPrev && fromSegments.length > 0) {
      fromPrev = fromSegments[0]
    }
    let toNext = toSegments[1]
    if (!toNext && toSegments.length > 0) {
      toNext = toSegments[0]
    }

    const edgeDist = Math.hypot(
      toStart.x - fromEnd.x,
      toStart.y - fromEnd.y,
    )
    const projectionDistance = Math.min(edgeDist * 0.5, 80 / scale)

    const [cx1, cy1] = projectLine(
      fromPrev!.x,
      fromPrev!.y,
      fromEnd.x,
      fromEnd.y,
      projectionDistance,
    )
    const [cx2, cy2] = projectLine(
      toNext!.x,
      toNext!.y,
      toStart.x,
      toStart.y,
      projectionDistance,
    )

    return distanceToCubicBezier(
      graphX,
      graphY,
      fromEnd.x + offsetX,
      fromEnd.y + offsetY,
      cx1 + offsetX,
      cy1 + offsetY,
      cx2 + offsetX,
      cy2 + offsetY,
      toStart.x + offsetX,
      toStart.y + offsetY,
    )
  }
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

  for (let edgeIdx = 0; edgeIdx < graph.edges.length; edgeIdx++) {
    const edge = graph.edges[edgeIdx]!
    const fromSegments = nodePositions[edge.from]
    const toSegments = nodePositions[edge.to]
    if (!fromSegments || !toSegments) {
      continue
    }

    const fromEnd = fromSegments[fromSegments.length - 1]
    const toStart = toSegments[0]
    if (!fromEnd || !toStart) {
      continue
    }

    const isSelfLoop = edge.from === edge.to
    const numPaths = edge.pathIds?.length ?? 0
    let dist: number

    if (!drawPaths || numPaths === 0) {
      dist = checkEdgeDistance(
        graphX,
        graphY,
        fromSegments,
        toSegments,
        fromEnd,
        toStart,
        isSelfLoop,
        scale,
        0,
        0,
      )
    } else {
      const edgeDx = toStart.x - fromEnd.x
      const edgeDy = toStart.y - fromEnd.y
      const len = Math.hypot(edgeDx, edgeDy)
      if (len === 0) {
        continue
      }

      const perpX = -edgeDy / len
      const perpY = edgeDx / len
      const offsetDist = 3 / scale

      let minDist = Infinity
      for (let pathIdx = 0; pathIdx < numPaths; pathIdx++) {
        const pathOffset = (pathIdx - (numPaths - 1) / 2) * offsetDist
        const ox = perpX * pathOffset
        const oy = perpY * pathOffset
        const d = checkEdgeDistance(
          graphX,
          graphY,
          fromSegments,
          toSegments,
          fromEnd,
          toStart,
          isSelfLoop,
          scale,
          ox,
          oy,
        )
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
