import { bpRangeXTuple } from '../blockClipUtils.ts'
import { getDpr, makeBpMapper } from '../canvas2dUtils.ts'
import { makeScoreNormalizer, scaleTypeCode } from '../scoreScale.ts'
import {
  GAP_Y,
  LINE_CENTER,
  LINE_STEP,
  NO_PREV_X,
  STEP_LINE_VERTS,
} from '../shaders/lineMark.consts.generated.ts'
import * as shader from '../shaders/lineMark.generated.ts'
import { slangPass } from '../slangPass.ts'
import { abgrToCssRgba } from './colorFill.ts'
import { colorBits, paintColors, rampUniforms } from './markRamp.ts'
import { bandHeightPx, rowLane } from './rowLane.ts'

import type { RenderBlock } from '../renderBlock.ts'
import type { ColorChannel } from './markRamp.ts'
import type { RowChannel, RowParams } from './rowLane.ts'
import type {
  MarkContext2D,
  MarkFrame,
  MarkRamp,
  MarkShape,
  MarkValueScaleType,
} from './types.ts'

/**
 * The `line` shape's channels: a stroke through consecutive instances of a
 * row, in the order given, each instance a span from `x` to `x2` at `y` on the
 * value scale. `gapBp` is the centre variant's break: a midpoint further than
 * that from the previous one starts a new run. It rides with the data, as the
 * neighbour fields the packer derives from it do, so both backends break in
 * the same place.
 */
export interface LineChannels extends ColorChannel, RowChannel {
  x: Uint32Array
  x2: Uint32Array
  y: Float32Array
  gapBp?: number
  count: number
}

export interface LineParams extends RowParams {
  /** `[min, max]` `y` and `origin` are read through. */
  domain: [number, number]
  /** How that domain is read; linear when absent. */
  scaleType?: MarkValueScaleType
  /** The quantitative colour scale, for a line whose colour is a ramp. */
  ramp?: MarkRamp
  /** The value a step line drops to across a gap. */
  origin: number
  /** Stroke width in CSS px. */
  lineWidth: number
}

// The step and centre neighbour fields both, so one buffer serves either pass.
// A step joins an instance to a neighbour whose span abuts it on the same row;
// a centre run links an instance to the previous one on its row within
// `gapBp` of it.
function packLine(c: LineChannels) {
  const { x, x2, y, count } = c
  const row = rowLane(c.row, count)
  const color = colorBits(c)
  const gapBp = c.gapBp ?? Number.POSITIVE_INFINITY
  const buf = new ArrayBuffer(count * shader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let off = 0
  for (let i = 0; i < count; i++) {
    const start = x[i]!
    const end = x2[i]!
    const sameRowBefore = i > 0 && row[i - 1] === row[i]
    const sameRowAfter = i < count - 1 && row[i + 1] === row[i]
    u32[off + shader.INSTANCE_OFFSET_U32.x] = start
    u32[off + shader.INSTANCE_OFFSET_U32.x2] = end
    f32[off + shader.INSTANCE_OFFSET_F32.y] = y[i]!
    u32[off + shader.INSTANCE_OFFSET_U32.color] = color[i]!
    u32[off + shader.INSTANCE_OFFSET_U32.row] = row[i]!
    f32[off + shader.INSTANCE_OFFSET_F32.prevY] =
      sameRowBefore && x2[i - 1] === start ? y[i - 1]! : GAP_Y
    // a joined next collapses the third quad onto the corner the next
    // instance's first quad draws, so the seam is stroked once
    f32[off + shader.INSTANCE_OFFSET_F32.nextY] =
      sameRowAfter && x[i + 1] === end ? y[i]! : GAP_Y
    const linked =
      sameRowBefore && (start + end) / 2 - (x[i - 1]! + x2[i - 1]!) / 2 <= gapBp
    u32[off + shader.INSTANCE_OFFSET_U32.prevX] = linked ? x[i - 1]! : NO_PREV_X
    u32[off + shader.INSTANCE_OFFSET_U32.prevX2] = linked ? x2[i - 1]! : 0
    f32[off + shader.INSTANCE_OFFSET_F32.prevYLine] = linked ? y[i - 1]! : 0
    off += shader.INSTANCE_STRIDE_WORDS
  }
  return buf
}

function writeLineUniforms(
  variant: number,
): MarkShape<LineChannels, LineParams>['writeUniforms'] {
  return (scratch, clip, block, frame, params) => {
    shader.writeUniforms(scratch, {
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      canvasHeight: frame.canvasHeight,
      domainMin: params.domain[0],
      domainMax: params.domain[1],
      valueScaleType: scaleTypeCode(params.scaleType),
      ...rampUniforms(params.ramp),
      rowHeight: bandHeightPx(params, frame.canvasHeight),
      origin: params.origin,
      lineWidth: params.lineWidth,
      variant,
      zero: 0,
      viewportWidth: clip.scissorW,
      devicePixelRatio: getDpr(),
    })
  }
}

// The value scale hoisted per block, as `valueToYPxScaled` reads it per
// instance on the GPU: one normalizer over the domain, the band's height and,
// where the instances carry rows, the band each stands in.
interface LineFrame {
  bpToPx: (bp: number) => number
  band: number
  normalize: (value: number) => number
  originY: number
}

function lineFrame(
  block: RenderBlock,
  frame: MarkFrame,
  params: LineParams,
): LineFrame {
  const band = bandHeightPx(params, frame.canvasHeight)
  const normalize = makeScoreNormalizer(
    params.domain[0],
    params.domain[1],
    scaleTypeCode(params.scaleType),
    1,
  )
  return {
    bpToPx: makeBpMapper(block),
    band,
    normalize,
    originY: (1 - normalize(params.origin)) * band,
  }
}

// A colour change ends the stroke batch and reopens it from the pen, so a
// segment carries the colour of the instance it belongs to, as the shader's
// per-instance colour does.
function restroke(
  ctx: MarkContext2D,
  abgr: number,
  inRun: boolean,
  penX: number,
  penY: number,
) {
  ctx.stroke()
  ctx.beginPath()
  if (inRun) {
    ctx.moveTo(penX, penY)
  }
  ctx.strokeStyle = abgrToCssRgba(abgr)
}

// One polyline per run of abutting instances on a row: a rise from the origin,
// the tops, the step at each joint, and a drop to the origin at a gap. The
// frame's fields are locals inside the loop, since a returned object is
// reloaded field by field per instance (benches/placeWalkers.bench.ts).
function paintStep(
  ctx: MarkContext2D,
  c: LineChannels,
  block: RenderBlock,
  frame: MarkFrame,
  params: LineParams,
) {
  const { x, x2, y, row, count } = c
  if (count === 0) {
    return
  }
  const color = paintColors(c, count, params.ramp)
  const { bpToPx, band, normalize, originY } = lineFrame(block, frame, params)
  ctx.lineWidth = params.lineWidth
  ctx.strokeStyle = abgrToCssRgba(color[0]!)
  ctx.beginPath()
  let lastAbgr = color[0]!
  let inRun = false
  let penX = 0
  let penY = 0
  for (let i = 0; i < count; i++) {
    const bandTop = row === undefined ? 0 : band * row[i]!
    const x1 = bpToPx(x[i]!)
    const xb = bpToPx(x2[i]!)
    const top = bandTop + (1 - normalize(y[i]!)) * band
    const abgr = color[i]!
    if (abgr !== lastAbgr) {
      restroke(ctx, abgr, inRun, penX, penY)
      lastAbgr = abgr
    }
    if (inRun) {
      ctx.lineTo(x1, top)
    } else {
      ctx.moveTo(x1, bandTop + originY)
      ctx.lineTo(x1, top)
      inRun = true
    }
    ctx.lineTo(xb, top)
    penX = xb
    penY = top
    const joined =
      i < count - 1 &&
      x[i + 1] === x2[i] &&
      (row === undefined || row[i + 1] === row[i])
    if (!joined) {
      penY = bandTop + originY
      ctx.lineTo(xb, penY)
      inRun = false
    }
  }
  ctx.stroke()
}

// One polyline per run of midpoints on a row, round-joined and round-capped so
// a break paints the dot the shader's collapsed capsule draws.
function paintCenter(
  ctx: MarkContext2D,
  c: LineChannels,
  block: RenderBlock,
  frame: MarkFrame,
  params: LineParams,
) {
  const { x, x2, y, row, count } = c
  if (count === 0) {
    return
  }
  const color = paintColors(c, count, params.ramp)
  const { bpToPx, band, normalize } = lineFrame(block, frame, params)
  const gapBp = c.gapBp ?? Number.POSITIVE_INFINITY
  ctx.lineWidth = params.lineWidth
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = abgrToCssRgba(color[0]!)
  ctx.beginPath()
  let lastAbgr = color[0]!
  let penX = 0
  let penY = 0
  for (let i = 0; i < count; i++) {
    const bandTop = row === undefined ? 0 : band * row[i]!
    const cx = (bpToPx(x[i]!) + bpToPx(x2[i]!)) / 2
    const cy = bandTop + (1 - normalize(y[i]!)) * band
    const linked =
      i > 0 &&
      (row === undefined || row[i - 1] === row[i]) &&
      (x[i]! + x2[i]!) / 2 - (x[i - 1]! + x2[i - 1]!) / 2 <= gapBp
    const abgr = color[i]!
    if (abgr !== lastAbgr) {
      restroke(ctx, abgr, linked, penX, penY)
      lastAbgr = abgr
    }
    if (linked) {
      ctx.lineTo(cx, cy)
    } else {
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx, cy)
    }
    penX = cx
    penY = cy
  }
  ctx.stroke()
}

/** The step variant: three square-capped quads an instance, flat filled. */
export const lineStepMark: MarkShape<LineChannels, LineParams> = {
  id: 'lineStep',
  pass: {
    ...slangPass({
      id: 'lineStep',
      mod: shader,
      verticesPerInstance: STEP_LINE_VERTS,
    }),
    pack: packLine,
  },
  writeUniforms: writeLineUniforms(LINE_STEP),
  paintBlock: paintStep,
}

/** The centre variant: one round-capped capsule an instance, max blended. */
export const lineCenterMark: MarkShape<LineChannels, LineParams> = {
  id: 'lineCenter',
  pass: {
    ...slangPass({ id: 'lineCenter', mod: shader, blendState: { op: 'max' } }),
    pack: packLine,
  },
  writeUniforms: writeLineUniforms(LINE_CENTER),
  paintBlock: paintCenter,
}
