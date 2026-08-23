import { passesFrequencyGate } from '../../LinearAlignmentsDisplay/constants.ts'
import {
  frequencyFade,
  intronAlpha,
  sizeAlpha,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import {
  GAP_DELETION,
  GAP_SKIP,
} from '../../shaders/slang/gap.consts.generated.ts'

import type { PileupMark } from '../mark.ts'
import type { GapUploadData } from './types.ts'

const isSkip = (data: GapUploadData, index: number) =>
  data.gapTypes[index] === GAP_SKIP

// Which kinds a consumer's mark takes out of the shared arrays. Booleans rather
// than a kind code because the split between the two gap layers is a VISIBILITY
// decision and not a geometric one: `showMismatches` takes the deletion bars and
// leaves the intron centerlines, and the hit test has to answer for whichever
// halves are drawn — `{ deletions: showMismatches, skips: true }` is that rule
// said once.
//
// It also retires an argument that could be wrong. The three consumers used to
// select on a `GapTypeCode` byte handed in from outside, so `packGapsOfType(data,
// 7)` compiled, allocated a zero-length buffer and drew nothing — silently, on
// both backends. That state is no longer spellable.
//
// The property it does NOT change: a byte that is neither kind still belongs to
// no mark, so a third gap type added to the worker's array is packed by neither
// pass and drawn by neither painter. That is deliberate and stated in `selects`
// — see plugins/alignments/src/CLAUDE.md, where it is the rule that makes
// "a mark added to that array has to pick a pass" true.
export interface GapKinds {
  deletions: boolean
  skips: boolean
}

// One gap: a deletion bar or an intron centerline over a reference span on one
// pileup row. Twin of gap.slang, which branches on the same byte for the same
// two reasons — the band it fills and the fade it applies.
export function gapMark(kinds: GapKinds): PileupMark<GapUploadData> {
  return {
    shape: 'span',
    rows: data => data.gapYs,
    // gapPositions stores [start, end] pairs, and stores the TRUE absolute start
    // rather than one clamped to the region (see `buildGapArrays`): both
    // rasterizers clip off-screen geometry, and clamping corrupted the hit-test
    // position of a gap beginning left of the view.
    startBp: (data, i) => data.gapPositions[i * 2]!,
    endBp: (data, i) => data.gapPositions[i * 2 + 1]!,
    selects: (data, i) =>
      isSkip(data, i)
        ? kinds.skips
        : data.gapTypes[i] === GAP_DELETION && kinds.deletions,
    alpha: (data, i, state, widthPx) =>
      isSkip(data, i)
        ? // Once reads get compact the per-row centerlines pack into a solid
          // smear, so they fade with the row height. gap.slang's own curve,
          // generated in.
          intronAlpha(state.featureHeight)
        : // A deletion HAS a reference span, so its own on-screen width is the
          // measure — the quantity the frequency fade squares, which is why that
          // fade takes widthPx² rather than pxPerBp². `sizeAlpha` is still
          // needed on top: the frequency lerp returns 1 for a site every read
          // carries however sub-pixel it is, so without it a chain's every D op
          // painted a full-opacity 1px bar across a megabase-wide frame.
          frequencyFade(state, widthPx * widthPx, data.gapFrequencies[i]!) *
          sizeAlpha(widthPx),
    // A skip is ungated: `deletionStartFrequencies` writes a hardcoded 0 into
    // every SKIP slot, so running the frequency gate over the whole array would
    // make each intron centerline inert past 1 bp/px while gap.slang goes on
    // drawing it.
    //
    // `bpPerPx / length` rather than a bare `bpPerPx` because the "already
    // covers a pixel" half of the gate is per-mark, and a deletion's span is not
    // one base: `bpPerPx / length <= 1` is exactly `widthPx >= 1`, the zoom at
    // which its fade resolves opaque whatever the frequency. Deletions were the
    // last mark left ungated — `hitTestClip` was fixed for the same reason — so
    // between ~1 and 25 bp/px a deletion the worker had zeroed drew at four of
    // 255 alpha and still intercepted every click across its span.
    hittable: (data, i, coords, filterByFrequency) => {
      const length = data.gapPositions[i * 2 + 1]! - data.gapPositions[i * 2]!
      return (
        isSkip(data, i) ||
        passesFrequencyGate(
          length > 0 ? coords.bpPerPx / length : coords.bpPerPx,
          data.gapFrequencies[i]!,
          filterByFrequency,
        )
      )
    },
    canvas2d: {
      // Nothing abuts: a gap is a sparse mark over a read body.
      contiguous: false,
      // An intron collapses to a 1px centerline on the row's midpoint, which is
      // the band gap.slang builds from `mid ± 1/canvasH`. No clearRect under it:
      // `drawReads` splits a spliced read into per-exon segments, so the intron
      // span is already unpainted — and clearRect is a no-op on SvgCanvas, which
      // left the read body solid under the line in vector SVG export.
      bandTop: (data, i, rowY, featureHeight) =>
        isSkip(data, i) ? rowY + featureHeight / 2 - 0.5 : rowY,
      bandHeight: (data, i, featureHeight) =>
        isSkip(data, i) ? 1 : featureHeight,
    },
  }
}

// The two draw layers, as `PILEUP_LAYERS` orders them. Separate marks rather
// than one drawn twice, because a pass id keys the GPU instance buffer as well
// as the pipeline: sharing one would draw every gap under both gates.
export const DELETION_MARK = gapMark({ deletions: true, skips: false })
export const SKIP_MARK = gapMark({ deletions: false, skips: true })
