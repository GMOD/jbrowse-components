export type LDMetric = 'r2' | 'dprime'

export interface LDSnp {
  // The variant id the LD file names (e.g. an rsID), or `chr:bp` when the file
  // has no id column or writes `.`.
  id?: string
  refName: string
  start: number
  end: number
  // Minor allele frequency, when the file carries a MAF column.
  maf?: number
}

export interface LDMatrixResult {
  snps: LDSnp[]
  ldValues: Float32Array
  // The metric `ldValues` holds: a file lacking the requested column serves
  // the other one.
  metric: LDMetric
  // Which columns the file has, so the display disables a missing one's
  // radio.
  hasR2: boolean
  hasDprime: boolean
  // The widest pair the file lists, the band `ldValues` is laid out at
  // (`ldBand.ts`).
  band: number
}
