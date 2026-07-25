// PanSN naming convention: `sample#haplotype#contig`. Shared by the all-vs-all
// PAF adapters (in-memory and tabix-indexed), which anchor on the sample prefix
// and strip it to recover each assembly's own refName.
const SEP = '#'

// The PanSN sample name is the token before the first separator, e.g.
// `grape#1#chr1` -> `grape`.
export function panSNSample(refName: string) {
  return refName.split(SEP)[0]!
}

// Strip the PanSN prefix to recover the assembly's own refName: `sample#hap#chr1`
// -> `chr1`, `sample#chr1` -> `chr1`. A contig that itself contains the
// separator is assumed not to occur (PanSN uses `#` only as the delimiter).
export function panSNContig(refName: string) {
  const parts = refName.split(SEP)
  return parts.length >= 3
    ? parts.slice(2).join(SEP)
    : parts.length === 2
      ? parts[1]!
      : refName
}

// Every prefix a PanSN name is addressable by, coarsest first: the sample, then
// sample#haplotype when the name carries one. A JBrowse assembly usually maps to
// the sample (`grape` covers `grape#1#chr1` and `grape#2#chr1` alike), but a
// haplotype-resolved pangenome loads each haplotype as its own assembly, which
// needs `grape#1`. Both are just prefixes of the same name, so indexing under
// each one lets a lookup resolve at whichever depth the config named — without
// the caller knowing which depth that is.
export function panSNPrefixes(refName: string) {
  const parts = refName.split(SEP)
  return parts.length >= 3
    ? [parts[0]!, `${parts[0]}${SEP}${parts[1]}`]
    : [parts[0]!]
}

// Whether a PanSN name belongs to a prefix, at either depth: `grape#1#chr1`
// matches `grape` and `grape#1`, but not `grape#2` or `grapefruit`. The
// separator is part of the test so a prefix can't match a longer sample name.
// A name with no separator at all matches only itself, preserving the behavior
// of the sample-equality test this replaced for non-PanSN files. An undefined
// prefix is "no assembly supplied", which nothing belongs to — total so callers
// with an optional anchor need no separate guard.
export function panSNMatchesPrefix(
  refName: string,
  prefix: string | undefined,
) {
  return (
    prefix !== undefined &&
    (refName === prefix || refName.startsWith(prefix + SEP))
  )
}
