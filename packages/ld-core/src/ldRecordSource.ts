import type { PlinkLDHeader, PlinkLDRecord } from './plinkLDTypes.ts'

// Structural contract for a pre-computed LD adapter, shared across plugin
// boundaries via this neutral package: the GWAS worker (r²-to-index coloring)
// and the variants worker (LD triangle matrix) both consume it without
// depending on the concrete PlinkLD adapter classes. Both PlinkLDAdapter and
// PlinkLDTabixAdapter `implements` this so conformance is compiler-checked.
export interface LDRecordSource {
  // Pairs whose A-side SNP falls within the region.
  getLDRecords(
    query: { refName: string; start: number; end: number },
    opts?: object,
  ): Promise<PlinkLDRecord[]>
  // Pairs with BOTH SNPs inside the region (for the LD triangle display).
  getLDRecordsInRegion(
    query: { refName: string; start: number; end: number },
    opts?: object,
  ): Promise<PlinkLDRecord[]>
  // Resolved column layout — `dprimeIdx >= 0` iff the file carries a D' column.
  getHeader(opts?: object): Promise<PlinkLDHeader>
}

// Runtime narrowing at the RPC boundary, where getAdapter yields an untyped
// AnyDataAdapter. Lets callers throw an explicit "not an LD adapter" error
// instead of casting and later hitting a cryptic "getLDRecords is not a
// function".
export function isLDRecordSource(adapter: unknown): adapter is LDRecordSource {
  return (
    typeof adapter === 'object' &&
    adapter !== null &&
    'getLDRecords' in adapter &&
    typeof adapter.getLDRecords === 'function' &&
    'getLDRecordsInRegion' in adapter &&
    typeof adapter.getLDRecordsInRegion === 'function' &&
    'getHeader' in adapter &&
    typeof adapter.getHeader === 'function'
  )
}
