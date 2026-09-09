import { defineMark } from '@jbrowse/render-core/marks'

import { QUAL_UNAVAILABLE } from '../../shaders/slang/mismatch.consts.generated.ts'
import * as mismatchShader from '../../shaders/slang/mismatch.generated.ts'
import {
  Band,
  Fade,
  Hit,
  Paint,
  countMarks,
  markSelects,
  pileupShape,
} from '../pileupShape.ts'
import { buildBaseCssMap, buildBaseFadeCssMap } from './baseColors.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { CigarHitResult } from '../../shared/hitTestTypes.ts'
import type { PileupChannels } from '../pileupShape.ts'
import type { MismatchUploadData } from './types.ts'

/**
 * mismatch.slang's instance, for the three marks that share it. A mark with
 * no frequency or quality of its own packs the two fades' neutral values:
 * frequency=1 (the lerp reaches 1 at full frequency whatever the zoom, so a 0
 * left at the buffer's default fades every base to `pxPerBp`) and the
 * no-quality SENTINEL rather than the 0 the buffer starts at — 0 is a real
 * Phred score, the worst one, which `qualityFade` sends to alpha 0 and
 * `vs_main` then discards. Left at the default, the per-base letter pass drew
 * NOTHING on the GPU whenever "fade by base quality" was on, while Canvas2D
 * drew every base opaque.
 */
export function packBaseCells(c: PileupChannels) {
  const { positions, rows, kinds, kind, keys, freqs, quals, end } = c
  const F_F32 = mismatchShader.INSTANCE_OFFSET_F32
  const F_U32 = mismatchShader.INSTANCE_OFFSET_U32
  const s32 = mismatchShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(
    countMarks(c) * mismatchShader.INSTANCE_STRIDE_BYTES,
  )
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let o = 0
  for (let i = c.start; i < end; i++) {
    if (markSelects(kinds, kind, i)) {
      u32[o + F_U32.position] = positions[i]!
      u32[o + F_U32.y] = rows[i]!
      u32[o + F_U32.base] = keys![i]!
      f32[o + F_F32.frequency] = freqs === undefined ? 1 : freqs[i]! / 255
      f32[o + F_F32.qual] = quals === undefined ? QUAL_UNAVAILABLE : quals[i]!
      o += s32
    }
  }
  return buf
}

export function mismatchHit(
  data: MismatchUploadData,
  i: number,
): CigarHitResult {
  // The array's sentinel resolves to "absent" here, at the boundary where the
  // byte stops being a shader input and becomes something a person reads. Past
  // this point `qual` is a Phred score or nothing, so a hover can report Q0 —
  // a real, and notably bad, score — without the readers having to know that
  // 255 is not one.
  const qual = data.mismatchQuals[i]!
  return {
    type: 'mismatch',
    index: i,
    position: data.mismatchPositions[i]!,
    length: 1,
    base: String.fromCharCode(data.mismatchBases[i]!),
    qual: qual === QUAL_UNAVAILABLE ? undefined : qual,
  }
}

// One mismatched base: a single reference base's cell on one pileup row. The
// first `cell` mark — the pivot every 1bp-cell layer shares, which is
// deliberately NOT the span pivot the gap bars use. `makeCellLeftMapper` floors
// one-sidedly to match mismatch.slang's snapped left edge, and the cursor
// coordinate that agrees with that floor is `basePos`; see `PileupPivot`.
export const MISMATCH_MARK = defineMark({
  shape: pileupShape({
    id: 'mismatch',
    mod: mismatchShader,
    pack: packBaseCells,
    pivot: 'cell',
    fade: Fade.cellFrequencyQuality,
    hit: Hit.frequency,
    band: Band.row,
    // Mismatches are sparse and never abut, so they take no seam fudge — the
    // base WALLS (per-base quality/letter, soft-clip runs) are the layers that
    // do.
    contiguous: false,
    // N has a palette entry; any other non-A/C/G/T byte takes the fallback,
    // matching the GPU shader (mismatch.slang baseColor catch-all). Both tables
    // are indexed by the base byte itself, so the opaque case — every mismatch
    // once zoomed to base level, where both fades resolve to 1 — reads a
    // prebuilt string and only a genuinely faded one is formatted.
    paint: state => ({
      rule: Paint.palette,
      opaqueCss: buildBaseCssMap(state),
      fadedCss: buildBaseFadeCssMap(state),
    }),
  }),
  channels: (data: MismatchUploadData): PileupChannels => ({
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
    keys: data.mismatchBases,
  }),
  params: (state: RenderState) => state,
  enabled: s => s.showMismatches,
})
