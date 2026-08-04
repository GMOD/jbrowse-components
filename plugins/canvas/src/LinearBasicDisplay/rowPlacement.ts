// The packer's "no row for this feature" sentinel and the one test for it.
//
// Its own module rather than living in layout.ts because both layout.ts and
// yMorph.ts ask the question and layout.ts already imports yMorph — putting it in
// either would close an import cycle.

// Y offset applied to features that overflow GranularRectLayout's maxHeight.
// Pushes them far above the visible area so the renderer/hit-test drops them
// instead of stacking them at y=0. Float32 handles this magnitude losslessly.
export const OFFSCREEN_Y = -1e6

// Did the packer give this feature a real row? The single test for the sentinel,
// so the half-dozen places that ask — content height, the truncated-feature
// count, label pruning, and the Y-morph captures — cannot answer it differently.
//
// A `>= 0` threshold rather than `=== OFFSCREEN_Y` equality, deliberately: a
// placed row is always at or below the stack top (>= 0), while the sentinel stays
// hugely negative through a fit scale, which only ever multiplies by a positive
// factor. So this reads correctly both PRE-scale (where the value is exactly the
// sentinel) and POST-scale (where it is the sentinel times some scale), which
// equality would not.
export function isPlacedRow(topPx: number) {
  return topPx >= 0
}
