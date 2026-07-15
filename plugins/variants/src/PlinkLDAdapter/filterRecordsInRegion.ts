import type { NoAssemblyRegion } from '@jbrowse/core/util/types'
import type { PlinkLDRecord } from '@jbrowse/ld-core'

// Keep only records with BOTH SNPs inside the region — what the LD triangle
// display needs. Shared by the in-memory and tabix adapters so their
// getLDRecordsInRegion semantics can't drift. The A-side test is redundant when
// the caller already scoped by A (both adapters do), but making it explicit
// here means the helper is correct on any record set.
export function filterRecordsInRegion(
  records: PlinkLDRecord[],
  { refName, start, end }: NoAssemblyRegion,
) {
  return records.filter(
    r =>
      r.chrA === refName &&
      r.bpA >= start &&
      r.bpA <= end &&
      r.chrB === refName &&
      r.bpB >= start &&
      r.bpB <= end,
  )
}
