import { defineMark } from '@jbrowse/render-core/marks'

import * as packedColorQuadShader from '../../shaders/slang/packedColorQuad.generated.ts'
import {
  Band,
  Fade,
  Hit,
  Paint,
  countMarks,
  markSelects,
  pileupShape,
} from '../pileupShape.ts'
import { qualityAbgr, qualityCssColors } from './colors.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { PileupChannels } from '../pileupShape.ts'
import type { PerBaseQualityUploadData } from './types.ts'

/**
 * packedColorQuad.slang's instance: a position, a row and the colour itself,
 * resolved from `keys` through `colorOf` — the quality ramp for one mark, the
 * worker's own packed ABGR (the identity) for the other.
 */
export function packColorCells(
  c: PileupChannels,
  colorOf: (key: number) => number,
) {
  const { positions, rows, kinds, kind, keys, end } = c
  const F_U32 = packedColorQuadShader.INSTANCE_OFFSET_U32
  const s32 = packedColorQuadShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(
    countMarks(c) * packedColorQuadShader.INSTANCE_STRIDE_BYTES,
  )
  const u32 = new Uint32Array(buf)
  let o = 0
  for (let i = c.start; i < end; i++) {
    if (markSelects(kinds, kind, i)) {
      u32[o + F_U32.position] = positions[i]!
      u32[o + F_U32.y] = rows[i]!
      u32[o + F_U32.packedColor] = colorOf(keys![i]!)
      o += s32
    }
  }
  return buf
}

// One aligned base, coloured by its Phred score: a `cell` mark on one pileup
// row, drawn for every visible base of every read when `colorBy` is
// per-base-quality. Same pivot as `MISMATCH_MARK` and the same reason for it,
// with the seam fudge on, because this layer paints an unbroken wall.
//
// Opaque on both backends: `packedColorQuad.slang` has no fade of any kind and
// the ramp packs alpha 255 into every entry. The score is carried in the COLOUR,
// not in the alpha — a low-quality base goes red rather than faint, which is the
// whole point of the ramp. The ramp `qualityCssColors` is built from is what the
// packer reads, so the fill and the vertex buffer cannot carry different colours
// for one score.
//
// Nothing hit-tests these cells: they cover the read body, and `hitTestFeature`
// answers the read underneath them.
export const PER_BASE_QUALITY_MARK = defineMark({
  shape: pileupShape({
    id: 'perBaseQuality',
    mod: packedColorQuadShader,
    pack: c => packColorCells(c, score => qualityAbgr[score]!),
    pivot: 'cell',
    fade: Fade.opaque,
    hit: Hit.always,
    band: Band.row,
    contiguous: true,
    // Prebuilt per score, never formatted per base: this is one cell per
    // aligned base of every read on screen, and the layer is opaque, so the
    // faded table is unreachable.
    paint: () => ({
      rule: Paint.palette,
      opaqueCss: qualityCssColors,
      fadedCss: [],
    }),
  }),
  channels: (data: PerBaseQualityUploadData): PileupChannels => ({
    positions: data.perBaseQualPositions,
    stride: 1,
    rows: data.perBaseQualYs,
    start: 0,
    end: data.perBaseQualYs.length,
    kinds: undefined,
    kind: 0,
    freqs: undefined,
    quals: undefined,
    lengths: undefined,
    keys: data.perBaseQualScores,
  }),
  params: (state: RenderState) => state,
  enabled: s => s.showPerBaseQuality,
})
