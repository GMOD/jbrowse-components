// Genomic x of a locus in the connector overlays' frame: bpToPx gives the
// absolute genome pixel, subtract the raw view.offsetPx for viewport-relative
// (0 = the view's left edge). The LD and matrix connector lines, ticks, and
// labels all go through this so they can't drift — an earlier bug had the LD
// connector on raw offsetPx and its labels on a clamped offsetAdj, misaligning
// them by |offsetPx| when scrolled left of genome start. The gap when
// offsetPx < 0 belongs to the frame (LD's viewTransform.viewOffsetX, the
// matrix's column origin), never clamped here; clamping would double-count it.
interface ViewLike {
  offsetPx: number
  bpToPx: (arg: {
    refName: string
    coord: number
  }) => { offsetPx: number } | undefined
}

/**
 * Returns undefined when the locus has no on-screen x at all — its refName
 * isn't among the view's displayed regions, e.g. the regions changed before a
 * refetch landed. Callers drop that line instead of pinning it to x=0.
 */
export function genomicViewportX(
  view: ViewLike,
  assembly: { getCanonicalRefName2: (refName: string) => string },
  refName: string,
  coord: number,
) {
  const pos = view.bpToPx({
    refName: assembly.getCanonicalRefName2(refName),
    coord,
  })
  return pos === undefined ? undefined : pos.offsetPx - view.offsetPx
}
