import type {
  FilterStats,
  LDMatrixResult,
  LDMetric,
} from '../VariantRPC/getLDMatrix.ts'

export interface LDFlatbushItem {
  i: number
  j: number
  ldValue: number
  snp1: LDMatrixResult['snps'][0]
  snp2: LDMatrixResult['snps'][0]
}

export interface LDDataResult {
  ldValues: Float32Array
  // n+1 boundary positions for hit testing and Canvas2D/SVG rendering.
  // For uniform mode: boundaries[k] = k * uniformW.
  // For genomic positions mode: midpoint boundaries between adjacent SNPs.
  boundaries: Float32Array
  numCells: number
  maxScore: number
  uniformW: number
  yScalar: number
  metric: LDMetric
  signedLD: boolean
  snps: LDMatrixResult['snps']
  filterStats?: FilterStats
  recombination?: {
    values: number[]
    positions: number[]
  }
  // Only present for genomic positions mode (pre-computed per-cell positions
  // for the GPU interleaved buffer).
  positions?: Float32Array
  cellSizes?: Float32Array
}
