import type { FilterStats, LDMetric, LDSnp } from '../VariantRPC/getLDMatrix.ts'

export const PRECOMPUTED_LD_ADAPTERS = [
  'PlinkLDAdapter',
  'PlinkLDTabixAdapter',
  'LdmatAdapter',
] as const

export interface LDFlatbushItem {
  i: number
  j: number
  ldValue: number
  snp1: LDSnp
  snp2: LDSnp
}

export interface LDDataResult {
  ldValues: Float32Array
  // n+1 boundary positions for hit testing and Canvas2D/SVG rendering.
  // For uniform mode: boundaries[k] = k * uniformW.
  // For genomic positions mode: midpoint boundaries between adjacent SNPs.
  boundaries: Float32Array
  numCells: number
  uniformW: number
  metric: LDMetric
  signedLD: boolean
  snps: LDSnp[]
  filterStats?: FilterStats
  recombination?: {
    values: Float32Array
    positions: number[]
  }
  // Only present for genomic positions mode (pre-computed per-cell positions
  // for the GPU interleaved buffer).
  positions?: Float32Array
  cellSizes?: Float32Array
}
