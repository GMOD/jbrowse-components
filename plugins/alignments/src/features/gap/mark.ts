import {
  GAP_DELETION,
  GAP_SKIP,
} from '../../shaders/slang/gap.consts.generated.ts'
import { Band, Fade, Hit } from '../mark.ts'

import type { PileupMark } from '../mark.ts'
import type { GapUploadData } from './types.ts'

// One gap: a deletion bar or an intron centerline over a reference span on one
// pileup row. Twin of gap.slang, which branches on the same byte for the same
// two reasons — the band it fills and the fade it applies — where the two kinds
// are two marks here, so nothing per instance has to ask which it is.
//
// The split is a VISIBILITY decision and not a geometric one: `showMismatches`
// takes the deletion bars and leaves the intron centerlines, and the hit test
// has to answer for whichever halves are drawn. Separate marks rather than one
// drawn twice, because a pass id keys the GPU instance buffer as well as the
// pipeline: sharing one would draw every gap under both gates.
//
// A byte that is neither kind belongs to neither mark, so a third gap type added
// to the worker's array is packed by neither pass and drawn by neither painter.
// That is deliberate — see plugins/alignments/src/CLAUDE.md.
function gapChannels(data: GapUploadData, kind: number) {
  return {
    // gapPositions stores [start, end] pairs.
    positions: data.gapPositions,
    stride: 2,
    rows: data.gapYs,
    start: 0,
    end: data.gapYs.length,
    kinds: data.gapTypes,
    kind,
    freqs: data.gapFrequencies,
    quals: undefined,
    lengths: undefined,
  }
}

export const DELETION_MARK: PileupMark<GapUploadData> = {
  shape: 'span',
  channels: data => gapChannels(data, GAP_DELETION),
  fade: Fade.spanFrequencySize,
  hit: Hit.spanFrequency,
  band: Band.row,
  // Nothing abuts: a gap is a sparse mark over a read body.
  contiguous: false,
}

// An intron collapses to a 1px centerline on the row's midpoint, which is the
// band gap.slang builds from `mid ± 1/canvasH`. No clearRect under it:
// `drawReads` splits a spliced read into per-exon segments, so the intron span
// is already unpainted — and clearRect is a no-op on SvgCanvas, which left the
// read body solid under the line in vector SVG export.
//
// Ungated on the hit test: `deletionStartFrequencies` writes a hardcoded 0 into
// every SKIP slot, so running the frequency gate over it would make each
// centerline inert past 1 bp/px while gap.slang goes on drawing it.
export const SKIP_MARK: PileupMark<GapUploadData> = {
  shape: 'span',
  channels: data => gapChannels(data, GAP_SKIP),
  fade: Fade.intron,
  hit: Hit.always,
  band: Band.centerline,
  contiguous: false,
}
