import { defineMark } from '@jbrowse/render-core/marks'

import {
  rgb255,
  rgba255,
  rgbaPrefix255,
} from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  GAP_DELETION,
  GAP_SKIP,
} from '../../shaders/slang/gap.consts.generated.ts'
import * as gapShader from '../../shaders/slang/gap.generated.ts'
import {
  Band,
  Fade,
  Hit,
  Paint,
  countMarks,
  markSelects,
  pileupShape,
} from '../pileupShape.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { CigarHitResult } from '../../shared/hitTestTypes.ts'
import type { PileupChannels } from '../pileupShape.ts'
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
function gapChannels(data: GapUploadData, kind: number): PileupChannels {
  return {
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
    keys: undefined,
  }
}

export function packGaps(c: PileupChannels) {
  const { positions, rows, kinds, kind, freqs, end } = c
  const F_F32 = gapShader.INSTANCE_OFFSET_F32
  const F_U32 = gapShader.INSTANCE_OFFSET_U32
  const s32 = gapShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(countMarks(c) * gapShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let o = 0
  for (let i = c.start; i < end; i++) {
    if (markSelects(kinds, kind, i)) {
      u32[o + F_U32.startOff] = positions[i * 2]!
      u32[o + F_U32.endOff] = positions[i * 2 + 1]!
      u32[o + F_U32.y] = rows[i]!
      // The shader still branches on it: one `.slang` serves both passes, so
      // the attribute conveys which branch even though it is constant per
      // buffer.
      u32[o + F_U32.gapType] = kinds![i]!
      f32[o + F_F32.frequency] = freqs![i]! / 255
      o += s32
    }
  }
  return buf
}

export function gapHit(data: GapUploadData, i: number): CigarHitResult {
  return {
    type: data.gapTypes[i] === GAP_SKIP ? 'skip' : 'deletion',
    index: i,
    position: data.gapPositions[i * 2]!,
    length: data.gapPositions[i * 2 + 1]! - data.gapPositions[i * 2]!,
  }
}

const params = (state: RenderState) => state

export const DELETION_MARK = defineMark({
  shape: pileupShape({
    id: 'deletion',
    mod: gapShader,
    pack: packGaps,
    pivot: 'span',
    fade: Fade.spanFrequencySize,
    hit: Hit.spanFrequency,
    band: Band.row,
    // Nothing abuts: a gap is a sparse mark over a read body.
    contiguous: false,
    paint: state => ({
      rule: Paint.palette,
      opaqueCss: [rgb255(state.colors.colorDeletion)],
      fadedCss: [rgbaPrefix255(state.colors.colorDeletion)],
    }),
  }),
  channels: (data: GapUploadData) => gapChannels(data, GAP_DELETION),
  params,
  // A deletion bar is a DIFFERENCE from the reference, and the read body paints
  // straight through the span either way — reads are split at N gaps only — so
  // dropping it understates the read rather than dismembering it, which is what
  // "show mismatches" off asks for.
  enabled: s => s.showMismatches,
})

// An intron collapses to a 1px centerline on the row's midpoint, which is the
// band gap.slang builds from `mid ± 1/canvasH`. No clearRect under it:
// the read mark splits a spliced read into per-exon segments, so the intron span
// is already unpainted — and clearRect is a no-op on SvgCanvas, which left the
// read body solid under the line in vector SVG export.
//
// Ungated: an intron centerline is STRUCTURE. `buildSegmentArrays` splits a
// spliced read into per-exon segments, so the line is what says those blocks
// are one read, and without it a spliced read draws as N unrelated ones. Its
// hit test is ungated too — `deletionStartFrequencies` writes a hardcoded 0
// into every SKIP slot, so a frequency gate over it would make each centerline
// inert past 1 bp/px while gap.slang goes on drawing it.
export const SKIP_MARK = defineMark({
  shape: pileupShape({
    id: 'skip',
    mod: gapShader,
    pack: packGaps,
    pivot: 'span',
    fade: Fade.intron,
    hit: Hit.always,
    band: Band.centerline,
    contiguous: false,
    // An intron's alpha is a function of row height alone, so the painter
    // resolves one string for the whole pass out of these two.
    paint: state => ({
      rule: Paint.palette,
      opaqueCss: [rgba255(state.colors.colorSkip, 1)],
      fadedCss: [rgbaPrefix255(state.colors.colorSkip)],
    }),
  }),
  channels: (data: GapUploadData) => gapChannels(data, GAP_SKIP),
  params,
})
