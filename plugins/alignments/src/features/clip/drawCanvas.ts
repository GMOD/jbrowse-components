import { rgb255, rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { paintMarks } from '../mark.ts'
import { HARDCLIP_MARK, SOFTCLIP_MARK } from './mark.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { InterbaseUploadData } from '../../shared/uploadTypes.ts'
import type { PointMark } from '../mark.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

type ColorTuple = RenderState['colors']['colorSoftclip']

function drawClipBars(
  ctx: Ctx2D,
  mark: PointMark<InterbaseUploadData>,
  region: InterbaseUploadData,
  colorTuple: ColorTuple,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const opaque = rgb255(colorTuple)
  paintMarks(
    ctx,
    mark,
    region,
    { block, bpLength, fullBlockWidth },
    state,
    alpha => (alpha >= 1 ? opaque : rgba255(colorTuple, alpha)),
  )
}

export function drawSoftclips(
  ctx: Ctx2D,
  region: InterbaseUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  drawClipBars(
    ctx,
    SOFTCLIP_MARK,
    region,
    state.colors.colorSoftclip,
    block,
    bpLength,
    fullBlockWidth,
    state,
  )
}

export function drawHardclips(
  ctx: Ctx2D,
  region: InterbaseUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  drawClipBars(
    ctx,
    HARDCLIP_MARK,
    region,
    state.colors.colorHardclip,
    block,
    bpLength,
    fullBlockWidth,
    state,
  )
}
