import type { Region } from '@jbrowse/core/util'
import type { LDRecordSource } from '@jbrowse/ld-core'

// PLINK BP is the 1-based variant position; JBrowse features are 0-based start.
// The position key therefore uses start+1 so it lines up with `chr:bp` ids.
export function posKey(refName: string, start: number) {
  return `${refName}:${start + 1}`
}

// True when a feature's SNP id or its chr:bp position key equals the index SNP.
// Single source of truth for "is this the index" across the color/r² evaluators
// and the LD-record scan, so they can't drift apart.
export function matchesIndexSnp(
  name: string | undefined,
  key: string,
  indexSnp: string,
) {
  return name === indexSnp || key === indexSnp
}

function sideMatchesIndex(snp: string, chr: string, bp: number, index: string) {
  return matchesIndexSnp(snp, `${chr}:${bp}`, index)
}

export interface LdToIndex {
  // r² keyed by both the partner's SNP id and its `chr:bp` position, so a
  // feature can be looked up by name or by position.
  r2ByKey: Map<string, number>
  // True when no record in the region referenced the index SNP at all — lets
  // the caller distinguish "index not in this LD dataset" from "real zeros".
  indexFound: boolean
}

// Shared lookup: feature → r² to the index SNP, or undefined if absent.
// Checks both the feature's name (SNP id) and its position key.
export function lookupR2(
  ld: LdToIndex,
  name: string | undefined,
  key: string,
): number | undefined {
  const byName = name !== undefined ? ld.r2ByKey.get(name) : undefined
  return byName !== undefined ? byName : ld.r2ByKey.get(key)
}

// Build the per-SNP r²-to-index lookup from a PLINK .ld source. Reads every
// pair touching the region, keeps those where one side is the index SNP, and
// maps the *other* side's r². Captures both orientations (index as SNP_A or
// SNP_B) since PLINK emits each pair once.
//
// Two reference-name schemes meet here, which is the whole reason `ldRefName`
// exists. The LD file is a SECOND adapter: `renameRegionsIfNeeded` puts
// `region` into the *GWAS* adapter's scheme (it renames against
// `args.adapterConfig`), and the PLINK file may name the same contig
// differently. So the query goes out in the LD file's scheme and everything
// that comes back is translated to the caller's before it is keyed —
// `makeLdEvaluator` looks these keys up with `posKey(region.refName, …)` built
// from GWAS features, and a `chr16` key never matches a `16` lookup.
export async function buildLdToIndex({
  adapter,
  region,
  ldRefName,
  indexSnp,
}: {
  // Only the A-side scan is needed here, so accept the narrower capability.
  adapter: Pick<LDRecordSource, 'getLDRecords'>
  region: Region
  // `region.refName` in the LD adapter's naming scheme. Undefined when the
  // caller could not resolve one (no LD adapter config, or an assembly whose
  // aliases have not loaded), which falls back to the region's own name — the
  // behaviour before this was threaded, and correct whenever the two files
  // agree.
  ldRefName?: string
  indexSnp: string
}): Promise<LdToIndex> {
  const queryRefName = ldRefName ?? region.refName
  const records = await adapter.getLDRecords({
    refName: queryRefName,
    start: region.start,
    end: region.end,
  })

  // A record's contig, in the caller's scheme. Every record the scan sees was
  // matched on `chrA === queryRefName` by the adapter, so that name IS this
  // region's contig under another spelling. A `chrB` on some other contig
  // (trans-LD, which PLINK's windowed output does not normally emit) keeps its
  // own name and simply matches no feature here, which is the right answer.
  const toCallerRefName = (chr: string) =>
    chr === queryRefName ? region.refName : chr

  const r2ByKey = new Map<string, number>()
  let indexFound = false
  for (const r of records) {
    // indexSnp is in the caller's scheme too (GetManhattanData rewrites it
    // through the same rename as the region), so translate before comparing.
    const aIsIndex = sideMatchesIndex(
      r.snpA,
      toCallerRefName(r.chrA),
      r.bpA,
      indexSnp,
    )
    const bIsIndex = sideMatchesIndex(
      r.snpB,
      toCallerRefName(r.chrB),
      r.bpB,
      indexSnp,
    )
    if (aIsIndex && !bIsIndex) {
      indexFound = true
      r2ByKey.set(r.snpB, r.r2)
      r2ByKey.set(`${toCallerRefName(r.chrB)}:${r.bpB}`, r.r2)
    } else if (bIsIndex && !aIsIndex) {
      indexFound = true
      r2ByKey.set(r.snpA, r.r2)
      r2ByKey.set(`${toCallerRefName(r.chrA)}:${r.bpA}`, r.r2)
    }
  }
  if (!indexFound && records.length > 0) {
    const r = records[0]!
    console.warn(
      `LD coloring: index SNP "${indexSnp}" matched none of ${records.length} ` +
        `LD records in ${queryRefName}:${region.start}-${region.end} ` +
        `(e.g. SNP_A "${r.snpA}" at ${r.chrA}:${r.bpA}) — every point will be ` +
        `grey. The index is probably absent from the LD file, or named ` +
        `differently there than in the GWAS file.`,
    )
  }
  return { r2ByKey, indexFound }
}
