import type { Region } from './types/data.ts'

/**
 * `*` is the only metacharacter; everything else in a name is matched literally,
 * so a refName containing regex punctuation (`chr1.1`, `scaffold[2]`) can't turn
 * into an accidental pattern. Anchored, so a pattern names whole refNames.
 *
 * Case-INSENSITIVE, and not optionally: the literal reading beside it resolves
 * through getCanonicalRefName, which falls back to `lowerCaseRefNameAliases`, so
 * `CHR1` has always found `chr1`. A case-sensitive glob meant `CHR1*` found
 * nothing on the same assembly — literal working where pattern silently fails,
 * which is the same split the alias fix removed and is no more tellable apart
 * from "this assembly has no such contigs" here than it was there. No caller
 * wants the other behaviour, so it is baked in rather than passed.
 *
 * Module-private, and worth keeping that way: both readings of `*` — the
 * resolver's and the search box's — live in this file precisely so a pattern
 * that selects a set in a session spec selects the same set typed into the box.
 * A third caller reaching in from elsewhere is how that stops being true.
 */
function globToRegExp(pattern: string) {
  const escaped = pattern.replaceAll(/[.*+?^${}()|[\]\\]/g, m =>
    m === '*' ? '.*' : `\\${m}`,
  )
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
 * them) keeps coordinates and lengths correct.
 *
 * THERE IS DELIBERATELY NO CEILING on how many regions a glob may resolve to.
 * `["*"]` on a scaffold-level assembly really does mean every contig, which is
 * no more than `showAllRegionsInAssembly` already hands to `setDisplayedRegions`.
 * A cap here could only truncate — silently returning some of what was asked
 * for, which is the failure mode this file keeps being fixed for. The search
 * box's picker does bound its bulk-select row, and that is a different thing: it
 * withholds an OFFER, leaving every match still pickable one at a time, rather
 * than quietly resolving a list to a prefix of itself.
 *
 * BOTH READINGS GO THROUGH THE ASSEMBLY'S ALIASES, and they have to, because
 * only one of them used to. An exact name has always resolved via
 * `getCanonicalRefName`, so `['chr1']` picks out a contig an Ensembl-named
 * assembly calls `1` — but the glob was tested against `region.refName`, the
 * canonical name alone, so `['chr*']` on that same assembly matched nothing at
 * all. The literal working where the pattern silently fails is the worst
 * possible split: the caller has no way to tell "this assembly has no such
 * contigs" from "globs don't see the names you're using". Pass `allRefNames`
 * (canonical names AND aliases — `buildRefNameMaps` identity-maps every region,
 * so it is a strict superset) and a pattern sees what a literal sees.
 *
 * It is optional ONLY because this is published ABI and the three-argument form
 * predates it; an external plugin still calling that gets the canonical-only
 * matching it always got. It is not optional because there is a state where an
 * assembly has regions but not yet names — `setLoaded` writes `volatileRegions`
 * and `refNameAliases` in one action, so no such state exists, and every
 * in-tree caller (all of them through `resolveNamedRegions`) passes both.
 */
export function selectNamedRegions(
  regions: readonly Region[],
  names: readonly string[],
  getCanonicalRefName: (name: string) => string | undefined,
  allRefNames?: readonly string[],
): Region[] {
  const byRefName = new Map(regions.map(r => [r.refName, r]))
  // every name a glob may match on — see above for why the absent case is a
  // legacy call rather than an unloaded assembly
  const candidates = allRefNames?.length
    ? allRefNames
    : regions.map(r => r.refName)
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
      // Resolve every matching NAME to the region it names, then walk `regions`
      // to emit them — the two passes are what keeps a glob's contribution in
      // ASSEMBLY order. Matching over `candidates` directly would order by the
      // alias map instead, which is the order the alias file happened to list.
      const hits = new Set<string>()
      for (const candidate of candidates) {
        if (re.test(candidate)) {
          hits.add(getCanonicalRefName(candidate) ?? candidate)
        }
      }
      for (const r of regions) {
        if (hits.has(r.refName)) {
          take(r)
        }
      }
    }
  }
  return out
}

/**
 * Split a user-typed or URL-supplied region list into the entries
 * `selectNamedRegions` takes. Comma-separated, because the two things anyone
 * writes here are one glob (`*_MATERNAL`) or a short explicit list
 * (`chr1, chr2`), and neither wants punctuation ceremony. Only the comma
 * splits, so an HLA allele name — which carries both `*` and `:` — survives
 * intact.
 *
 * Whitespace-trimmed and empties dropped, so a trailing comma, a box holding
 * only spaces, and a bare `&regions=` all mean the same thing as nothing at
 * all: no restriction, whole assembly. That last one is why this lives in core
 * beside the matcher rather than next to the text box that first needed it —
 * `&regions=` was reading the same syntax through a bare `split(',')`, so
 * `&regions=chr1,%20chr2` dropped chr2 on the floor without a word and
 * `&regions=` warned that a list of one empty name had matched nothing.
 */
export function parseRegionNames(value: string) {
  return value
    .split(',')
    .map(s => s.trim())
    .filter(s => s !== '')
}

/**
 * `selectNamedRegions` plus the report a miss owes the user, which each of the
 * four views taking `displayedRegionNames` had written out for itself — and two
 * of them had not written at all, so a typo there showed the whole assembly and
 * read as the field being ignored. A typo is no longer only a hand-authored-JSON
 * mistake either: the dotplot and synteny import forms put this syntax in a text
 * box.
 *
 * `undefined` means "this list picks out nothing" — the caller's cue to apply
 * its own fallback, which is the part that genuinely differs between them: the
 * LGV keeps a defaultSession's existing navigation, the circular view and a
 * synteny row draw the whole assembly, and a dotplot axis is left as the
 * regions autorun populated it.
 */
export function resolveNamedRegions({
  regions,
  names,
  assemblyName,
  getCanonicalRefName,
  allRefNames,
  notify,
}: {
  regions: readonly Region[]
  names: readonly string[]
  assemblyName: string
  getCanonicalRefName: (name: string) => string | undefined
  // the assembly's aliases as well as its canonical names, so a glob sees what
  // a literal sees — see selectNamedRegions
  allRefNames?: readonly string[]
  notify: (message: string) => void
}): Region[] | undefined {
  const picked = selectNamedRegions(
    regions,
    names,
    getCanonicalRefName,
    allRefNames,
  )
  if (picked.length) {
    return picked
  }
  notify(
    `displayedRegionNames matched no regions in ${assemblyName}: ${names.join(', ')}`,
  )
  return undefined
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
