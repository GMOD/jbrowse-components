import { parseChrBp } from './parseChrBp.ts'

import type { Region } from '@jbrowse/core/util'
import type { LDRecordSource } from '@jbrowse/ld-core'

// PLINK BP is the 1-based variant position; JBrowse features are 0-based start.
// The position key therefore uses start+1 so it lines up with `chr:bp` ids.
export function posKey(refName: string, start: number) {
  return `${refName}:${start + 1}`
}

// PLINK writes `.` for a variant it has no id for, and a `.` is not an
// identifier — it is the absence of one. Keyed as if it were, every unnamed
// partner in a file collides on the single `.` entry and the last one wins, so
// a feature the GWAS file also leaves unnamed reads back a stranger's r², and
// one with no LD record at all is colored as a partner. Both sides of the
// name comparison go through this, so an unnamed record can neither be keyed
// nor be mistaken for an unnamed index.
export function isNamedSnp(name: string | undefined): name is string {
  return name !== undefined && name !== '' && name !== '.'
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
  return (isNamedSnp(name) && name === indexSnp) || key === indexSnp
}

export interface LdToIndex {
  // r² keyed by the partner's `chr:bp` position and, where the file names it,
  // by its SNP id too, so a feature can be looked up either way.
  r2ByKey: Map<string, number>
  // True when no record in the index's window referenced the index SNP at all
  // — lets the caller distinguish "index not in this LD dataset" from "real
  // zeros".
  indexFound: boolean
}

// Shared lookup: feature → r² to the index SNP, or undefined if absent.
// Checks both the feature's name (SNP id) and its position key.
export function lookupR2(
  ld: LdToIndex,
  name: string | undefined,
  key: string,
): number | undefined {
  const byName = isNamedSnp(name) ? ld.r2ByKey.get(name) : undefined
  return byName !== undefined ? byName : ld.r2ByKey.get(key)
}

// Where to read the `.ld` file for one region's coloring, in the LD adapter's
// naming scheme, or undefined when no record could possibly help.
//
// **Anchored on the index SNP, not on the viewport.** PLINK emits a pair once
// and an index over the file finds a row by its A side, so a window that does
// not contain the index returns no row that mentions it: read the viewport and
// panning the index off screen greys every point. Measured on
// `test_data/gwas/SLE.ld`, whose rows all carry the index as their A side, a
// 200kb pan in either direction took 1212 partners to 0.
//
// `windowBp` is the reach-back, and it is a setting rather than something
// discoverable here because the file does not record the `--ld-window-kb` it
// was written at.
//
// The two fallbacks are the cases with no locus to anchor on:
//   - a bare rsID index has no position until a record names it, so the
//     viewport is still the only window there is, and the scan matches by id.
//   - a placeable index on another contig can have no partner among this
//     region's features at all — PLINK's windowed output is same-contig — so
//     there is nothing to read. Returning undefined skips the request rather
//     than spending it to find nothing.
export function ldQueryWindow({
  region,
  queryRefName,
  indexSnp,
  windowBp,
}: {
  region: Region
  queryRefName: string
  indexSnp: string
  windowBp: number
}) {
  // `indexSnp` and `region.refName` are both in the GWAS adapter's scheme
  // (`GetManhattanData` renames the index through the same pass as the
  // region), so they are comparable; the window that comes out is spelled in
  // the LD file's scheme, which is what the adapter is asked in.
  const parsed = parseChrBp(indexSnp)
  if (!parsed) {
    return { refName: queryRefName, start: region.start, end: region.end }
  }
  return parsed.refName === region.refName
    ? {
        refName: queryRefName,
        start: Math.max(0, parsed.bp - 1 - windowBp),
        end: parsed.bp + windowBp,
      }
    : undefined
}

// Build the per-SNP r²-to-index lookup from a PLINK .ld source. Reads every
// pair in the index's window, keeps those where one side is the index SNP, and
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
  windowBp,
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
  // bp either side of the index to read; see `ldQueryWindow`.
  windowBp: number
}): Promise<LdToIndex> {
  const queryRefName = ldRefName ?? region.refName
  const query = ldQueryWindow({ region, queryRefName, indexSnp, windowBp })
  if (!query) {
    return { r2ByKey: new Map(), indexFound: false }
  }
  const records = await adapter.getLDRecords(query)

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
    // A record with no r² is a file with no R2 column — `--r2 dprime` emits
    // one. It used to read back as 0, which colored every partner at the
    // ramp's floor with nothing anywhere saying the column was missing.
    if (r.r2 === undefined) {
      continue
    }
    // indexSnp is in the caller's scheme too (GetManhattanData rewrites it
    // through the same rename as the region), so compare against keys built in
    // that scheme, not against the record's own `chrA`/`chrB`.
    const keyA = callerKey(r.chrA, r.bpA)
    const keyB = callerKey(r.chrB, r.bpB)
    const aIsIndex = matchesIndexSnp(r.snpA, keyA, indexSnp)
    const bIsIndex = matchesIndexSnp(r.snpB, keyB, indexSnp)
    if (aIsIndex !== bIsIndex) {
      indexFound = true
      // the partner is whichever side the index is not
      const name = aIsIndex ? r.snpB : r.snpA
      const key = aIsIndex ? keyB : keyA
      if (isNamedSnp(name)) {
        r2ByKey.set(name, r.r2)
      }
      if (key !== undefined) {
        r2ByKey.set(key, r.r2)
      }
    }
  }
  if (!indexFound && records.length > 0) {
    const r = records[0]!
    console.warn(
      `LD coloring: index SNP "${indexSnp}" matched none of ${records.length} ` +
        `LD records in ${query.refName}:${query.start}-${query.end} ` +
        `(e.g. SNP_A "${r.snpA}" at ${r.chrA}:${r.bpA}) — every point will be ` +
        `grey. The index is probably absent from the LD file, or named ` +
        `differently there than in the GWAS file.`,
    )
  }
  return { r2ByKey, indexFound }
}
