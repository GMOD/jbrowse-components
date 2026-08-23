import { passesFrequencyGate } from '../../LinearAlignmentsDisplay/constants.ts'
import { frequencyFade } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { qualityFade } from '../../shaders/slang/mismatch.js.generated.ts'

import type { PileupMark } from '../mark.ts'
import type { MismatchUploadData } from './types.ts'

// One mismatched base: a single reference base's cell on one pileup row. The
// first `cell` mark — the pivot every 1bp-cell layer shares, which is
// deliberately NOT the span pivot the gap bars use. `makeCellLeftMapper` floors
// one-sidedly to match mismatch.slang's snapped left edge, and the cursor
// coordinate that agrees with that floor is `basePos`; see `MarkShape`.
export const MISMATCH_MARK: PileupMark<MismatchUploadData> = {
  shape: 'cell',
  rows: data => data.mismatchYs,
  startBp: (data, i) => data.mismatchPositions[i]!,
  // One base by construction, which is also why the frequency gate below takes
  // a bare `bpPerPx` where a deletion's takes `bpPerPx / length`.
  endBp: (data, i) => data.mismatchPositions[i]! + 1,
  selects: () => true,
  alpha: (data, i, state, widthPx) =>
    frequencyFade(state, widthPx, data.mismatchFrequencies[i]!) *
    // Phred 50+ opaque, lower fades out, and QUAL_UNAVAILABLE (the read reports
    // none) stays opaque. Phred 0 is a score and fades all the way — it used to
    // share the sentinel's value. mismatch.slang's own ramp, generated in.
    qualityFade(data.mismatchQuals[i]!, state.mismatchAlpha),
  hittable: (data, i, coords, filterByFrequency) =>
    passesFrequencyGate(
      coords.bpPerPx,
      data.mismatchFrequencies[i]!,
      filterByFrequency,
    ),
  canvas2d: {
    // Mismatches are sparse and never abut, so they take no seam fudge — the
    // base WALLS (per-base quality/letter, soft-clip runs) are the layers that
    // do.
    contiguous: false,
    bandTop: (_data, _i, rowY) => rowY,
    bandHeight: (_data, _i, featureHeight) => featureHeight,
  },
}
