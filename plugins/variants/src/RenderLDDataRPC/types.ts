import type { LDMetric, LDSnp } from './ldTypes.ts'

export interface LDCellHit {
  i: number
  j: number
  ldValue: number
  snp1: LDSnp
  snp2: LDSnp
}

export interface LDDataResult {
  ldValues: Float32Array
  // n+1 column edges (`computeBoundaries`), empty when there are no SNPs
  boundaries: Float32Array
  numCells: number
  // the band `ldValues` is laid out at (`ldBand.ts`)
  band: number
  uniformW: number
  // echoed from RenderLDDataArgs.originBp; see its note
  originBp: number
  // Whether the cells were laid out at genomic positions: a multi-region view
  // falls back to uniform columns.
  genomicMode: boolean
  // the metric `ldValues` holds, and which columns the file has
  metric: LDMetric
  hasR2: boolean
  hasDprime: boolean
  snps: LDSnp[]
  // Only present for genomic positions mode (pre-computed per-cell positions
  // for the GPU interleaved buffer).
  positions?: Float32Array
  cellSizes?: Float32Array
}
