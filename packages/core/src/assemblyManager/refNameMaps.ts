import type { Alias } from '../data_adapters/BaseAdapter/index.ts'

export type RefNameAliases = Record<string, string>

/* biome-ignore lint/complexity/useRegexLiterals: */
const refNameRegex = new RegExp(
  '[0-9A-Za-z!#$%&+./:;?@^_|~-][0-9A-Za-z!#$%&*+./:;=?@^_|~-]*',
)

// Valid refName pattern from https://samtools.github.io/hts-specs/SAMv1.pdf
export function checkRefName(refName: string) {
  if (!refNameRegex.test(refName)) {
    throw new Error(`Encountered invalid refName: "${refName}"`)
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
