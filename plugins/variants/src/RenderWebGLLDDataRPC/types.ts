import type { LDFlatbushItem } from '../LDRenderer/types.ts'
import type {
  FilterStats,
  LDMatrixResult,
  LDMetric,
} from '../VariantRPC/getLDMatrix.ts'

export interface WebGLLDDataResult {
  positions: Float32Array
  ldValues: Float32Array
  cellSizes: Float32Array
  numCells: number
  maxScore: number
  uniformW: number
  yScalar: number
  metric: LDMetric
  signedLD: boolean
  flatbush: ArrayBuffer
  items: LDFlatbushItem[]
  snps: LDMatrixResult['snps']
  filterStats?: FilterStats
  recombination?: {
    values: number[]
    positions: number[]
  }
  regionTooLarge?: boolean
}
