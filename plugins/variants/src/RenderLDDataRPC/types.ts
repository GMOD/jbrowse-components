import type {
  FilterStats,
  LDMethod,
  LDMetric,
  LDSnp,
} from '../VariantRPC/getLDMatrix.ts'

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
  // Whether the cells above were actually laid out at genomic positions. A
  // multi-region viewport has no single bp axis to lay them on, so a
  // `useGenomicPositions` request falls back to uniform cells there — the
  // display reads this rather than its own slot, the same requested-vs-loaded
  // split as `metric`.
  genomicMode: boolean
  metric: LDMetric
  // Whether D' is selectable — false only for a pre-computed file with no DP
  // column, so the display can disable the D' metric option.
  hasDprime: boolean
  // How the values were derived, so the status bar can label precision.
  method: LDMethod
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
