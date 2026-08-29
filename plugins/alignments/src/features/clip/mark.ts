import { passesFrequencyGate } from '../../LinearAlignmentsDisplay/constants.ts'
import { frequencyFade } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { interbaseRangeEnds } from '../../shared/uploadTypes.ts'

import type { InterbaseUploadData } from '../../shared/uploadTypes.ts'
import type { PointMark } from '../mark.ts'

// Soft and hard clips are one shader and one instance buffer with a per-instance
// kind, two colours on the canvas, and two hit scans. One mark each, the way
// gap's two layers are one array — and between them they still cover the
// merged array's clip range exactly once.
export type ClipKind = 'soft' | 'hard'

// A clip bar is a fixed 1px whatever the zoom: the mark it makes is that an
// alignment ends here, which has no width to be proportional to.
const CLIP_BAR_WIDTH_PX = 1

// The clip hit rule, and NOT a width derivation — a 1px bar plus the point
// shape's usual slop would be 2.5px, and this is 3px with a 0.5bp floor under
// it. The floor is what keeps a clip clickable at base-level zoom, where 3px is
// a third of a base.
const CLIP_HIT_TOLERANCE_PX = 3
const CLIP_HIT_MIN_TOLERANCE_BP = 0.5

export function clipMark(kind: ClipKind): PointMark<InterbaseUploadData> {
  return {
    shape: 'point',
    rows: data => data.interbaseYs,
    // The worker lays interbases out as (insertions, softclips, hardclips), so
    // each kind is a slice. Declaring it here is also what states the priority
    // between the two: softclip beats hardclip at the same row and position
    // because that is the array's order, and `hitTestClip` runs the two scans in
    // it. Fused into one forward loop the two rules disagreed — "topmost wins"
    // silently became "whichever read comes first in the array".
    rangeStart: data =>
      kind === 'soft'
        ? interbaseRangeEnds(data).insEnd
        : interbaseRangeEnds(data).scEnd,
    rangeEnd: data =>
      kind === 'soft'
        ? interbaseRangeEnds(data).scEnd
        : interbaseRangeEnds(data).hcEnd,
    startBp: (data, i) => data.interbasePositions[i]!,
    selects: () => true,
    widthPx: () => CLIP_BAR_WIDTH_PX,
    // Sub-pixel frequency fade, clip.slang's.
    alpha: (data, i, state, _widthPx, pxPerBp) =>
      frequencyFade(state, pxPerBp, data.interbaseFrequencies[i]!),
    // The same significance gate as the mismatch and small-insertion tests, off
    // the same byte the shader fades by. This test was the one mark hit-test
    // without it, so a clip faded to the noise floor still intercepted clicks
    // that every other faded mark hands back to the read body underneath.
    hittable: (data, i, coords, filterByFrequency) =>
      passesFrequencyGate(
        coords.bpPerPx,
        data.interbaseFrequencies[i]!,
        filterByFrequency,
      ),
    hitToleranceBp: (_data, _i, coords) =>
      Math.max(
        CLIP_HIT_MIN_TOLERANCE_BP,
        coords.bpPerPx * CLIP_HIT_TOLERANCE_PX,
      ),
    canvas2d: {
      contiguous: false,
      bandTop: (_data, _i, rowY) => rowY,
      bandHeight: (_data, _i, featureHeight) => featureHeight,
    },
  }
}

export const SOFTCLIP_MARK = clipMark('soft')
export const HARDCLIP_MARK = clipMark('hard')
