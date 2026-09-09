import { defineMark } from '@jbrowse/render-core/marks'

import * as mismatchShader from '../../shaders/slang/mismatch.generated.ts'
import { buildBaseCssMap } from '../mismatch/baseColors.ts'
import { packBaseCells } from '../mismatch/mark.ts'
import { Band, Fade, Hit, Paint, pileupShape } from '../pileupShape.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { PileupChannels } from '../pileupShape.ts'
import type { PerBaseLetterUploadData } from './types.ts'

// Every aligned base in its nucleotide colour: a `cell` mark on one pileup row,
// drawn for each visible base of each read when `colorBy` is per-base lettering.
// Per-base lettering IS "draw every aligned base like a mismatch base", which is
// why it shares mismatch.slang — and why this mark is `MISMATCH_MARK`'s shape
// with the wall's seam fudge and neither of its two fades.
//
// Opaque, always: there is no frequency here — every covered base is drawn,
// which is the mode — and no quality either, so neither of the shared shader's
// fades has an input. `packBaseCells` neutralizes both from the undefined
// channels, since the shader applies them to whatever the instance carries.
//
// Nothing hit-tests these cells: they cover the read body, and `hitTestFeature`
// answers the read underneath them.
export const PER_BASE_LETTER_MARK = defineMark({
  shape: pileupShape({
    id: 'perBaseLetter',
    mod: mismatchShader,
    pack: packBaseCells,
    pivot: 'cell',
    fade: Fade.opaque,
    hit: Hit.always,
    band: Band.row,
    contiguous: true,
    // Same per-base palette as the mismatch and softclip-base draws, so the
    // Canvas2D and GPU paths render identical colors (and both mute under
    // modifications). The layer is opaque, so the faded table is unreachable.
    paint: state => ({
      rule: Paint.palette,
      opaqueCss: buildBaseCssMap(state),
      fadedCss: [],
    }),
  }),
  channels: (data: PerBaseLetterUploadData): PileupChannels => ({
    positions: data.perBaseLetterPositions,
    stride: 1,
    rows: data.perBaseLetterYs,
    start: 0,
    end: data.perBaseLetterYs.length,
    kinds: undefined,
    kind: 0,
    freqs: undefined,
    quals: undefined,
    lengths: undefined,
    keys: data.perBaseLetterBases,
  }),
  params: (state: RenderState) => state,
  enabled: s => s.showPerBaseLetter,
})
