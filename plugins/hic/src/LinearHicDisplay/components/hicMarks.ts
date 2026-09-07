import { defineMark } from '@jbrowse/render-core/marks'
import { slangPass } from '@jbrowse/render-core/slangPass'

import { generateColorRamp, makeHicFillStyleLut } from './colorRamp.ts'
import { drawHicBlocks } from './drawHicBlocks.ts'
import * as hicShader from './shaders/hic.generated.ts'

import type {
  HicDrawState,
  HicRenderState,
  HicUploadData,
} from './hicRenderingBackendTypes.ts'
import type { MarkShape } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

interface HicContactParams extends HicDrawState {
  binWidth: number
  colorRamp: Uint8Array
}

/**
 * The whole canvas as one block. HiC's x axis is not bp — a bin's screen x is
 * the diagonal transform over `viewScale`/`viewOffsetX`, which the shader and
 * the painter both apply themselves — so the block carries nothing but the
 * clip, and its bp span is the identity map that keeps that clip well-formed.
 */
export function hicMarkBlocks(canvasWidth: number): RenderBlock[] {
  return [
    {
      displayedRegionIndex: 0,
      start: 0,
      end: canvasWidth,
      screenStartPx: 0,
      screenEndPx: canvasWidth,
      reversed: false,
    },
  ]
}

const contactMark: MarkShape<HicUploadData, HicContactParams> = {
  id: 'main',
  pass: {
    ...slangPass({ id: 'main', mod: hicShader }),
    // Zero-copy: the worker already packed this in the shader's own instance
    // layout (`HicDataResult.instances`), so the pack is the identity and the
    // count `uploadPass` derives off the bytes is `numContacts`. The
    // O(numContacts) main-thread interleave this replaced cost a full rebuild
    // and 12 bytes per contact on every fetch.
    pack: data => data.instances,
  },

  writeUniforms(scratch, _clip, _block, frame, p) {
    hicShader.writeUniforms(scratch, {
      canvasSize: [frame.canvasWidth, frame.canvasHeight],
      binWidth: p.binWidth,
      yScalar: p.yScalar,
      colorMaxScore: p.colorMaxScore,
      viewScale: p.viewScale,
      viewOffsetX: p.viewOffsetX,
      useLogScale: p.useLogScale ? 1 : 0,
    })
  },

  paintBlock(ctx, data, _block, frame, p) {
    drawHicBlocks(
      ctx,
      data,
      makeHicFillStyleLut(p.colorRamp),
      p,
      frame.canvasWidth,
    )
  },
}

export const HIC_MARKS = [
  defineMark({
    shape: contactMark,
    channels: (data: HicUploadData) => data,
    params: (state: HicRenderState, data: HicUploadData) => ({
      binWidth: data.binWidth,
      yScalar: state.yScalar,
      colorMaxScore: state.colorMaxScore,
      useLogScale: state.useLogScale,
      viewScale: state.viewScale,
      viewOffsetX: state.viewOffsetX,
      colorRamp: generateColorRamp(state.colorScheme),
    }),
    // The scheme's table is module-level and handed back by identity, so the
    // backend re-uploads the 256×1 texture only when the user picks another
    // scheme — the second upload cell this replaced.
    texture: (state: HicRenderState) => generateColorRamp(state.colorScheme),
  }),
]
