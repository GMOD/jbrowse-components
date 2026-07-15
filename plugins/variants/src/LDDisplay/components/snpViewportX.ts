// SNP position in the LD overlay's viewport-canvas-x frame: bpToPx gives the
// absolute genome pixel, subtract the raw view.offsetPx to get viewport-relative
// (0 = view left edge). The connector lines and VariantLabels both call this so
// they can't drift — an earlier bug had the connector on raw offsetPx and the
// labels on a clamped offsetAdj, misaligning them by |offsetPx| when scrolled
// left of genome start. The `left` gap when offsetPx < 0 is carried by the
// render frame (renderTransform.viewOffsetX / the export group origin), never
// clamped here; clamping in this frame would double-count it.
interface ViewLike {
  offsetPx: number
  bpToPx: (arg: {
    refName: string
    coord: number
  }) => { offsetPx: number } | undefined
}

export function getSnpViewportX(
  view: ViewLike,
  assembly: { getCanonicalRefName2: (refName: string) => string },
  snp: { refName: string; start: number },
) {
  const abs =
    view.bpToPx({
      refName: assembly.getCanonicalRefName2(snp.refName),
      coord: snp.start,
    })?.offsetPx ?? 0
  return abs - view.offsetPx
}
