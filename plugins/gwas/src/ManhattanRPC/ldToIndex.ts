import type { Region } from '@jbrowse/core/util'
import type { PlinkLDRecord } from '@jbrowse/ld-core'

// Both PlinkLDAdapter and PlinkLDTabixAdapter expose this — structural typing
// keeps the GWAS worker decoupled from the variants plugin (only the record
// type is shared, via @jbrowse/ld-core).
export interface LDRecordSource {
  getLDRecords(
    query: { refName: string; start: number; end: number },
    opts?: object,
  ): Promise<PlinkLDRecord[]>
}

// PLINK BP is the 1-based variant position; JBrowse features are 0-based start.
// The position key therefore uses start+1 so it lines up with `chr:bp` ids.
export function posKey(refName: string, start: number) {
  return `${refName}:${start + 1}`
}

function sideMatchesIndex(snp: string, chr: string, bp: number, index: string) {
  return snp === index || `${chr}:${bp}` === index
}

export interface LdToIndex {
  // r² keyed by both the partner's SNP id and its `chr:bp` position, so a
  // feature can be looked up by name or by position.
  r2ByKey: Map<string, number>
  // True when no record in the region referenced the index SNP at all — lets
  // the caller distinguish "index not in this LD dataset" from "real zeros".
  indexFound: boolean
}

// Build the per-SNP r²-to-index lookup from a PLINK .ld source. Reads every
// pair touching the region, keeps those where one side is the index SNP, and
// maps the *other* side's r². Captures both orientations (index as SNP_A or
// SNP_B) since PLINK emits each pair once.
export async function buildLdToIndex({
  adapter,
  region,
  indexSnp,
}: {
  adapter: LDRecordSource
  region: Region
  indexSnp: string
}): Promise<LdToIndex> {
  const records = await adapter.getLDRecords({
    refName: region.refName,
    start: region.start,
    end: region.end,
  })

  const r2ByKey = new Map<string, number>()
  let indexFound = false
  for (const r of records) {
    const aIsIndex = sideMatchesIndex(r.snpA, r.chrA, r.bpA, indexSnp)
    const bIsIndex = sideMatchesIndex(r.snpB, r.chrB, r.bpB, indexSnp)
    if (aIsIndex && !bIsIndex) {
      indexFound = true
      r2ByKey.set(r.snpB, r.r2)
      r2ByKey.set(`${r.chrB}:${r.bpB}`, r.r2)
    } else if (bIsIndex && !aIsIndex) {
      indexFound = true
      r2ByKey.set(r.snpA, r.r2)
      r2ByKey.set(`${r.chrA}:${r.bpA}`, r.r2)
    }
  }
  return { r2ByKey, indexFound }
}
