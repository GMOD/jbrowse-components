import { computeEdgeCurves } from './geometry.ts'

import type { Graph, NodeSegment } from '../types.ts'

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

export class SpatialIndex {
  private cellSize: number
  private cells = new Map<number, Map<number, CellEntry[]>>()

  constructor(nodePositions: Record<string, NodeSegment[]>, cellSize = 50) {
    this.cellSize = cellSize
    for (const [nodeId, segments] of Object.entries(nodePositions)) {
      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i]!
        const next = segments[i + 1]!

        const minX = Math.min(seg.x, next.x)
        const maxX = Math.max(seg.x, next.x)
        const minY = Math.min(seg.y, next.y)
        const maxY = Math.max(seg.y, next.y)

        const x0 = Math.floor(minX / cellSize)
        const x1 = Math.floor(maxX / cellSize)
        const y0 = Math.floor(minY / cellSize)
        const y1 = Math.floor(maxY / cellSize)

        const entry: CellEntry = { nodeId, segmentIdx: i }
        for (let cx = x0; cx <= x1; cx++) {
          for (let cy = y0; cy <= y1; cy++) {
            getOrCreateCell(this.cells, cx, cy).push(entry)
          }
        }
      }
    }
  }

  query(x: number, y: number, radius: number) {
    const cx0 = Math.floor((x - radius) / this.cellSize)
    const cx1 = Math.floor((x + radius) / this.cellSize)
    const cy0 = Math.floor((y - radius) / this.cellSize)
    const cy1 = Math.floor((y + radius) / this.cellSize)

    const results: CellEntry[] = []
    const seen = new Set<CellEntry>()

    for (let cx = cx0; cx <= cx1; cx++) {
      const row = this.cells.get(cx)
      if (!row) {
        continue
      }
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
    return results
  }
}

export class EdgeSpatialIndex {
  private cellSize: number
  private cells = new Map<number, Map<number, number[]>>()

  constructor(
    nodePositions: Record<string, NodeSegment[]>,
    graph: Graph,
    drawPaths: boolean,
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
      )

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const c of curves) {
        for (const x of [c.x0, c.cx0, c.cx1, c.x1]) {
          if (x < minX) {
            minX = x
          }
          if (x > maxX) {
            maxX = x
          }
        }
        for (const y of [c.y0, c.cy0, c.cy1, c.y1]) {
          if (y < minY) {
            minY = y
          }
          if (y > maxY) {
            maxY = y
          }
        }
      }

      const numPaths = edge.pathIds?.length ?? 0
      if (drawPaths && numPaths > 0) {
        const padding = ((numPaths - 1) / 2) * 3
        minX -= padding
        minY -= padding
        maxX += padding
        maxY += padding
      }

      const cx0 = Math.floor(minX / cellSize)
      const cx1 = Math.floor(maxX / cellSize)
      const cy0 = Math.floor(minY / cellSize)
      const cy1 = Math.floor(maxY / cellSize)
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cy = cy0; cy <= cy1; cy++) {
          getOrCreateCell(this.cells, cx, cy).push(ei)
        }
      }
    }
  }

  query(x: number, y: number, radius: number) {
    const cx0 = Math.floor((x - radius) / this.cellSize)
    const cx1 = Math.floor((x + radius) / this.cellSize)
    const cy0 = Math.floor((y - radius) / this.cellSize)
    const cy1 = Math.floor((y + radius) / this.cellSize)

    const results: number[] = []
    const seen = new Set<number>()

    for (let cx = cx0; cx <= cx1; cx++) {
      const row = this.cells.get(cx)
      if (!row) {
        continue
      }
      for (let cy = cy0; cy <= cy1; cy++) {
        const cell = row.get(cy)
        if (cell) {
          for (const ei of cell) {
            if (!seen.has(ei)) {
              seen.add(ei)
              results.push(ei)
            }
          }
        }
      }
    }
    return results
  }
}
