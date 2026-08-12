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
  notify,
}: {
  regions: readonly Region[]
  names: readonly string[]
  assemblyName: string
  getCanonicalRefName: (name: string) => string | undefined
  notify: (message: string) => void
}): Region[] | undefined {
  const picked = selectNamedRegions(regions, names, getCanonicalRefName)
  if (picked.length) {
    return picked
  }
  notify(
    `displayedRegionNames matched no regions in ${assemblyName}: ${names.join(', ')}`,
  )
  return undefined
}
