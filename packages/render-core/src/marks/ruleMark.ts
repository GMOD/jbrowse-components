import { bpProjection, projectBp, spanLeft } from '../canvas2dUtils.ts'
import * as shader from '../shaders/pointMark.generated.ts'
import { pointRowYPx, pointYPx } from '../shaders/pointMark.js.generated.ts'
import { rowBandTopPx } from '../shaders/rowTable.js.generated.ts'
import { slangPass } from '../slangPass.ts'
import { makeAbgrFill } from './colorFill.ts'
import { colorBits, paintColors } from './markRamp.ts'
import { valueWindow } from './nearestMarkHit.ts'
import { writePointUniforms } from './pointMark.ts'
import {
  bandHeightPx,
  rowColor,
  rowLane,
  rowSlot,
  rowTableTextures,
} from './rowLane.ts'
import { valueScaleUniforms } from './valueScale.ts'

import type { BpProjection } from '../canvas2dUtils.ts'
import type { RenderBlock } from '../renderBlock.ts'
import type { ColorChannel } from './markRamp.ts'
import type { ValuedMarkParams } from './pointMark.ts'
import type { RowChannel } from './rowLane.ts'
import type { RowTable } from './rowTable.ts'
import type { MarkFrame, MarkShape } from './types.ts'

/**
 * The `rule` shape's channels: a segment across `x`..`x2` at `y`, Vega-Lite's
 * `rule` with `x`, `x2` and `y`.
 */
export interface RuleChannels extends ColorChannel, RowChannel {
  x: Uint32Array
  x2: Uint32Array
  y: Float32Array
  count: number
}

export interface RuleParams extends ValuedMarkParams {
  /** Thickness in CSS px. */
  sizePx: number
  /** Narrowest a rule is painted, in CSS px, grown from its `x` end. */
  minWidthPx: number
}

interface RuleFrame extends BpProjection {
  band: number
  rowOffsetPx: number
  reverse: number
  domainMin: number
  domainMax: number
  scaleType: number
  symlogConstant: number
  insetPx: number
  sizePx: number
  minWidthPx: number
  table: RowTable | undefined
  left: number
  top: number
  width: number
}

function ruleFrame(
  block: RenderBlock,
  frame: MarkFrame,
  params: RuleParams,
): RuleFrame {
  const { valueScaleType, valueSymlogConstant } = valueScaleUniforms(params)
  return {
    ...bpProjection(block),
    band: bandHeightPx(params, frame.canvasHeight),
    rowOffsetPx: params.rowOffsetPx ?? 0,
    reverse: params.reverse ? 1 : 0,
    domainMin: params.domain[0],
    domainMax: params.domain[1],
    scaleType: valueScaleType,
    symlogConstant: valueSymlogConstant,
    insetPx: params.insetPx ?? 0,
    sizePx: params.sizePx,
    minWidthPx: params.minWidthPx,
    table: params.rowTable,
    left: 0,
    top: 0,
    width: 0,
  }
}

function placeRule(c: RuleChannels, g: RuleFrame, i: number) {
  const slot = rowSlot(c.row, i, g.table)
  if (slot === undefined) {
    return false
  }
  const xa = projectBp(g, c.x[i]!)
  const xb = projectBp(g, c.x2[i]!)
  const width = Math.max(g.minWidthPx, Math.abs(xb - xa))
  const valueY = pointYPx(
    c.y[i]!,
    g.domainMin,
    g.domainMax,
    g.band,
    g.scaleType,
    g.insetPx,
    g.symlogConstant,
  )
  g.left = spanLeft(xa, xb, width)
  g.width = width
  g.top =
    pointRowYPx(
      rowBandTopPx(g.rowOffsetPx, g.band, slot),
      g.band,
      g.reverse,
      valueY,
    ) -
    g.sizePx / 2
  return true
}

export const ruleMark: MarkShape<RuleChannels, RuleParams> = {
  id: 'rule',
  pass: {
    ...slangPass({ id: 'rule', mod: shader }),
    pack: c =>
      shader.packInstances(
        {
          ...c,
          color: colorBits(c),
          glyph: new Uint8Array(c.count),
          row: rowLane(c.row, c.count),
        },
        c.count,
      ),
  },

  writeUniforms(scratch, clip, block, frame, params) {
    writePointUniforms(scratch, clip, block, frame, params, {
      radiusPx: params.sizePx / 2,
      rule: true,
      minWidthPx: params.minWidthPx,
    })
  },

  textures: rowTableTextures,

  paintBlock(ctx, channels, block, frame, params) {
    const { count, row } = channels
    if (count === 0) {
      return
    }
    const color = paintColors(channels, count, params.ramp)
    const g = ruleFrame(block, frame, params)
    const setFill = makeAbgrFill(ctx)
    for (let i = 0; i < count; i++) {
      if (placeRule(channels, g, i)) {
        setFill(rowColor(color[i]!, row, i, g.table))
        ctx.fillRect(g.left, g.top, g.width, g.sizePx)
      }
    }
  },

  ink(channels, block, frame, params, i) {
    const g = ruleFrame(block, frame, params)
    return placeRule(channels, g, i)
      ? { left: g.left, top: g.top, width: g.width, height: g.sizePx }
      : undefined
  },

  valueWindow,
}
