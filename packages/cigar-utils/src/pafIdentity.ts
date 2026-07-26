/**
 * Identity in [0,1] for one PAF row, from whichever of its tags/columns carries
 * it. Prefers the `de:f:` tag (minimap2 gap-compressed divergence) since it is
 * computed from the actual CIGAR — the same quantity rustybam's `rb stats --paf`
 * writes and SVbyEye computes per-bin. Falls back to odgi untangle's `id:f:` tag
 * (a percentage or a fraction), then to residue matches over block length.
 *
 * Lives here, in a package with no framework deps, because two independent
 * pieces of code must agree on it to the digit: the synteny adapters read it at
 * render time, and `jbrowse make-pif` writes the coarse LOD tier's `de:f:` as
 * `1 - pafIdentity(row)`. If the two chains diverge on any rung, identity
 * coloring jumps at the zoom where the view switches tiers — which is exactly
 * what happened when make-pif's copy skipped the `id:f:` rung.
 */
export function pafIdentity(row: {
  de?: string | number
  id?: string | number
  numMatches?: string | number
  blockLen?: string | number
}) {
  if (row.de !== undefined) {
    const d = +row.de
    if (Number.isFinite(d) && d >= 0 && d <= 1) {
      return 1 - d
    }
  }
  if (row.id !== undefined) {
    const v = +row.id
    if (Number.isFinite(v)) {
      return v > 1 ? v / 100 : v
    }
  }
  const matches = +(row.numMatches ?? 0)
  const blockLen = +(row.blockLen ?? 0)
  return blockLen > 0 ? matches / blockLen : 0
}
