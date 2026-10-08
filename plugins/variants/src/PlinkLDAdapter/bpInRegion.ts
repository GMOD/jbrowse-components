import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

/**
 * Whether a PLINK `BP`, a 1-based position, lies in a 0-based half-open region:
 * the base `[BP-1, BP)` overlaps `[start, end)`. The tabix query answers the
 * same rule, so the plain and tabix adapters agree at both edges.
 */
export function bpInRegion(bp: number, { start, end }: NoAssemblyRegion) {
  return bp > start && bp <= end
}
