import { computeEdgeCurves } from './geometry.ts'

import type { Graph, NodeSegment } from '../types.ts'
import type { BezierCurve } from './geometry.ts'

interface CellEntry {
  nodeId: string
  segmentIdx: number
}

function getOrCreateCell<T>(
  cells: Map<number, Map<number, T[]>>,
  cx: number,
  cy: number,
) {
  let row = cells.get(cx)
  if (!row) {
    row = new Map()
    cells.set(cx, row)
  }
  let cell = row.get(cy)
  if (!cell) {
    cell = []
    row.set(cy, cell)
  }
  return cell
}

function addToGrid<T>(
  cells: Map<number, Map<number, T[]>>,
  cellSize: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  entry: T,
) {
  const cx0 = Math.floor(minX / cellSize)
  const cx1 = Math.floor(maxX / cellSize)
  const cy0 = Math.floor(minY / cellSize)
  const cy1 = Math.floor(maxY / cellSize)
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cy = cy0; cy <= cy1; cy++) {
      getOrCreateCell(cells, cx, cy).push(entry)
    }
  }
}

function queryGrid<T>(
  cells: Map<number, Map<number, T[]>>,
  cellSize: number,
  x: number,
  y: number,
  radius: number,
): T[] {
  const cx0 = Math.floor((x - radius) / cellSize)
  const cx1 = Math.floor((x + radius) / cellSize)
  const cy0 = Math.floor((y - radius) / cellSize)
  const cy1 = Math.floor((y + radius) / cellSize)
  const results: T[] = []
  const seen = new Set<T>()
  for (let cx = cx0; cx <= cx1; cx++) {
    const row = cells.get(cx)
    if (row) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const cell = row.get(cy)
        if (cell) {
          for (const entry of cell) {
            if (!seen.has(entry)) {
              seen.add(entry)
              results.push(entry)
            }
          }
        }
      }
    }
  }
  return results
}

export class SpatialIndex {
  private cellSize: number
  private cells = new Map<number, Map<number, CellEntry[]>>()

  constructor(nodePositions: Record<string, NodeSegment[]>, cellSize = 50) {
    this.cellSize = cellSize
    for (const [nodeId, segments] of Object.entries(nodePositions)) {
      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i]!
        const next = segments[i + 1]!

        addToGrid(
          this.cells,
          cellSize,
          Math.min(seg.x, next.x),
          Math.min(seg.y, next.y),
          Math.max(seg.x, next.x),
          Math.max(seg.y, next.y),
          { nodeId, segmentIdx: i },
        )
      }
    }
  }

  query(x: number, y: number, radius: number) {
    return queryGrid(this.cells, this.cellSize, x, y, radius)
  }
}

export class EdgeSpatialIndex {
  private cellSize: number
  private cells = new Map<number, Map<number, number[]>>()
  // Base curves (offset 0) by edge index — retained here because we already
  // compute them to derive each edge's bbox. findHoveredEdge reuses them on
  // every mousemove; path-offset variants translate them (pure translation).
  private edgeCurves = new Map<number, BezierCurve[]>()

  constructor(
    nodePositions: Record<string, NodeSegment[]>,
    graph: Graph,
    drawPaths: boolean,
    scale = 1,
    cellSize = 100,
  ) {
    this.cellSize = cellSize
    for (let ei = 0; ei < graph.edges.length; ei++) {
      const edge = graph.edges[ei]!
      const fromSegments = nodePositions[edge.from]
      const toSegments = nodePositions[edge.to]
      if (!fromSegments?.length || !toSegments?.length) {
        continue
      }

      const isSelfLoop = edge.from === edge.to
      const curves = computeEdgeCurves(
        fromSegments,
        toSegments,
        isSelfLoop,
        0,
        0,
        scale,
      )
      this.edgeCurves.set(ei, curves)

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const c of curves) {
        minX = Math.min(minX, c.x0, c.cx0, c.cx1, c.x1)
        maxX = Math.max(maxX, c.x0, c.cx0, c.cx1, c.x1)
        minY = Math.min(minY, c.y0, c.cy0, c.cy1, c.y1)
        maxY = Math.max(maxY, c.y0, c.cy0, c.cy1, c.y1)
      }

      const numPaths = edge.pathIds?.length ?? 0
      if (drawPaths && numPaths > 0) {
        const padding = ((numPaths - 1) / 2) * 3
        minX -= padding
        minY -= padding
        maxX += padding
        maxY += padding
      }

      addToGrid(this.cells, cellSize, minX, minY, maxX, maxY, ei)
    }
  }

  getCurves(ei: number) {
    return this.edgeCurves.get(ei)
  }

  query(x: number, y: number, radius: number) {
    return queryGrid(this.cells, this.cellSize, x, y, radius)
  }
}
