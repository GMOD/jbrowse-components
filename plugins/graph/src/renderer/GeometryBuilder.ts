import { computeEdgeCurves } from '../util/geometry.ts'

import type { Graph, NodeSegment, ColorScheme, GraphNode } from '../types.ts'
import type { BezierCurve } from '../util/geometry.ts'
import type { RenderBatch } from './types.ts'

interface BuildOptions {
  nodePositions: Record<string, NodeSegment[]>
  graph: Graph
  colorScheme: ColorScheme
  contigThickness: number
  connectorThickness: number
  drawPaths: boolean
  hoveredNode: string | null
  hoveredEdge: number | null
  selectedNode: string | null
  scale: number
}

function hslToRgb(
  h: number,
  s: number,
  l: number,
): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0,
    g = 0,
    b = 0
  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  return [r + m, g + m, b + m]
}

interface ColorSchemeRange {
  minDepth: number
  maxDepth: number
  minLength: number
  maxLength: number
}

function computeColorSchemeRange(graph: Graph) {
  let minDepth = Infinity,
    maxDepth = -Infinity
  let minLength = Infinity,
    maxLength = -Infinity
  for (let i = 0; i < graph.nodes.length; i++) {
    const n = graph.nodes[i]!
    if (n.depth < minDepth) {
      minDepth = n.depth
    }
    if (n.depth > maxDepth) {
      maxDepth = n.depth
    }
    if (n.length < minLength) {
      minLength = n.length
    }
    if (n.length > maxLength) {
      maxLength = n.length
    }
  }
  return { minDepth, maxDepth, minLength, maxLength } satisfies ColorSchemeRange
}

function getNodeColor(
  node: GraphNode,
  colorScheme: ColorScheme,
  range: ColorSchemeRange,
): [number, number, number, number] {
  switch (colorScheme) {
    case 'uniform':
      return [52 / 255, 152 / 255, 219 / 255, 1.0]

    case 'random': {
      let hash = 0
      for (let i = 0; i < node.id.length; i++) {
        hash = node.id.charCodeAt(i) + ((hash << 5) - hash)
      }
      const hue = Math.abs(hash % 360)
      const [r, g, b] = hslToRgb(hue, 0.7, 0.5)
      return [r, g, b, 1.0]
    }

    case 'depth': {
      const normalizedDepth =
        range.maxDepth > range.minDepth
          ? (node.depth - range.minDepth) / (range.maxDepth - range.minDepth)
          : 0.5
      const t = Math.max(0, Math.min(1, normalizedDepth))
      let r: number, g: number, b: number
      if (t < 0.25) {
        const s = t / 0.25
        r = (68 + (59 - 68) * s) / 255
        g = (1 + (82 - 1) * s) / 255
        b = (84 + (139 - 84) * s) / 255
      } else if (t < 0.5) {
        const s = (t - 0.25) / 0.25
        r = (59 + (33 - 59) * s) / 255
        g = (82 + (145 - 82) * s) / 255
        b = (139 + (140 - 139) * s) / 255
      } else if (t < 0.75) {
        const s = (t - 0.5) / 0.25
        r = (33 + (94 - 33) * s) / 255
        g = (145 + (201 - 145) * s) / 255
        b = (140 + (98 - 140) * s) / 255
      } else {
        const s = (t - 0.75) / 0.25
        r = (94 + (253 - 94) * s) / 255
        g = (201 + (231 - 201) * s) / 255
        b = (98 + (37 - 98) * s) / 255
      }
      return [r!, g!, b!, 1.0]
    }

    case 'gc-content': {
      const normalized =
        range.maxLength > range.minLength
          ? (node.length - range.minLength) /
            (range.maxLength - range.minLength)
          : 0.5
      const t = Math.max(0, Math.min(1, normalized))
      return [
        (220 + (50 - 220) * t) / 255,
        (50 + (120 - 50) * t) / 255,
        (50 + (220 - 50) * t) / 255,
        1.0,
      ]
    }

    case 'grey':
      return [160 / 255, 160 / 255, 160 / 255, 1.0]

    default:
      return [52 / 255, 152 / 255, 219 / 255, 1.0]
  }
}

function tessellateCubicBezier(
  x0: number,
  y0: number,
  cx0: number,
  cy0: number,
  cx1: number,
  cy1: number,
  x1: number,
  y1: number,
  flatness = 0.5,
) {
  const points: { x: number; y: number }[] = [{ x: x0, y: y0 }]

  function subdivide(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    dx: number,
    dy: number,
    depth: number,
  ) {
    if (depth > 8) {
      points.push({ x: dx, y: dy })
      return
    }

    const mx = (ax + 3 * bx + 3 * cx + dx) / 8
    const my = (ay + 3 * by + 3 * cy + dy) / 8
    const linearMx = (ax + dx) / 2
    const linearMy = (ay + dy) / 2
    const dist = Math.hypot(mx - linearMx, my - linearMy)

    if (dist < flatness) {
      points.push({ x: dx, y: dy })
      return
    }

    const abx = (ax + bx) / 2,
      aby = (ay + by) / 2
    const bcx = (bx + cx) / 2,
      bcy = (by + cy) / 2
    const cdx = (cx + dx) / 2,
      cdy = (cy + dy) / 2
    const abcx = (abx + bcx) / 2,
      abcy = (aby + bcy) / 2
    const bcdx = (bcx + cdx) / 2,
      bcdy = (bcy + cdy) / 2
    const abcdx = (abcx + bcdx) / 2,
      abcdy = (abcy + bcdy) / 2

    subdivide(ax, ay, abx, aby, abcx, abcy, abcdx, abcdy, depth + 1)
    subdivide(abcdx, abcdy, bcdx, bcdy, cdx, cdy, dx, dy, depth + 1)
  }

  subdivide(x0, y0, cx0, cy0, cx1, cy1, x1, y1, 0)
  return points
}

function tessellateBezierCurves(
  curves: BezierCurve[],
  flatness: number,
) {
  let allPoints: { x: number; y: number }[] = []
  for (let i = 0; i < curves.length; i++) {
    const c = curves[i]!
    const pts = tessellateCubicBezier(
      c.x0, c.y0, c.cx0, c.cy0, c.cx1, c.cy1, c.x1, c.y1, flatness,
    )
    if (i > 0) {
      allPoints = allPoints.concat(pts.slice(1))
    } else {
      allPoints = pts
    }
  }
  return allPoints
}

class MeshBuilder {
  positions: number[] = []
  colors: number[] = []
  indices: number[] = []
  vertexCount = 0

  pushColor(color: [number, number, number, number], count = 1) {
    for (let i = 0; i < count; i++) {
      this.colors.push(color[0], color[1], color[2], color[3])
    }
  }

  addRoundCap(
    center: { x: number; y: number },
    angle: number,
    startAngleOffset: number,
    thickness: number,
    color: [number, number, number, number],
  ) {
    const capSegments = 4
    const centerIdx = this.vertexCount
    this.positions.push(center.x, center.y)
    this.pushColor(color)
    this.vertexCount++

    for (let i = 0; i <= capSegments; i++) {
      const a = angle + startAngleOffset + (Math.PI * i) / capSegments
      this.positions.push(
        center.x + Math.cos(a) * thickness,
        center.y + Math.sin(a) * thickness,
      )
      this.pushColor(color)
      if (i > 0) {
        this.indices.push(centerIdx, this.vertexCount - 1, this.vertexCount)
      }
      this.vertexCount++
    }
  }

  addPolyline(
    points: { x: number; y: number }[],
    thickness: number,
    color: [number, number, number, number],
  ) {
    if (points.length < 2) {
      return
    }

    const normals: { nx: number; ny: number }[] = []
    for (let i = 0; i < points.length; i++) {
      let nx = 0,
        ny = 0

      if (i === 0) {
        const dx = points[1]!.x - points[0]!.x
        const dy = points[1]!.y - points[0]!.y
        const len = Math.hypot(dx, dy)
        if (len > 0) {
          nx = -dy / len
          ny = dx / len
        }
      } else if (i === points.length - 1) {
        const dx = points[i]!.x - points[i - 1]!.x
        const dy = points[i]!.y - points[i - 1]!.y
        const len = Math.hypot(dx, dy)
        if (len > 0) {
          nx = -dy / len
          ny = dx / len
        }
      } else {
        const dx1 = points[i]!.x - points[i - 1]!.x
        const dy1 = points[i]!.y - points[i - 1]!.y
        const len1 = Math.hypot(dx1, dy1)
        const dx2 = points[i + 1]!.x - points[i]!.x
        const dy2 = points[i + 1]!.y - points[i]!.y
        const len2 = Math.hypot(dx2, dy2)

        if (len1 > 0 && len2 > 0) {
          const nx1 = -dy1 / len1,
            ny1 = dx1 / len1
          const nx2 = -dy2 / len2,
            ny2 = dx2 / len2
          nx = (nx1 + nx2) / 2
          ny = (ny1 + ny2) / 2
          const dot = nx1 * nx + ny1 * ny
          if (dot > 0.1) {
            nx /= dot
            ny /= dot
          }
        } else if (len1 > 0) {
          nx = -dy1 / len1
          ny = dx1 / len1
        } else if (len2 > 0) {
          nx = -dy2 / len2
          ny = dx2 / len2
        }
      }
      normals.push({ nx, ny })
    }

    const startDx = points[1]!.x - points[0]!.x
    const startDy = points[1]!.y - points[0]!.y
    if (Math.hypot(startDx, startDy) > 0) {
      this.addRoundCap(points[0]!, Math.atan2(startDy, startDx), Math.PI / 2, thickness, color)
    }

    const stripStart = this.vertexCount
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!
      const n = normals[i]!
      this.positions.push(p.x + n.nx * thickness, p.y + n.ny * thickness)
      this.positions.push(p.x - n.nx * thickness, p.y - n.ny * thickness)
      this.pushColor(color, 2)
      this.vertexCount += 2
    }

    for (let i = 0; i < points.length - 1; i++) {
      const vi = stripStart + i * 2
      this.indices.push(vi, vi + 1, vi + 2)
      this.indices.push(vi + 1, vi + 3, vi + 2)
    }

    const lastIdx = points.length - 1
    const endDx = points[lastIdx]!.x - points[lastIdx - 1]!.x
    const endDy = points[lastIdx]!.y - points[lastIdx - 1]!.y
    if (Math.hypot(endDx, endDy) > 0) {
      this.addRoundCap(points[lastIdx]!, Math.atan2(endDy, endDx), -Math.PI / 2, thickness, color)
    }
  }

  addArrowhead(
    x: number,
    y: number,
    angle: number,
    size: number,
    color: [number, number, number, number],
  ) {
    this.positions.push(
      x,
      y,
      x - Math.cos(angle - 0.5) * size,
      y - Math.sin(angle - 0.5) * size,
      x - Math.cos(angle + 0.5) * size,
      y - Math.sin(angle + 0.5) * size,
    )
    this.pushColor(color, 3)
    this.indices.push(this.vertexCount, this.vertexCount + 1, this.vertexCount + 2)
    this.vertexCount += 3
  }

  toBatch(): RenderBatch {
    return {
      positions: new Float32Array(this.positions),
      colors: new Float32Array(this.colors),
      indices: new Uint32Array(this.indices),
    }
  }
}

export function buildGeometry(options: BuildOptions): RenderBatch {
  const {
    nodePositions,
    graph,
    colorScheme,
    contigThickness,
    connectorThickness,
    drawPaths,
    hoveredNode,
    hoveredEdge,
    selectedNode,
    scale,
  } = options

  const mesh = new MeshBuilder()

  const colorRange = computeColorSchemeRange(graph)
  const nodeById = new Map<string, GraphNode>()
  for (let i = 0; i < graph.nodes.length; i++) {
    const n = graph.nodes[i]!
    nodeById.set(n.id, n)
  }

  const pathColors = new Map<string, [number, number, number, number]>()
  if (graph.paths) {
    const hueStep = 360 / graph.paths.length
    for (let idx = 0; idx < graph.paths.length; idx++) {
      const path = graph.paths[idx]!
      const [r, g, b] = hslToRgb(idx * hueStep, 0.7, 0.5)
      pathColors.set(path.name, [r, g, b, 0.85])
    }
  }

  // Edges first (drawn behind nodes)
  for (let ei = 0; ei < graph.edges.length; ei++) {
    const edge = graph.edges[ei]!
    const fromSegments = nodePositions[edge.from]
    const toSegments = nodePositions[edge.to]
    if (!fromSegments?.length || !toSegments?.length) {
      continue
    }

    const fromEnd = fromSegments[fromSegments.length - 1]!
    const toStart = toSegments[0]!
    const isHovered = hoveredEdge === ei
    const numPaths = edge.pathIds?.length ?? 0
    const isSelfLoop = edge.from === edge.to
    const lineWidth = isHovered ? connectorThickness + 1 : connectorThickness

    const buildSingleEdge = (
      offsetX: number,
      offsetY: number,
      color: [number, number, number, number],
    ) => {
      const thickness = lineWidth / 2 / scale
      const curves = computeEdgeCurves(fromSegments, toSegments, isSelfLoop, scale, offsetX, offsetY)
      const allPoints = tessellateBezierCurves(curves, 0.5 / scale)

      mesh.addPolyline(allPoints, thickness, color)

      const lastPt = allPoints[allPoints.length - 1]!
      const prevPt = allPoints[allPoints.length - 2]!
      mesh.addArrowhead(
        lastPt.x, lastPt.y,
        Math.atan2(lastPt.y - prevPt.y, lastPt.x - prevPt.x),
        12 / scale, color,
      )
    }

    if (!drawPaths || numPaths === 0) {
      const edgeColor: [number, number, number, number] = isHovered
        ? [0.667, 0.667, 0.667, 0.85]
        : [0.467, 0.467, 0.467, 0.85]
      buildSingleEdge(0, 0, edgeColor)
    } else {
      const dx = toStart.x - fromEnd.x
      const dy = toStart.y - fromEnd.y
      const len = Math.hypot(dx, dy)
      if (len > 0) {
        const perpX = -dy / len
        const perpY = dx / len
        const offsetDist = 3 / scale

        for (let pathIdx = 0; pathIdx < numPaths; pathIdx++) {
          const offset = (pathIdx - (numPaths - 1) / 2) * offsetDist
          const pathId = edge.pathIds![pathIdx]!
          const color = pathColors.get(pathId) ?? [0.533, 0.533, 0.533, 0.85]
          buildSingleEdge(perpX * offset, perpY * offset, color)
        }
      }
    }
  }

  // Nodes on top of edges
  for (const [nodeId, segments] of Object.entries(nodePositions)) {
    const node = nodeById.get(nodeId)
    if (!node) {
      continue
    }

    const color = getNodeColor(node, colorScheme, colorRange)
    const isHovered = hoveredNode === nodeId
    const isSelected = selectedNode === nodeId
    const screenPx = isSelected
      ? contigThickness + 2
      : isHovered
        ? contigThickness + 1
        : contigThickness
    mesh.addPolyline(segments, screenPx / 2 / scale, color)
  }

  return mesh.toBatch()
}
