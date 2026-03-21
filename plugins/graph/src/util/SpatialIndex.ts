import type { NodeSegment } from '../types.ts'

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
    const r = radius / this.cellSize
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
