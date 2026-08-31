import {
  overlapAlpha,
  overlapFade,
} from '../../shaders/slang/overlap.js.generated.ts'

import type { SpanMark } from '../mark.ts'
import type { OverlapsUploadData } from './types.ts'

// One overlap: the interval where two features sharing a row both align, as a
// full-row bar. Twin of overlap.slang, whose `chainMode` branch says what the
// span MEANS in each of the two layouts that put more than one feature on a row
// — and the branch is only the paint, which is why the geometry here has none.
export const OVERLAP_MARK: SpanMark<OverlapsUploadData> = {
  shape: 'span',
  rows: data => data.overlapYs,
  // overlapPositions stores [start, end] pairs
  startBp: (data, i) => data.overlapPositions[i * 2]!,
  endBp: (data, i) => data.overlapPositions[i * 2 + 1]!,
  selects: () => true,
  // One fade, scaled: chain mode spends it as the opacity of an opaque fill so a
  // narrow overlap fades in rather than popping, collapsed rows spend it on the
  // stacking tint. overlap.slang's own smoothstep, generated in (adr-051).
  //
  // It reaches 0 at FADE_LO_PX, which is what makes `paintMarks`'s sub-pixel
  // widening unreachable here: a bar narrow enough to be widened has already
  // faded out, so this mark's ink stays its true span like the shader's, which
  // does not call `expandMinWidthX`.
  alpha: (_data, _i, state, widthPx) =>
    state.chainMode ? overlapFade(widthPx) : overlapAlpha(widthPx),
  // Nothing hit-tests an overlap. It covers reads, and `hitTestFeature` answers
  // with one of them, which is what a person pointing at it means.
  hittable: () => true,
  canvas2d: {
    // Overlaps stack on a collapsed row and never abut along one, so no seam.
    contiguous: false,
    bandTop: (_data, _i, rowY) => rowY,
    bandHeight: (_data, _i, featureHeight) => featureHeight,
  },
}
