import {
  abgrAlpha,
  abgrBlue,
  abgrGreen,
  abgrRed,
  packAbgr,
} from '@jbrowse/core/util/colorBits'

import { computeEdgeCurves } from '../util/geometry.ts'
import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_F32,
} from './shaders/graph.generated.ts'

import type { ColorScheme, Graph, GraphNode, NodeSegment } from '../types.ts'
import type { RenderBatch, SubBatch, VertexRange } from './types.ts'
import type { BezierCurve } from '../util/geometry.ts'

// Colors flow through the geometry builder as ABGR-in-u32 (see colorBits.ts).
// That matches the shader's uint color attribute so no repacking happens at
// upload time; CPU-side brighten / recolour utilities operate on the same
// u32 values.
const EDGE_DEFAULT_COLOR = packAbgr(119, 119, 119, 217) // rgb(119,119,119) ~ 0.467, alpha 0.85
const EDGE_PATH_FALLBACK_COLOR = packAbgr(136, 136, 136, 217) // ~0.533, alpha 0.85

function packNorm(r: number, g: number, b: number, a: number) {
  return packAbgr(
    Math.round(r * 255),
    Math.round(g * 255),
    Math.round(b * 255),
    Math.round(a * 255),
  )
}

export interface BuildOptions {
  nodePositions: Record<string, NodeSegment[]>
  graph: Graph
  nodeById: Map<string, GraphNode>
  colorScheme: ColorScheme
  contigThickness: number
  connectorThickness: number
  drawPaths: boolean
  scale: number
  linearLayout?: boolean
  viewportBounds?: { minX: number; minY: number; maxX: number; maxY: number }
}

export function hslToRgb(
  h: number,
  s: number,
  l: number,
): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
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

export interface ColorSchemeRange {
  minDepth: number
  maxDepth: number
  minLength: number
  maxLength: number
  nodeCount: number
}

export function computeColorSchemeRange(graph: Graph) {
  let minDepth = Infinity
  let maxDepth = -Infinity
  let minLength = Infinity
  let maxLength = -Infinity
  for (const n of graph.nodes) {
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
  return {
    minDepth,
    maxDepth,
    minLength,
    maxLength,
    nodeCount: graph.nodes.length,
  } satisfies ColorSchemeRange
}

export function getNodeColor(
  node: GraphNode,
  nodeIndex: number,
  colorScheme: ColorScheme,
  range: ColorSchemeRange,
) {
  switch (colorScheme) {
    case 'uniform':
      return packAbgr(52, 152, 219, 255)

    case 'random': {
      let hash = 0
      for (let i = 0; i < node.id.length; i++) {
        hash = node.id.charCodeAt(i) + ((hash << 5) - hash)
      }
      const hue = Math.abs(hash % 360)
      const [r, g, b] = hslToRgb(hue, 0.7, 0.5)
      return packNorm(r, g, b, 1)
    }

    case 'depth': {
      const normalizedDepth =
        range.maxDepth > range.minDepth
          ? (node.depth - range.minDepth) / (range.maxDepth - range.minDepth)
          : 0.5
      const t = Math.max(0, Math.min(1, normalizedDepth))
      let r: number
      let g: number
      let b: number
      if (t < 0.25) {
        const s = t / 0.25
        r = 68 + (59 - 68) * s
        g = 1 + (82 - 1) * s
        b = 84 + (139 - 84) * s
      } else if (t < 0.5) {
        const s = (t - 0.25) / 0.25
        r = 59 + (33 - 59) * s
        g = 82 + (145 - 82) * s
        b = 139 + (140 - 139) * s
      } else if (t < 0.75) {
        const s = (t - 0.5) / 0.25
        r = 33 + (94 - 33) * s
        g = 145 + (201 - 145) * s
        b = 140 + (98 - 140) * s
      } else {
        const s = (t - 0.75) / 0.25
        r = 94 + (253 - 94) * s
        g = 201 + (231 - 201) * s
        b = 98 + (37 - 98) * s
      }
      return packAbgr(Math.round(r), Math.round(g), Math.round(b), 255)
    }

    case 'node-length': {
      const normalized =
        range.maxLength > range.minLength
          ? (node.length - range.minLength) /
            (range.maxLength - range.minLength)
          : 0.5
      const t = Math.max(0, Math.min(1, normalized))
      return packAbgr(
        Math.round(220 + (50 - 220) * t),
        Math.round(50 + (120 - 50) * t),
        Math.round(50 + (220 - 50) * t),
        255,
      )
    }

    case 'grey':
      return packAbgr(160, 160, 160, 255)

    case 'rainbow': {
      const hue = range.nodeCount > 1 ? (nodeIndex / range.nodeCount) * 360 : 0
      const [r, g, b] = hslToRgb(hue, 0.75, 0.5)
      return packNorm(r, g, b, 1)
    }

    default:
      return packAbgr(52, 152, 219, 255)
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

    const abx = (ax + bx) / 2
    const aby = (ay + by) / 2
    const bcx = (bx + cx) / 2
    const bcy = (by + cy) / 2
    const cdx = (cx + dx) / 2
    const cdy = (cy + dy) / 2
    const abcx = (abx + bcx) / 2
    const abcy = (aby + bcy) / 2
    const bcdx = (bcx + cdx) / 2
    const bcdy = (bcy + cdy) / 2
    const abcdx = (abcx + bcdx) / 2
    const abcdy = (abcy + bcdy) / 2

    subdivide(ax, ay, abx, aby, abcx, abcy, abcdx, abcdy, depth + 1)
    subdivide(abcdx, abcdy, bcdx, bcdy, cdx, cdy, dx, dy, depth + 1)
  }

  subdivide(x0, y0, cx0, cy0, cx1, cy1, x1, y1, 0)
  return points
}

function tessellateBezierCurves(curves: BezierCurve[], flatness: number) {
  const allPoints: { x: number; y: number }[] = []
  for (let i = 0; i < curves.length; i++) {
    const c = curves[i]!
    const pts = tessellateCubicBezier(
      c.x0,
      c.y0,
      c.cx0,
      c.cy0,
      c.cx1,
      c.cy1,
      c.x1,
      c.y1,
      flatness,
    )
    const start = i === 0 ? 0 : 1
    for (let j = start; j < pts.length; j++) {
      allPoints.push(pts[j]!)
    }
  }
  return allPoints
}

function isSegmentInBounds(
  segments: NodeSegment[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
) {
  for (const seg of segments) {
    if (
      seg.x >= bounds.minX &&
      seg.x <= bounds.maxX &&
      seg.y >= bounds.minY &&
      seg.y <= bounds.maxY
    ) {
      return true
    }
  }
  return false
}

function isBezierInBounds(
  curves: BezierCurve[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
) {
  for (const c of curves) {
    const cMinX = Math.min(c.x0, c.cx0, c.cx1, c.x1)
    const cMaxX = Math.max(c.x0, c.cx0, c.cx1, c.x1)
    const cMinY = Math.min(c.y0, c.cy0, c.cy1, c.y1)
    const cMaxY = Math.max(c.y0, c.cy0, c.cy1, c.y1)
    if (
      cMaxX >= bounds.minX &&
      cMinX <= bounds.maxX &&
      cMaxY >= bounds.minY &&
      cMinY <= bounds.maxY
    ) {
      return true
    }
  }
  return false
}

class MeshBuilder {
  // Grown in-place, freshly allocated when capacity runs out. The final
  // `toSubBatch` slice is already in the shader's interleaved layout, so
  // geometry build is one pass with no stride conversion at the end.
  private capacity = 0
  private vertexF32 = new Float32Array(0)
  private vertexU32 = new Uint32Array(0)
  private colorsU32 = new Uint32Array(0)
  indices: number[] = []
  vertexCount = 0

  private grow(needed: number) {
    if (needed <= this.capacity) {
      return
    }
    const next = Math.max(this.capacity === 0 ? 64 : this.capacity * 2, needed)
    const buffer = new ArrayBuffer(next * INSTANCE_STRIDE_BYTES)
    const f32 = new Float32Array(buffer)
    f32.set(this.vertexF32)
    this.vertexF32 = f32
    this.vertexU32 = new Uint32Array(buffer)
    const colors = new Uint32Array(next)
    colors.set(this.colorsU32)
    this.colorsU32 = colors
    this.capacity = next
  }

  pushVertex(
    x: number,
    y: number,
    nx: number,
    ny: number,
    thickness: number,
    color: number,
    edgeDist: number,
  ) {
    this.grow(this.vertexCount + 1)
    const base = this.vertexCount * INSTANCE_STRIDE_F32
    const {
      position,
      normal,
      thickness: thickOff,
      color: colOff,
      edge_dist,
    } = FIELD_OFFSET_F32

    this.vertexF32[base + position] = x
    this.vertexF32[base + position + 1] = y
    this.vertexF32[base + normal] = nx
    this.vertexF32[base + normal + 1] = ny
    this.vertexF32[base + thickOff] = thickness
    this.vertexU32[base + colOff] = color
    this.vertexF32[base + edge_dist] = edgeDist
    this.colorsU32[this.vertexCount] = color
    this.vertexCount++
  }

  addRoundCap(
    center: { x: number; y: number },
    angle: number,
    startAngleOffset: number,
    thickness: number,
    color: number,
  ) {
    const capSegments = 4
    const centerIdx = this.vertexCount
    const { x, y } = center

    this.pushVertex(x, y, 0, 0, 0, color, 0)

    for (let i = 0; i <= capSegments; i++) {
      const a = angle + startAngleOffset + (Math.PI * i) / capSegments
      this.pushVertex(x, y, Math.cos(a), Math.sin(a), thickness, color, 1)
      if (i > 0) {
        this.indices.push(centerIdx, this.vertexCount - 2, this.vertexCount - 1)
      }
    }
  }

  addPolyline(
    points: { x: number; y: number }[],
    thickness: number,
    color: number,
  ) {
    if (points.length < 2) {
      return
    }

    const pointNormals: { nx: number; ny: number }[] = []
    for (let i = 0; i < points.length; i++) {
      let nx = 0
      let ny = 0

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
          const nx1 = -dy1 / len1
          const ny1 = dx1 / len1
          const nx2 = -dy2 / len2
          const ny2 = dx2 / len2
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
      pointNormals.push({ nx, ny })
    }

    const startDx = points[1]!.x - points[0]!.x
    const startDy = points[1]!.y - points[0]!.y
    if (Math.hypot(startDx, startDy) > 0) {
      this.addRoundCap(
        points[0]!,
        Math.atan2(startDy, startDx),
        Math.PI / 2,
        thickness,
        color,
      )
    }

    const stripStart = this.vertexCount
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!
      const n = pointNormals[i]!
      this.pushVertex(p.x, p.y, n.nx, n.ny, thickness, color, 1)
      this.pushVertex(p.x, p.y, -n.nx, -n.ny, thickness, color, -1)
    }

    for (let i = 0; i < points.length - 1; i++) {
      const vi = stripStart + i * 2
      this.indices.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2)
    }

    const lastIdx = points.length - 1
    const endDx = points[lastIdx]!.x - points[lastIdx - 1]!.x
    const endDy = points[lastIdx]!.y - points[lastIdx - 1]!.y
    if (Math.hypot(endDx, endDy) > 0) {
      this.addRoundCap(
        points[lastIdx]!,
        Math.atan2(endDy, endDx),
        -Math.PI / 2,
        thickness,
        color,
      )
    }
  }

  addArrowhead(
    x: number,
    y: number,
    angle: number,
    size: number,
    color: number,
  ) {
    this.pushVertex(x, y, 0, 0, 0, color, 0)
    this.pushVertex(
      x,
      y,
      -Math.cos(angle - 0.5),
      -Math.sin(angle - 0.5),
      size,
      color,
      1,
    )
    this.pushVertex(
      x,
      y,
      -Math.cos(angle + 0.5),
      -Math.sin(angle + 0.5),
      size,
      color,
      1,
    )

    this.indices.push(
      this.vertexCount - 3,
      this.vertexCount - 2,
      this.vertexCount - 1,
    )
  }

  toSubBatch(): SubBatch {
    // slice (not subarray) detaches the over-allocated capacity buffer so it
    // can be GC'd once the build finishes. The per-element cost is trivial
    // compared to the build itself.
    const vertexData = this.vertexF32.slice(
      0,
      this.vertexCount * INSTANCE_STRIDE_F32,
    )
    return {
      vertexData,
      vertexDataU32: new Uint32Array(vertexData.buffer),
      colors: this.colorsU32.slice(0, this.vertexCount),
      indices: new Uint32Array(this.indices),
      vertexCount: this.vertexCount,
    }
  }
}

export function buildGeometry(options: BuildOptions): RenderBatch {
  const {
    nodePositions,
    graph,
    nodeById,
    colorScheme,
    contigThickness,
    connectorThickness,
    drawPaths,
    scale,
    linearLayout,
    viewportBounds,
  } = options

  const edgeMesh = new MeshBuilder()
  const nodeMesh = new MeshBuilder()
  const arrowMesh = new MeshBuilder()

  const nodeVertexRanges = new Map<string, VertexRange>()
  const edgeVertexRanges = new Map<number, VertexRange>()
  const arrowVertexRanges = new Map<number, VertexRange>()

  const colorRange = computeColorSchemeRange(graph)

  const nodeIndexMap = new Map<string, number>()
  if (colorScheme === 'rainbow') {
    for (let i = 0; i < graph.nodes.length; i++) {
      nodeIndexMap.set(graph.nodes[i]!.id, i)
    }
  }

  const pathColors = new Map<string, number>()
  if (graph.paths) {
    for (const path of graph.paths) {
      let hash = 0
      for (let i = 0; i < path.name.length; i++) {
        hash = path.name.charCodeAt(i) + ((hash << 5) - hash)
      }
      const hue = Math.abs(hash % 360)
      const [r, g, b] = hslToRgb(hue, 0.7, 0.5)
      pathColors.set(path.name, packNorm(r, g, b, 0.85))
    }
  }

  for (let ei = 0; ei < graph.edges.length; ei++) {
    const edge = graph.edges[ei]!
    const fromSegments = nodePositions[edge.from]
    const toSegments = nodePositions[edge.to]
    if (!fromSegments?.length || !toSegments?.length) {
      continue
    }

    const fromEnd = fromSegments[fromSegments.length - 1]!
    const toStart = toSegments[0]!
    const numPaths = edge.pathIds?.length ?? 0
    const isSelfLoop = edge.from === edge.to
    const edgeThickness = connectorThickness / 2

    const buildSingleEdge = (
      offsetX: number,
      offsetY: number,
      color: number,
    ) => {
      const curves = computeEdgeCurves(
        fromSegments,
        toSegments,
        isSelfLoop,
        offsetX,
        offsetY,
        scale,
      )

      if (viewportBounds && !isBezierInBounds(curves, viewportBounds)) {
        return
      }

      const allPoints = tessellateBezierCurves(curves, 0.5)
      edgeMesh.addPolyline(allPoints, edgeThickness, color)

      const arrowThreshold = linearLayout ? 1 : 0.1
      if (scale > arrowThreshold) {
        const lastPt = allPoints[allPoints.length - 1]!
        const prevPt = allPoints[allPoints.length - 2]!
        arrowMesh.addArrowhead(
          lastPt.x,
          lastPt.y,
          Math.atan2(lastPt.y - prevPt.y, lastPt.x - prevPt.x),
          12,
          color,
        )
      }
    }

    const edgeStart = edgeMesh.vertexCount
    const arrowStart = arrowMesh.vertexCount

    if (!drawPaths || numPaths === 0) {
      buildSingleEdge(0, 0, EDGE_DEFAULT_COLOR)
    } else {
      const dx = toStart.x - fromEnd.x
      const dy = toStart.y - fromEnd.y
      const len = Math.hypot(dx, dy)
      if (len > 0) {
        const perpX = -dy / len
        const perpY = dx / len
        const offsetDist = 3

        for (let pathIdx = 0; pathIdx < numPaths; pathIdx++) {
          const offset = (pathIdx - (numPaths - 1) / 2) * offsetDist
          const pathId = edge.pathIds![pathIdx]!
          const color = pathColors.get(pathId) ?? EDGE_PATH_FALLBACK_COLOR
          buildSingleEdge(perpX * offset, perpY * offset, color)
        }
      }
    }

    const edgeCount = edgeMesh.vertexCount - edgeStart
    if (edgeCount > 0) {
      edgeVertexRanges.set(ei, { start: edgeStart, count: edgeCount })
    }
    const arrowCount = arrowMesh.vertexCount - arrowStart
    if (arrowCount > 0) {
      arrowVertexRanges.set(ei, { start: arrowStart, count: arrowCount })
    }
  }

  for (const [nodeId, segments] of Object.entries(nodePositions)) {
    const node = nodeById.get(nodeId)
    if (!node) {
      continue
    }

    if (viewportBounds && !isSegmentInBounds(segments, viewportBounds)) {
      continue
    }

    const color = getNodeColor(
      node,
      nodeIndexMap.get(nodeId) ?? 0,
      colorScheme,
      colorRange,
    )
    const nodeThickness = contigThickness / 2

    const startVert = nodeMesh.vertexCount
    nodeMesh.addPolyline(segments, nodeThickness, color)
    const count = nodeMesh.vertexCount - startVert
    if (count > 0) {
      nodeVertexRanges.set(nodeId, { start: startVert, count })
    }
  }

  return {
    edges: edgeMesh.toSubBatch(),
    nodes: nodeMesh.toSubBatch(),
    arrows: arrowMesh.toSubBatch(),
    nodeVertexRanges,
    edgeVertexRanges,
    arrowVertexRanges,
  }
}

export function brightenColors(
  baseColors: Uint32Array,
  range: VertexRange,
  factor: number,
) {
  const slice = new Uint32Array(range.count)
  for (let v = 0; v < range.count; v++) {
    const c = baseColors[range.start + v]!
    const r = Math.min(255, Math.round(abgrRed(c) * factor))
    const g = Math.min(255, Math.round(abgrGreen(c) * factor))
    const b = Math.min(255, Math.round(abgrBlue(c) * factor))
    slice[v] = packAbgr(r, g, b, abgrAlpha(c))
  }
  return slice
}

export function extractColorSlice(baseColors: Uint32Array, range: VertexRange) {
  return baseColors.subarray(range.start, range.start + range.count)
}
