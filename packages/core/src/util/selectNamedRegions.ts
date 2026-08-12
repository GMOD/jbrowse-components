import type { Region } from './types/index.ts'

/**
 * `*` is the only metacharacter; everything else in a name is matched literally,
 * so a refName containing regex punctuation (`chr1.1`, `scaffold[2]`) can't turn
 * into an accidental pattern. Anchored, so a pattern names whole refNames.
 *
 * Exported because the search box's refName matching reads the same syntax, and
 * one reading of `*` is the whole point: a pattern that selects a set in a
 * session spec has to select the same set when typed into the box.
 */
export function globToRegExp(pattern: string) {
  const escaped = pattern.replaceAll(/[.*+?^${}()|[\]\\]/g, m =>
    m === '*' ? '.*' : `\\${m}`,
  )
  // Case-INSENSITIVE, and not optionally. The literal reading beside it resolves
  // through getCanonicalRefName, which falls back to `lowerCaseRefNameAliases`,
  // so `CHR1` has always found `chr1`; a case-sensitive glob meant `CHR1*` found
  // nothing on the same assembly. No caller wants the other behaviour, so it is
  // baked in rather than passed.
  return new RegExp(`^${escaped}$`, 'i')
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

// The part of an Assembly the search box's name matching needs, duck-typed so
// it can be tested without building one.
export interface RefNameMatchSource {
  regions?: readonly { refName: string }[]
  // canonical names AND aliases. Absent only for an unloaded assembly, whose
  // `regions` is equally absent — `setLoaded` writes both in ONE action
  allRefNames?: readonly string[]
  getCanonicalRefName: (name: string) => string | undefined
}

/**
 * How many regions an INTERACTIVE glob will open at once. Displaying a few
 * hundred whole chromosomes is ordinary — GRCh38 with its alts and decoys is
 * ~640 refNames, and showAllRegionsInAssembly lays out every one — so this sits
 * well above any real chromosome set and well below a scaffold-level assembly's
 * contig count. Past it the offer is WITHHELD, never truncated: a bulk action
 * reading "all of them" that opens the first thousand is the one behaviour not
 * worth having.
 *
 * `selectNamedRegions` itself is deliberately unbounded — see its docstring.
 * The bound belongs to the surfaces a person types at, not to the resolver a
 * session spec goes through, because only the former has a way to say "too
 * many, narrow it" and only the latter is a written-down intention.
 */
export const MAX_GLOB_REGIONS = 1000

/**
 * The canonical refNames a search-box query picks out, in ASSEMBLY order.
 *
 * Shared by the dropdown's option list and by what Enter does, which is the
 * whole point of it being one function: those two answer for the same typed
 * text, and a surface-by-surface reading of one syntax is the split this file
 * keeps being fixed for. A substring match (what the box has always done) and,
 * when the text contains `*`, an anchored glob — union, never one instead of
 * the other, since `*` is a legal refName character and a literal hit must
 * survive the pattern reading of the same text.
 *
 * Matching runs over every name the assembly answers to, aliases included, and
 * resolves hits to the canonical name — the name the view will display, and the
 * same choice `searchRefNames` makes. Emitting by walking `regions` is what
 * keeps assembly order rather than alias-file order.
 *
 * Bounded: matching stops one hit past `ceiling`, so a caller can tell "at the
 * limit" from "under it" without the scan being unbounded.
 */
export function matchRefNames(
  assembly: RefNameMatchSource | undefined,
  inputValue: string,
  ceiling: number,
): string[] {
  const regions = assembly?.regions ?? []
  const query = inputValue.toLowerCase()
  const glob = query.includes('*') ? globToRegExp(query) : undefined
  // getCanonicalRefName THROWS before aliases load, and is only ever reached
  // for a name that came out of this list, which is empty in that state
  const candidates = assembly?.allRefNames ?? []
  const hits = new Set<string>()
  for (const name of candidates) {
    if (name.toLowerCase().includes(query) || glob?.test(name)) {
      hits.add(assembly?.getCanonicalRefName(name) ?? name)
      if (hits.size > ceiling) {
        break
      }
    }
  }
  const out: string[] = []
  for (const { refName } of regions) {
    if (hits.has(refName)) {
      out.push(refName)
      // every hit is placed, so nothing later in `regions` can match
      if (out.length === hits.size) {
        break
      }
    }
  }
  return out
}
