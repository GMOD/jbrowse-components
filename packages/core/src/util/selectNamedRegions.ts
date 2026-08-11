import type { Region } from './types/index.ts'

// `*` is the only metacharacter; everything else in a name is matched literally,
// so a refName containing regex punctuation (`chr1.1`, `scaffold[2]`) can't turn
// into an accidental pattern.
function globToRegExp(pattern: string) {
  const escaped = pattern.replaceAll(/[.*+?^${}()|[\]\\]/g, m =>
    m === '*' ? '.*' : `\\${m}`,
  )
  return new RegExp(`^${escaped}$`)
}

/**
 * Resolve caller-supplied region names against an assembly's own regions,
 * preserving the requested order and dropping names that match nothing.
 *
 * An entry containing `*` is a glob matched against the refName, which is what
 * makes a fragmented assembly tractable: a haplotype-resolved genome wants "all
 * of hap1" (`*_hap1`), not a hand-maintained list of its 16 scaffolds that goes
 * stale the moment the assembly is rebuilt. A glob contributes its matches in
 * the ASSEMBLY's order (the only order it can mean); exact names contribute in
 * the CALLER's order, so an explicit list still controls layout. Duplicates
 * across entries are dropped, so `['chr1_hap1', '*_hap1']` is chr1 first then
 * the rest.
 *
 * AN EXACT REFNAME BEATS THE GLOB READING, which is the only reason `*` is safe
 * to hand a user as a syntax: `*` is a legal character in a real contig name and
 * the names carrying it are the ones nobody would think to escape. GRCh38's ALT
 * decoys are HLA allele names — `HLA-A*01:01:01:01` — so a pattern typed to name
 * one allele was compiled to `^HLA-A.*01:01:01:01$`, which matches that contig
 * (hence it looked fine) and every other HLA-A allele with the same last four
 * fields. Trying the literal lookup first costs one Map hit and means a name
 * that IS a contig always resolves to that contig; only a name matching nothing
 * is reinterpreted as a pattern.
 *
 * Selecting from the assembly's own region objects (rather than synthesizing
 * them) keeps coordinates and lengths correct; `getCanonicalRefName` lets an
 * exact name resolve through the assembly's aliases.
 */
export function selectNamedRegions(
  regions: readonly Region[],
  names: readonly string[],
  getCanonicalRefName: (name: string) => string | undefined,
): Region[] {
  const byRefName = new Map(regions.map(r => [r.refName, r]))
  const out: Region[] = []
  const seen = new Set<string>()
  const take = (r: Region | undefined) => {
    if (r && !seen.has(r.refName)) {
      seen.add(r.refName)
      out.push(r)
    }
  }
  for (const name of names) {
    const exact = byRefName.get(getCanonicalRefName(name) ?? name)
    if (exact) {
      take(exact)
    } else if (name.includes('*')) {
      const re = globToRegExp(name)
      for (const r of regions) {
        if (re.test(r.refName)) {
          take(r)
        }
      }
    }
  }
  return out
}
