import {
  abgrAlpha,
  abgrBlue,
  abgrGreen,
  abgrRed,
} from '@jbrowse/core/util/colorBits'
import { defineMark } from '@jbrowse/render-core/marks'
import { slangPass } from '@jbrowse/render-core/slangPass'

import { traceChord } from './chordGeometry.ts'
import { chordEndsAt, ribbonAnglesAt, ribbonFadeAt } from './chordStage.ts'
import { canvasPathSink } from './pathSink.ts'
import { traceRibbon } from './ribbonGeometry.ts'
import * as chordShader from './shaders/chord.generated.ts'
import { focusAlpha } from './shaders/chordStage.js.generated.ts'
import * as ribbonShader from './shaders/ribbon.generated.ts'

import type { ChordLanes, ChordStage, RibbonLanes } from './chordStage.ts'
import type {
  MarkContext2D,
  MarkFrame,
  MarkShape,
} from '@jbrowse/render-core/marks'

/** What reaches a chord or ribbon pass's uniforms and its painter. */
export interface ChordStageParams extends ChordStage {
  /** the circle's centre in the canvas's CSS px frame */
  centerX: number
  centerY: number
  /** the alpha every instance draws at, over its colour's own */
  alpha: number
  strokeWidthPx: number
  /** the least alpha the thin fade leaves a ribbon; 1 is no fade */
  thinFadeFloor: number
  /** the slice the pointer is on, as a foot's gap count names it; -1 for none */
  focusSlice: number
}

const CHORD_STROKE_PX = 1

function writeStage(
  write: typeof ribbonShader.writeUniforms,
  scratch: ArrayBuffer,
  scale: number,
  frame: MarkFrame,
  p: ChordStageParams,
) {
  write(scratch, {
    centerX: p.centerX,
    centerY: p.centerY,
    canvasWidth: frame.canvasWidth,
    canvasHeight: frame.canvasHeight,
    radiansPerBp: p.radiansPerBp,
    gapRadians: p.gapRadians,
    offsetRadians: p.offsetRadians,
    radiusPx: p.radiusPx,
    bezierRadiusPx: p.bezierRadiusPx,
    alpha: p.alpha,
    strokeWidthPx: p.strokeWidthPx,
    devicePixelRatio: scale,
    thinFadeFloor: p.thinFadeFloor,
    focusSlice: p.focusSlice,
  })
}

// one css colour per packed colour and alpha byte, per paint: its alpha times
// the display's and the instance's, rounded to the byte the canvas keeps, so a
// fade that differs per instance still makes no more than 256 per colour
function colorCache(alpha: number) {
  const cache = new Map<number, string>()
  return (abgr: number, instanceAlpha = 1) => {
    const byte = Math.round(abgrAlpha(abgr) * alpha * instanceAlpha)
    const key = abgr * 256 + byte
    let css = cache.get(key)
    if (css === undefined) {
      css = `rgba(${abgrRed(abgr)},${abgrGreen(abgr)},${abgrBlue(abgr)},${byte / 255})`
      cache.set(key, css)
    }
    return css
  }
}

function paintCentred(
  ctx: MarkContext2D,
  p: ChordStageParams,
  paint: () => void,
) {
  ctx.save()
  try {
    ctx.translate(p.centerX, p.centerY)
    paint()
  } finally {
    ctx.restore()
  }
}

/**
 * The ribbon: an alignment's span joined to its mate's by two curves, filled.
 * `ribbon.slang` draws it on the GPU; the painter traces the same four angles
 * as a path, for the Canvas2D rung.
 */
export const ribbonMark: MarkShape<RibbonLanes, ChordStageParams> = {
  id: 'circularRibbon',
  pass: {
    ...slangPass({ id: 'circularRibbon', mod: ribbonShader }),
    pack: c => ribbonShader.packInstances(c, c.count),
  },

  writeUniforms(scratch, clip, _block, frame, params) {
    writeStage(ribbonShader.writeUniforms, scratch, clip.scaleY, frame, params)
  },

  paintBlock(ctx, lanes, _block, _frame, params) {
    const fill = colorCache(params.alpha)
    const sink = canvasPathSink(ctx)
    paintCentred(ctx, params, () => {
      for (let i = 0; i < lanes.count; i++) {
        ctx.beginPath()
        traceRibbon(
          sink,
          ribbonAnglesAt(lanes, i, params),
          params.radiusPx,
          params.bezierRadiusPx,
        )
        ctx.fillStyle = fill(
          lanes.color[i]!,
          ribbonFadeAt(lanes, i, params, params.thinFadeFloor) *
            focusAlpha(lanes.xSlice[i]!, lanes.ySlice[i]!, params.focusSlice),
        )
        ctx.fill()
      }
    })
  },
}

/**
 * The chord: a link from `x` to `x2` stroked along the curve between them.
 * `chord.slang` draws it on the GPU; the painter strokes the same curve, and
 * both skip a chord whose ends are under a pixel apart.
 */
export const chordMark: MarkShape<ChordLanes, ChordStageParams> = {
  id: 'circularChord',
  pass: {
    ...slangPass({ id: 'circularChord', mod: chordShader }),
    pack: c => chordShader.packInstances(c, c.count),
  },

  writeUniforms(scratch, clip, _block, frame, params) {
    writeStage(chordShader.writeUniforms, scratch, clip.scaleY, frame, params)
  },

  paintBlock(ctx, lanes, _block, _frame, params) {
    const stroke = colorCache(params.alpha)
    const sink = canvasPathSink(ctx)
    paintCentred(ctx, params, () => {
      ctx.lineWidth = params.strokeWidthPx
      for (let i = 0; i < lanes.count; i++) {
        const ends = chordEndsAt(lanes, i, params)
        if (ends) {
          ctx.beginPath()
          traceChord(sink, ends, params.radiusPx, params.bezierRadiusPx)
          ctx.strokeStyle = stroke(
            lanes.color[i]!,
            focusAlpha(lanes.xSlice[i]!, lanes.x2Slice[i]!, params.focusSlice),
          )
          ctx.stroke()
        }
      }
    })
  },
}

/** One chord display's payload: its lanes, and what its params read live. */
export type ChordCell =
  | { kind: 'ribbon'; lanes: RibbonLanes; display: ChordCellDisplay }
  | { kind: 'chord'; lanes: ChordLanes; display: ChordCellDisplay }

export interface ChordCellDisplay {
  shapeAlpha: number
  bezierRadiusRatio: number
}

/** The polar stage a frame draws through, shared by every display's cell. */
export interface ChordLayerFrame extends MarkFrame {
  centerX: number
  centerY: number
  radiansPerBp: number
  gapRadians: number
  offsetRadians: number
  radiusPx: number
  thinFadeFloor: number
  focusSlice: number
}

function params(frame: ChordLayerFrame, cell: ChordCell): ChordStageParams {
  return {
    centerX: frame.centerX,
    centerY: frame.centerY,
    radiansPerBp: frame.radiansPerBp,
    gapRadians: frame.gapRadians,
    offsetRadians: frame.offsetRadians,
    radiusPx: frame.radiusPx,
    bezierRadiusPx: frame.radiusPx * cell.display.bezierRadiusRatio,
    alpha: cell.display.shapeAlpha,
    strokeWidthPx: CHORD_STROKE_PX,
    thinFadeFloor: frame.thinFadeFloor,
    focusSlice: frame.focusSlice,
  }
}

/** The marks the chord canvas draws: each display's cell is one or the other. */
export const chordLayerMarks = [
  defineMark<ChordCell, ChordLayerFrame, RibbonLanes, ChordStageParams>({
    shape: ribbonMark,
    channels: cell => (cell.kind === 'ribbon' ? cell.lanes : undefined),
    params,
  }),
  defineMark<ChordCell, ChordLayerFrame, ChordLanes, ChordStageParams>({
    shape: chordMark,
    channels: cell => (cell.kind === 'chord' ? cell.lanes : undefined),
    params,
  }),
]
