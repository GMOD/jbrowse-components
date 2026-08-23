import type {
  FilterStats,
  LDMethod,
  LDMetric,
  LDSnp,
} from '../VariantRPC/getLDMatrix.ts'

const PRECOMPUTED_LD_ADAPTERS = [
  'PlinkLDAdapter',
  'PlinkLDTabixAdapter',
  'LdmatAdapter',
] as const

/**
 * Whether an adapter serves LD values read from a file rather than computed
 * from VCF genotypes — which decides the fetch path, the filter menus, and the
 * byte gate. The membership test lives here rather than at each of its three
 * call sites, all of which had to widen the `as const` list back to
 * `readonly string[]` to ask.
 *
 * Takes `unknown`, because two of the three callers read `type` off an adapter
 * config — an open-ended object whose contents no type can predict — so
 * `unknown` is what they honestly hold. Checking it here beats making each
 * caller cast, and subsumes the old `?? ''` absent-sentinel.
 */
export function isPrecomputedLDAdapter(type: unknown) {
  return (
    typeof type === 'string' &&
    (PRECOMPUTED_LD_ADAPTERS as readonly string[]).includes(type)
  )
}

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
  // echoed from RenderLDDataArgs.originBp; see its note
  originBp: number
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
  // Only present for genomic positions mode (pre-computed per-cell positions
  // for the GPU interleaved buffer).
  positions?: Float32Array
  cellSizes?: Float32Array
  /**
   * What the index quoted for the largest region, when the fetch carried a
   * `byteLimit` and the adapter had an estimate to give. Carried back on the
   * success path too, so the display's gate re-anchors its stored estimate on
   * every fetch rather than only on the ones it refuses.
   *
   * Absent for the pre-computed adapters (`PlinkLD*`), which serve no features
   * and are never measured — see `executeRenderLDData`.
   */
  bytes?: number
}
