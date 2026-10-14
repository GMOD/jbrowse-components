import { bpOffsetInRegion } from '@jbrowse/core/util/Base1DUtils'

import { bandCellCount, bandRowFirstColumn } from './ldBand.ts'

import type { LDSnp } from './ldTypes.ts'
import type { Region } from '@jbrowse/core/util/types'

// Pre-rotation coordinates are the 45°-rotated frame's axis, so every px
// distance collapses by √2 (see drawLDBlocks / ldMarks).
const ROTATION = Math.SQRT2

/**
 * The n+1 column boundaries the renderers walk, one per SNP plus a right edge,
 * in pre-rotation units (bp / √2, relative to the region's left screen edge).
 * Uniform mode gives every SNP the same width. Genomic mode puts the boundary
 * between two SNPs at their bp midpoint, and each end column reaches as far
 * past its SNP as toward its neighbour, at least 1 bp, so no column's width
 * depends on where the fetched block starts.
 */
export function computeBoundaries({
  snps,
  region,
  uniformW,
  genomicMode,
}: {
  snps: LDSnp[]
  region: Region
  uniformW: number
  genomicMode: boolean
}) {
  const n = snps.length
  if (n === 0) {
    return new Float32Array(0)
  }
  const boundaries = new Float32Array(n + 1)
  if (genomicMode) {
    const offs = snps.map(snp => bpOffsetInRegion(region, snp.start))
    for (let i = 1; i < n; i++) {
      boundaries[i] = (offs[i - 1]! + offs[i]!) / 2 / ROTATION
    }
    const first = offs[0]!
    const last = offs[n - 1]!
    const halfGap = (a: number, b: number) => Math.max(1, (b - a) / 2)
    boundaries[0] = (first - halfGap(first, offs[1] ?? first)) / ROTATION
    boundaries[n] = (last + halfGap(offs[n - 2] ?? last, last)) / ROTATION
  } else {
    for (let i = 0; i <= n; i++) {
      boundaries[i] = i * uniformW
    }
  }
  return boundaries
}

/**
 * Interleaved per-cell x/y and width/height for the `genomic` mark in ldMarks.ts,
 * in the same cell order as `ldValues`. Uniform mode derives cells from
 * `uniformW` in the shader instead, and skips these buffers entirely.
 *
 * These are why genomic mode costs 5x what uniform mode does: 16 bytes a cell
 * here against `ldValues`' 4. The band therefore buys the most where the cost
 * is worst.
 */
export function buildGenomicCellBuffers(
  boundaries: Float32Array,
  band: number,
) {
  const n = boundaries.length - 1
  const numCells = bandCellCount(n, band)
  const positions = new Float32Array(numCells * 2)
  const cellSizes = new Float32Array(numCells * 2)
  let cellIdx = 0
  for (let i = 1; i < n; i++) {
    const y = boundaries[i]!
    const ch = boundaries[i + 1]! - y
    for (let j = bandRowFirstColumn(i, band); j < i; j++) {
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
