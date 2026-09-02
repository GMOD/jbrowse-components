export type LDMetric = 'r2' | 'dprime'

export interface LDSnp {
  // The variant id the LD file names (e.g. an rsID), or `chr:bp` when the file
  // has no id column.
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
  // The metric actually represented by ldValues. Usually equals the requested
  // metric, but a file lacking a D' column downgrades a 'dprime' request to
  // 'r2' rather than silently mislabeling r² as D'.
  metric: LDMetric
  // Whether D' is available — false for a file with no DP column, so the
  // display can disable D'.
  hasDprime: boolean
  /**
   * The pair-separation window `ldValues` was laid out at — `resolveBand` of
   * the requested `maxVariantSeparation`, so always concrete and never wider
   * than `snps.length - 1`. Every reader indexes through it (`bandPairIndex`);
   * at the full-triangle value it is the layout this one generalizes.
   */
  band: number
}
