import type { Region } from './types/index.ts'

// `*` is the only metacharacter; everything else in a name is matched literally,
// so a refName containing regex punctuation (`chr1.1`, `scaffold[2]`) can't turn
// into an accidental pattern.
function globToRegExp(pattern: string) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, m =>
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
  for (const name of names) {
    if (name.includes('*')) {
      const re = globToRegExp(name)
      for (const r of regions) {
        if (re.test(r.refName) && !seen.has(r.refName)) {
          seen.add(r.refName)
          out.push(r)
        }
      }
    } else {
      const r = byRefName.get(getCanonicalRefName(name) ?? name)
      if (r && !seen.has(r.refName)) {
        seen.add(r.refName)
        out.push(r)
      }
    }
  }
  return out
}
