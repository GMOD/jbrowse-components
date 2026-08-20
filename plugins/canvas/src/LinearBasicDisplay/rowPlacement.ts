// The packer's "no row for this feature" sentinel and the one test for it. Its
// own module because layout.ts and yMorph.ts both ask, and layout.ts already
// imports yMorph — either home would close an import cycle.

// Y offset for features that overflow GranularRectLayout's maxHeight, far enough
// above the visible area that the renderer and hit test drop them instead of
// stacking them at y=0. Float32 holds this magnitude losslessly.
export const OFFSCREEN_Y = -1e6

// Did the packer give this feature a real row? The single test, so content
// height, the truncated-feature count, label pruning and the Y-morph captures
// cannot answer it differently.
//
// A `>= 0` threshold rather than `=== OFFSCREEN_Y`: a placed row is always at or
// below the stack top, while the sentinel stays hugely negative through a fit
// scale, which only ever multiplies by a positive factor. So it reads correctly
// both pre-scale and post-scale, where equality would not.
export function isPlacedRow(topPx: number) {
  return topPx >= 0
}
