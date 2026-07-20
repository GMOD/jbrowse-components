// Parse a `chr:bp` index-SNP locus into its reference name and 1-based position
// (PLINK BP convention). The refName may itself contain colons, so we split on
// the *last* colon and require the tail to be a bare integer — a trailing-colon
// id ("chr2:"), an exponential ("chr2:1e3"), or a bare rsID (no colon) all
// return undefined, meaning "not a placeable locus, match by name instead".
// Single source of truth for the two consumers (the worker's region-rename in
// GetManhattanData and the off-screen test in isIndexSnpOffscreen) so their
// parse rules can't drift.
export function parseChrBp(
  indexSnp: string,
): { refName: string; bp: number } | undefined {
  const colon = indexSnp.lastIndexOf(':')
  const posStr = colon > 0 ? indexSnp.slice(colon + 1) : ''
  return /^\d+$/.test(posStr)
    ? { refName: indexSnp.slice(0, colon), bp: Number(posStr) }
    : undefined
}
