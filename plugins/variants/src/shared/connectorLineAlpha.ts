// The faint connector field draws one line per matrix column down to the
// column's genomic position. At a few hundred columns a fixed per-line alpha
// reads as a texture; at the ~13,000 columns an HPRC pangenome VCF puts across
// 1500px it is ~9 lines deep in every pixel, and 9 stacked draws at 0.4 alpha
// composite to 1 - 0.6^9 = 98% opaque — a solid black band that tells the reader
// nothing.
//
// So the per-line alpha is derived from how deep the lines actually stack rather
// than fixed: pick the alpha whose composite over that depth lands at
// TARGET_COMPOSITE. Sparse fields clamp to MAX_ALPHA and look exactly as they
// did. There is deliberately no floor — the formula already holds the composite
// constant as depth grows, and a floor would reintroduce saturation at the
// densest end, which is the case this exists for.
const TARGET_COMPOSITE = 0.55
const MAX_ALPHA = 0.4

/**
 * Per-line alpha for `count` connector lines spread over `spanPx` horizontal
 * pixels. `spanPx` is the field's own extent (not the view width) so a dense
 * cluster of lines in a narrow band fades like the dense thing it is.
 */
export function connectorLineAlpha(count: number, spanPx: number) {
  const depth = count / Math.max(spanPx, 1)
  const alpha = depth > 0 ? 1 - (1 - TARGET_COMPOSITE) ** (1 / depth) : MAX_ALPHA
  return Math.min(alpha, MAX_ALPHA)
}
