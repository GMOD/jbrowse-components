import { Band, Fade, Hit } from '../mark.ts'

import type { PileupMark } from '../mark.ts'
import type { MismatchUploadData } from './types.ts'

// One mismatched base: a single reference base's cell on one pileup row. The
// first `cell` mark — the pivot every 1bp-cell layer shares, which is
// deliberately NOT the span pivot the gap bars use. `makeCellLeftMapper` floors
// one-sidedly to match mismatch.slang's snapped left edge, and the cursor
// coordinate that agrees with that floor is `basePos`; see `MarkShape`.
export const MISMATCH_MARK: PileupMark<MismatchUploadData> = {
  shape: 'cell',
  channels: data => ({
    // One base per entry by construction, which is also why the frequency gate
    // takes a bare `bpPerPx` where a deletion's takes `bpPerPx / length`.
    positions: data.mismatchPositions,
    stride: 1,
    rows: data.mismatchYs,
    start: 0,
    end: data.mismatchYs.length,
    kinds: undefined,
    kind: 0,
    freqs: data.mismatchFrequencies,
    quals: data.mismatchQuals,
    lengths: undefined,
  }),
  fade: Fade.cellFrequencyQuality,
  hit: Hit.frequency,
  band: Band.row,
  // Mismatches are sparse and never abut, so they take no seam fudge — the base
  // WALLS (per-base quality/letter, soft-clip runs) are the layers that do.
  contiguous: false,
}
