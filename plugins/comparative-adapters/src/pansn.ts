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
