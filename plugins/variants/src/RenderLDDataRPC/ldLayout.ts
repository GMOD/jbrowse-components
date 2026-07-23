import { bpOffsetInRegion } from '@jbrowse/core/util/Base1DUtils'

import type { LDSnp } from '../VariantRPC/getLDMatrix.ts'
import type { Region } from '@jbrowse/core/util/types'

// Pre-rotation coordinates are the 45°-rotated frame's axis, so every px
// distance collapses by √2 (see drawLDBlocks / GpuLDRenderer).
const ROTATION = Math.SQRT2

/**
 * The n+1 column boundaries the renderers walk, one per SNP plus a right edge,
 * in pre-rotation units. Uniform mode gives every SNP the same width; genomic
 * mode places the boundary between two SNPs at their bp midpoint, measured from
 * the region's left screen edge so a reversed region stays ascending.
 */
export function computeBoundaries({
  snps,
  region,
  bpPerPx,
  uniformW,
  genomicMode,
}: {
  snps: LDSnp[]
  region: Region
  bpPerPx: number
  uniformW: number
  genomicMode: boolean
}) {
  const n = snps.length
  const boundaries = new Float32Array(n + 1)
  if (genomicMode) {
    let prevOff = 0
    for (let i = 0; i < n; i++) {
      const off = bpOffsetInRegion(region, snps[i]!.start)
      boundaries[i] = (prevOff + off) / 2 / bpPerPx / ROTATION
      prevOff = off
    }
    // Half a cell past the last SNP, so it gets a visible width of its own.
    boundaries[n] = (prevOff / bpPerPx + 50) / ROTATION
  } else {
    for (let i = 0; i <= n; i++) {
      boundaries[i] = i * uniformW
    }
  }
  return boundaries
}

/**
 * Interleaved per-cell x/y and width/height for `GpuLDRenderer`'s genomic pass,
 * in the same cell order as `ldValues`. Uniform mode derives cells from
 * `uniformW` in the shader instead, and skips this O(N²) buffer entirely.
 */
export function buildGenomicCellBuffers(boundaries: Float32Array) {
  const n = boundaries.length - 1
  const numCells = (n * (n - 1)) / 2
  const positions = new Float32Array(numCells * 2)
  const cellSizes = new Float32Array(numCells * 2)
  let cellIdx = 0
  for (let i = 1; i < n; i++) {
    const y = boundaries[i]!
    const ch = boundaries[i + 1]! - y
    for (let j = 0; j < i; j++) {
      const x = boundaries[j]!
      positions[cellIdx * 2] = x
      positions[cellIdx * 2 + 1] = y
      cellSizes[cellIdx * 2] = boundaries[j + 1]! - x
      cellSizes[cellIdx * 2 + 1] = ch
      cellIdx++
    }
  }
  return { positions, cellSizes }
}
