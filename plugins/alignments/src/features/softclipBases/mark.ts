import { defineMark } from '@jbrowse/render-core/marks'

import * as mismatchShader from '../../shaders/slang/mismatch.generated.ts'
import { buildBaseCssMap } from '../mismatch/baseColors.ts'
import { packBaseCells } from '../mismatch/mark.ts'
import { Band, Fade, Hit, Paint, pileupShape } from '../pileupShape.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { PileupChannels } from '../pileupShape.ts'
import type { SoftclipBasesUploadData } from './types.ts'

// One clipped base of a read's unaligned tail: a `cell` mark on the read's own
// pileup row. Shares mismatch.slang's geometry and colour lookup, so it shares
// `MISMATCH_MARK`'s pivot too — with the wall's seam fudge, because a clipped
// run is contiguous, and with neither of that shader's two fades.
//
// A clipped base has no frequency and no quality, so `packBaseCells` packs the
// two neutral values. Hittable at every zoom with no significance gate: nothing
// fades these, so there is no faded mark to hand back to the read underneath.
//
// `softclipBasePositions` is empty unless `showSoftClipping` is on (the worker
// builds it from `showSoftClipping ? softclips : []`), so the gate here is the
// same setting stated at the draw.
export const SOFTCLIP_BASES_MARK = defineMark({
  shape: pileupShape({
    id: 'softclipBases',
    mod: mismatchShader,
    pack: packBaseCells,
    pivot: 'cell',
    fade: Fade.opaque,
    hit: Hit.always,
    band: Band.row,
    contiguous: true,
    // N has a palette entry; any other non-A/C/G/T byte takes the table's
    // pre-filled fallback, matching the GPU shader (mismatch.slang baseColor
    // catch-all) and the mismatch draw — including its mute under
    // showModifications.
    paint: state => ({
      rule: Paint.palette,
      opaqueCss: buildBaseCssMap(state),
      fadedCss: [],
    }),
  }),
  channels: (data: SoftclipBasesUploadData): PileupChannels => ({
    positions: data.softclipBasePositions,
    stride: 1,
    rows: data.softclipBaseYs,
    start: 0,
    end: data.softclipBaseYs.length,
    kinds: undefined,
    kind: 0,
    freqs: undefined,
    quals: undefined,
    lengths: undefined,
    keys: data.softclipBaseBases,
  }),
  params: (state: RenderState) => state,
  enabled: s => s.showSoftClipping,
})
