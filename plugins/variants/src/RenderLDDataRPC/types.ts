import type { LDLayout, LDMetric, LDSnp } from './ldTypes.ts'

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
  // Where the cells were laid out: a multi-region view falls back to uniform
  // columns.
  appliedLayout: LDLayout
  // the metric `ldValues` holds, and which columns the file has
  appliedField: LDMetric
  hasR2: boolean
  hasDprime: boolean
  snps: LDSnp[]
}
