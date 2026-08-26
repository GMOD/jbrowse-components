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
//
// `key` is undefined for an LD-record side with no position key in the caller's
// scheme — a trans-LD partner on another contig (see `callerKey`). Such a side
// can still match by SNP id, which names no contig; it just has no position to
// match on, which is what an undefined key can never equal (`indexSnp` is a
// non-empty string wherever LD coloring runs — see `ldColoringRequested`).
export function matchesIndexSnp(
  name: string | undefined,
  key: string | undefined,
  indexSnp: string,
) {
  return name === indexSnp || key === indexSnp
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
//
// Why the two files aren't just two RPCs, which is how the MAF display handles
// its own second adapter (`LinearMafGetAnnotationData` is called with
// `adapterConfig: annotationAdapterConfig`, so the ordinary rename covers it
// and nothing has to be threaded): the r²-to-feature join is per feature, and
// features never cross this boundary — only packed typed arrays come back. The
// join has to happen where the Feature objects are, so both files have to be
// readable from one call, so one of the two names has to travel.
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

  // One side's position key in the caller's scheme, or undefined when that side
  // is not on this region's contig.
  //
  // Every record the scan sees was matched on `chrA === queryRefName` by the
  // adapter, so that name IS this region's contig under another spelling.
  // Anything else is trans-LD — a partner on some other contig, which PLINK's
  // windowed output does not normally emit — and `ldRefName` is a single pair
  // out of the assembly's whole aliasing, so there is nothing here to translate
  // it with. Such a side matches no feature in this region regardless; leaving
  // it out keeps every position key in `r2ByKey` one that `makeLdEvaluator`
  // could actually build, instead of mixing a second file's spelling into a map
  // that is otherwise entirely in the caller's.
  const callerKey = (chr: string, bp: number) =>
    chr === queryRefName ? `${region.refName}:${bp}` : undefined

  const r2ByKey = new Map<string, number>()
  let indexFound = false
  for (const r of records) {
    // indexSnp is in the caller's scheme too (GetManhattanData rewrites it
    // through the same rename as the region), so compare against keys built in
    // that scheme, not against the record's own `chrA`/`chrB`.
    const keyA = callerKey(r.chrA, r.bpA)
    const keyB = callerKey(r.chrB, r.bpB)
    const aIsIndex = matchesIndexSnp(r.snpA, keyA, indexSnp)
    const bIsIndex = matchesIndexSnp(r.snpB, keyB, indexSnp)
    if (aIsIndex && !bIsIndex) {
      indexFound = true
      r2ByKey.set(r.snpB, r.r2)
      if (keyB !== undefined) {
        r2ByKey.set(keyB, r.r2)
      }
    } else if (bIsIndex && !aIsIndex) {
      indexFound = true
      r2ByKey.set(r.snpA, r.r2)
      if (keyA !== undefined) {
        r2ByKey.set(keyA, r.r2)
      }
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
