import type { Alias } from '../data_adapters/BaseAdapter/index.ts'

export type RefNameAliases = Record<string, string>

// The SAM spec's reference-name grammar, verbatim: printable ASCII apart from
// backslash, comma, quotes, brackets and braces, not starting with `*` or `=`
// (SAMv1 §1.2.1, https://samtools.github.io/hts-specs/SAMv1.pdf).
//
// Anchored, because the spec says names *match* this expression -- it is the
// grammar for a whole name, not something to search for inside one. Unanchored,
// `test` asked only whether a name contained one legal character anywhere, so it
// passed `chr 1`, ` chr1` and `x[bad]` and rejected only names made entirely of
// illegal characters. Note what that let through: a refName with whitespace in
// it, which is what an unindexed FASTA yields when its defline separates the id
// from the description with a tab rather than a space, and which then breaks
// every locstring and url that carries it.
//
// Anchoring rejects nothing real: measured against the chrom.sizes and
// chromAlias files of 25 UCSC/GenArk genomes (hg38, hs1, mm39, dm6, sacCer3,
// and a random sample of the rest), all 4,935,269 names pass.
/* biome-ignore lint/complexity/useRegexLiterals: keeps the character classes 1:1 with the spec, no `/` escaping */
const refNameRegex = new RegExp(
  '^[0-9A-Za-z!#$%&+./:;?@^_|~-][0-9A-Za-z!#$%&*+./:;=?@^_|~-]*$',
)

export function checkRefName(refName: string) {
  if (!refNameRegex.test(refName)) {
    throw new Error(
      `Encountered invalid refName: "${refName}". Reference names may not be empty, may not start with * or =, and may not contain whitespace, backslashes, commas, quotes, brackets or braces`,
    )
  }
}

export interface RefNameMaps {
  refNameAliases: RefNameAliases
  lowerCaseRefNameAliases: RefNameAliases
  canonicalToSeqAdapterRefNames: Record<string, string>
}

// Build the alias/name lookups used throughout the model from the sequence
// adapter's regions plus the optional refNameAliasAdapter collection.
export function buildRefNameMaps(
  regions: { refName: string }[],
  refNameAliasCollection: Alias[],
): RefNameMaps {
  const fastaRefNames = new Set(regions.map(r => r.refName))
  const refNameAliases: RefNameAliases = {}
  for (const { refName, aliases, override } of refNameAliasCollection) {
    // override:true (the default), or unset as with chromAlias files whose
    // refName column already matches the FASTA, makes the adapter's refName the
    // canonical name. override:false instead keeps the sequence adapter's own
    // name canonical, resolving it from whichever alias matches a FASTA contig.
    const canonical =
      override === false
        ? (aliases.find(a => fastaRefNames.has(a)) ?? refName)
        : refName
    for (const alias of aliases) {
      checkRefName(alias)
      refNameAliases[alias] = canonical
    }
    refNameAliases[canonical] = canonical
  }

  // identity-map each region's refName (??= so an override alias wins) and
  // record where the canonical name differs from the sequence adapter's name
  const canonicalToSeqAdapterRefNames: Record<string, string> = {}
  for (const { refName } of regions) {
    const canonical = (refNameAliases[refName] ??= refName)
    if (canonical !== refName) {
      canonicalToSeqAdapterRefNames[canonical] = refName
    }
  }

  // a lowercase index, so getCanonicalRefName can resolve a lower-case query
  const lowerCaseRefNameAliases: RefNameAliases = {}
  for (const [key, canonical] of Object.entries(refNameAliases)) {
    lowerCaseRefNameAliases[key.toLowerCase()] = canonical
  }

  return {
    refNameAliases,
    lowerCaseRefNameAliases,
    canonicalToSeqAdapterRefNames,
  }
}

/**
 * Inverts an alias map into canonical refName -> every name for that sequence,
 * the canonical name first and its aliases after it.
 *
 * The aliases come back in the alias map's own key order, which is JS object
 * key order: an integer-like name (Ensembl's `1`, `2`, `10`) sorts ahead of the
 * rest, ascending, whatever order the adapter emitted it in. The others keep
 * insertion order, which for a UCSC chromAlias is the file's column order
 * (ucsc, assembly, genbank, refseq).
 *
 * Feed it `refNameAliases`, never `lowerCaseRefNameAliases` — the latter is a
 * second index of the same names, and grouping it produces a case-variant twin
 * of every alias.
 */
export function groupNamesByCanonicalRefName(refNameAliases: RefNameAliases) {
  const groups = new Map<string, string[]>()
  for (const [name, canonical] of Object.entries(refNameAliases)) {
    const group = groups.get(canonical) ?? [canonical]
    if (name !== canonical) {
      group.push(name)
    }
    groups.set(canonical, group)
  }
  return groups
}
