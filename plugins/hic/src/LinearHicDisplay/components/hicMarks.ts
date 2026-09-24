import { defineMark } from '@jbrowse/render-core/marks'
import { slangPass } from '@jbrowse/render-core/slangPass'

import { drawHicBlocks } from './drawHicBlocks.ts'
import * as hicShader from './shaders/hic.generated.ts'

import type {
  HicRenderState,
  HicUploadData,
} from './hicRenderingBackendTypes.ts'
import type { MarkShape } from '@jbrowse/render-core/marks'

interface HicContactParams extends HicRenderState {
  binWidth: number
}

const contactMark: MarkShape<HicUploadData, HicContactParams> = {
  id: 'main',
  pass: {
    ...slangPass({ id: 'main', mod: hicShader }),
    // the worker packed the shader's own layout, so the pack is the identity
    pack: data => data.instances,
  },

  writeUniforms(scratch, _clip, _block, frame, p) {
    hicShader.writeUniforms(scratch, {
      canvasSize: [frame.canvasWidth, frame.canvasHeight],
      binWidth: p.binWidth,
      yScalar: p.yScalar,
      domainMin: p.domainMin,
      domainMax: p.domainMax,
      viewScale: p.viewScale,
      viewOffsetX: p.viewOffsetX,
      scaleType: p.scaleType,
    })
  },

  paintBlock(ctx, data, _block, frame, p) {
    drawHicBlocks(ctx, data, p, frame.canvasWidth)
  },
}

export const HIC_MARKS = [
  defineMark({
    shape: contactMark,
    channels: (data: HicUploadData) => data,
    params: (state: HicRenderState, data: HicUploadData) => ({
      ...state,
      binWidth: data.binWidth,
    }),
    texture: (state: HicRenderState) => state.colorRamp,
  }),
]
