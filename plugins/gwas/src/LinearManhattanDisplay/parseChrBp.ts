/**
 * A `chr:bp` index SNP's contig and 1-based position, split on the last colon
 * so a refName may hold one. A bare id, a tail that is no integer, or position
 * 0 places nothing, and the SNP is matched by its id instead.
 */
export function parseChrBp(
  indexSnp: string,
): { refName: string; bp: number } | undefined {
  const colon = indexSnp.lastIndexOf(':')
  const posStr = colon > 0 ? indexSnp.slice(colon + 1) : ''
  const bp = Number(posStr)
  return /^\d+$/.test(posStr) && bp >= 1
    ? { refName: indexSnp.slice(0, colon), bp }
    : undefined
}
