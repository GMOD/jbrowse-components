import type { LDMetric, LDSnp } from '../VariantRPC/ldTypes.ts'

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
  /**
   * Pair-separation window `ldValues` is laid out at. Every reader — both
   * renderers, hitTest, the SVG export — indexes through it, and at the
   * full-triangle value it is the layout the band generalizes.
   */
  band: number
  uniformW: number
  // echoed from RenderLDDataArgs.originBp; see its note
  originBp: number
  // Whether the cells above were actually laid out at genomic positions. A
  // multi-region viewport has no single bp axis to lay them on, so a
  // `useGenomicPositions` request falls back to uniform cells there — the
  // display reads this rather than its own slot, the same requested-vs-loaded
  // split as `metric`.
  genomicMode: boolean
  // The metric the file could actually serve, which is not always the one
  // requested — see `resolveMetric`.
  metric: LDMetric
  // Whether D' is selectable — false for a file with no DP column, so the
  // display can disable the D' metric option.
  hasDprime: boolean
  snps: LDSnp[]
  // Only present for genomic positions mode (pre-computed per-cell positions
  // for the GPU interleaved buffer).
  positions?: Float32Array
  cellSizes?: Float32Array
}
