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
  // index-estimated bytes the gate measured, absent when no budget applied
  bytes?: number
  // the band `ldValues` is laid out at (`ldBand.ts`)
  band: number
  uniformW: number
  // echoed from RenderLDDataArgs.originBp; see its note
  originBp: number
  // where the cells were laid out
  appliedLayout: LDLayout
  // the metric `ldValues` holds, and which columns the file has
  appliedField: LDMetric
  hasR2: boolean
  hasDprime: boolean
  snps: LDSnp[]
}
