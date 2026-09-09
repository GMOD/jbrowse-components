import { defineMark } from '@jbrowse/render-core/marks'

import {
  rgb255,
  rgbaPrefix255,
} from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { shouldDrawOverlaps } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import * as overlapShader from '../../shaders/slang/overlap.generated.ts'
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
import type { PileupChannels } from '../pileupShape.ts'
import type { OverlapsUploadData } from './types.ts'

function packOverlaps(c: PileupChannels) {
  const { positions, rows, kinds, kind, end } = c
  const F_F32 = overlapShader.INSTANCE_OFFSET_F32
  const F_U32 = overlapShader.INSTANCE_OFFSET_U32
  const s32 = overlapShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(
    countMarks(c) * overlapShader.INSTANCE_STRIDE_BYTES,
  )
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let o = 0
  for (let i = c.start; i < end; i++) {
    if (markSelects(kinds, kind, i)) {
      u32[o + F_U32.startOff] = positions[i * 2]!
      u32[o + F_U32.endOff] = positions[i * 2 + 1]!
      f32[o + F_F32.y] = rows[i]!
      o += s32
    }
  }
  return buf
}

// One overlap: the interval where two features sharing a row both align, as a
// full-row bar. Twin of overlap.slang, whose `chainMode` branch says what the
// span MEANS in each of the two layouts that put more than one feature on a row
// — and the branch is only the paint, which is why the geometry here has none:
// chain mode fills the span with a theme neutral that is no read colour (both
// segments of one molecule are there, so neither segment's colour is honest),
// collapsed rows keep the stacking dark tint that makes depth readable.
//
// `Fade.overlap` reaches 0 at FADE_LO_PX, which is what makes the shape's
// sub-pixel widening unreachable here: a bar narrow enough to be widened has
// already faded out, so this mark's ink stays its true span like the shader's,
// which does not call `expandMinWidthX`.
//
// Nothing hit-tests an overlap. It covers reads, and `hitTestFeature` answers
// with one of them, which is what a person pointing at it means.
export const OVERLAP_MARK = defineMark({
  shape: pileupShape({
    id: 'overlap',
    mod: overlapShader,
    pack: packOverlaps,
    pivot: 'span',
    fade: Fade.overlap,
    hit: Hit.always,
    band: Band.row,
    // Overlaps stack on a collapsed row and never abut along one, so no seam.
    contiguous: false,
    paint: state => {
      const tint = state.chainMode
        ? state.colors.colorOverlap
        : state.colors.colorOverlapTint
      return {
        rule: Paint.palette,
        opaqueCss: [rgb255(tint)],
        fadedCss: [rgbaPrefix255(tint)],
      }
    },
  }),
  channels: (data: OverlapsUploadData): PileupChannels => ({
    positions: data.overlapPositions,
    stride: 2,
    rows: data.overlapYs,
    start: 0,
    end: data.overlapYs.length,
    kinds: undefined,
    kind: 0,
    freqs: undefined,
    quals: undefined,
    lengths: undefined,
    keys: undefined,
  }),
  params: (state: RenderState) => state,
  enabled: shouldDrawOverlaps,
})
