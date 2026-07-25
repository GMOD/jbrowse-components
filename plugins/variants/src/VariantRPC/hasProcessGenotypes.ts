import type { GenotypeCallback } from '@gmod/vcf'
import type { Feature } from '@jbrowse/core/util'

export interface VCFFeatureLike extends Feature {
  processGenotypes(cb: GenotypeCallback): void
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
