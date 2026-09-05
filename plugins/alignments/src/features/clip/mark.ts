import { interbaseRangeEnds } from '../../shared/uploadTypes.ts'
import { Band, Fade, Hit, InsertionSlot, Point } from '../mark.ts'

import type { InterbaseUploadData } from '../../shared/uploadTypes.ts'
import type { PileupMark } from '../mark.ts'

// Soft and hard clips are one shader and one instance buffer with a per-instance
// kind, two colours on the canvas, and two hit scans. One mark each, the way
// gap's two layers are one array — and between them they still cover the merged
// array's clip range exactly once.
export type ClipKind = 'soft' | 'hard'

// The worker lays interbases out as (insertions, softclips, hardclips), so each
// kind is a slice. Declaring it here is also what states the priority between
// the two: softclip beats hardclip at the same row and position because that is
// the array's order, and `hitTestClip` runs the two scans in it. Fused into one
// forward loop the two rules disagreed — "topmost wins" silently became
// "whichever read comes first in the array".
export function clipMark(kind: ClipKind): PileupMark<InterbaseUploadData> {
  return {
    shape: 'point',
    channels: data => {
      const { insEnd, scEnd, hcEnd } = interbaseRangeEnds(data)
      return {
        positions: data.interbasePositions,
        stride: 1,
        rows: data.interbaseYs,
        start: kind === 'soft' ? insEnd : scEnd,
        end: kind === 'soft' ? scEnd : hcEnd,
        kinds: undefined,
        kind: 0,
        freqs: data.interbaseFrequencies,
        quals: undefined,
        lengths: undefined,
      }
    },
    // Sub-pixel frequency fade, clip.slang's. The hit gate is the same one the
    // mismatch and small-insertion tests use, off the same byte the shader fades
    // by: this test was the one mark hit-test without it, so a clip faded to the
    // noise floor still intercepted clicks that every other faded mark hands
    // back to the read body underneath.
    fade: Fade.pointFrequency,
    hit: Hit.frequency,
    band: Band.row,
    contiguous: false,
    // A clip bar's width and its tolerance are both constants, so `clipBar`
    // reads neither of the other two fields.
    point: { rule: Point.clipBar, barHeight: 0, slot: InsertionSlot.all },
  }
}

export const SOFTCLIP_MARK = clipMark('soft')
export const HARDCLIP_MARK = clipMark('hard')
