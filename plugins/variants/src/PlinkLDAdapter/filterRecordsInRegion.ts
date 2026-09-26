import type { NoAssemblyRegion } from '@jbrowse/core/util/types'
import type { PlinkLDRecord } from '@jbrowse/ld-core'

/**
 * Whether a PLINK `BP`, a 1-based position, lies in a 0-based half-open region:
 * the base `[BP-1, BP)` overlaps `[start, end)`. The tabix query answers the
 * same rule, so the plain and tabix adapters agree at both edges.
 */
export function bpInRegion(bp: number, { start, end }: NoAssemblyRegion) {
  return bp > start && bp <= end
}

// Keep only records with BOTH SNPs inside the region, which is what the LD
// triangle draws.
export function filterRecordsInRegion(
  records: PlinkLDRecord[],
  region: NoAssemblyRegion,
) {
  return records.filter(
    r =>
      r.chrA === region.refName &&
      bpInRegion(r.bpA, region) &&
      r.chrB === region.refName &&
      bpInRegion(r.bpB, region),
  )
}
