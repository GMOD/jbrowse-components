import type { FormatFieldsCallback, GenotypeCallback } from '@gmod/vcf'
import type { Feature } from '@jbrowse/core/util'

export interface VCFFeatureLike extends Feature {
  processGenotypes(cb: GenotypeCallback): void
}

export interface FormatFieldFeatureLike extends Feature {
  processFormatFields(keys: string[], cb: FormatFieldsCallback): void
}

// The same allocation-free iteration for named FORMAT fields past GT. Phase-set
// coloring is the caller: it needs GT and PS, and reading them through the
// `samples` field parses every other FORMAT field of every sample to get there
// — 343ms and 239MB per fetch on a 100-sample phased callset, against 33ms and
// 4MB here.
//
// Same `sampleIdx` rule as above, and the same one again after that: the index
// counts against the feature's OWN header, which is the canonical sample order
// only for a single-header adapter (see buildHeaderRemap).
export function hasProcessFormatFields(
  f: Feature,
): f is FormatFieldFeatureLike {
  return (
    typeof (f as Partial<FormatFieldFeatureLike>).processFormatFields ===
    'function'
  )
}

// The allocation-free genotype iteration VcfFeature offers: no genotypes
// Record, no per-call substring. Both matrix builders take it when present and
// fall back to `feature.get('genotypes')` otherwise.
//
// Callers must key off the callback's `sampleIdx` rather than counting calls.
// @gmod/vcf skips the callback entirely for a sample whose colon-separated
// FORMAT fields stop before the GT column, so a running counter silently shifts
// every later sample's genotype by one.
export function hasProcessGenotypes(f: Feature): f is VCFFeatureLike {
  return typeof (f as Partial<VCFFeatureLike>).processGenotypes === 'function'
}
