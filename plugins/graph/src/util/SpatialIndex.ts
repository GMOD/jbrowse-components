import { computeEdgeCurves } from './geometry.ts'

import type { NodeSegment, Graph } from '../types.ts'

interface CellEntry {
  nodeId: string
  segmentIdx: number
}

export class SpatialIndex {
  private cellSize: number
  private cells = new Map<string, CellEntry[]>()

  constructor(
    nodePositions: Record<string, NodeSegment[]>,
    cellSize = 50,
  ) {
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

        for (let cx = x0; cx <= x1; cx++) {
          for (let cy = y0; cy <= y1; cy++) {
            const key = `${cx},${cy}`
            let cell = this.cells.get(key)
            if (!cell) {
              cell = []
              this.cells.set(key, cell)
            }
            cell.push({ nodeId, segmentIdx: i })
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
    const seen = new Set<string>()

    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const cell = this.cells.get(`${cx},${cy}`)
        if (cell) {
          for (const entry of cell) {
            const key = `${entry.nodeId}:${entry.segmentIdx}`
            if (!seen.has(key)) {
              seen.add(key)
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
  private cells = new Map<string, number[]>()

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
      const curves = computeEdgeCurves(fromSegments, toSegments, isSelfLoop, 0, 0)

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
          const key = `${cx},${cy}`
          let cell = this.cells.get(key)
          if (!cell) {
            cell = []
            this.cells.set(key, cell)
          }
          cell.push(ei)
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
      for (let cy = cy0; cy <= cy1; cy++) {
        const cell = this.cells.get(`${cx},${cy}`)
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
