import { clampBlockScissor, getDpr } from '../canvas2dUtils.ts'
import { SCALE_TYPE_LOG } from '../scoreScale.ts'
import { distToWideCirclePx } from '../shaders/curveDistance.js.generated.ts'
import {
  LINK_FAR_SCREEN_WIDTHS,
  LINK_MAX_REGIONS,
  LINK_NO_REGION,
  LINK_NO_SIZE,
  LINK_SHAPE_ARC,
  LINK_SHAPE_DOME,
  LINK_SIZE_CONSTANT,
  LINK_SIZE_SCALED,
  LINK_STEM_PX,
} from '../shaders/linkMark.consts.generated.ts'
import * as shader from '../shaders/linkMark.generated.ts'
import {
  linkApexPx,
  linkRadiiPx,
  linkStrokeWidthPx,
  linkValuePx,
} from '../shaders/linkMark.js.generated.ts'
import { slangPass } from '../slangPass.ts'
import { abgrToCssRgba } from './colorFill.ts'
import { ellipseNearest } from './ellipseDistance.ts'
import { nearestInk } from './markHit.ts'
import { colorBits, paintColors, rampUniforms } from './markRamp.ts'
import { bandHeightPx, bandTopPx, rowLane } from './rowLane.ts'
import { valueScaleUniforms } from './valueScale.ts'

import type { RenderBlock } from '../renderBlock.ts'
import type { ColorChannel } from './markRamp.ts'
import type { RowChannel, RowParams } from './rowLane.ts'
import type { InkRect, MarkFrame, MarkRamp, MarkShape } from './types.ts'
import type { MarkValueScale } from './valueScale.ts'

/**
 * The `link` shape's channels: a stroked curve from `x`, on the block's own
 * displayed region, to `x2` on the displayed region `x2Region` names,
 * {@link LINK_NO_REGION} where the far end lies on none. `y` is the apex's
 * value on the band's scale where the mark names one, and `size` the raw
 * value the stroke width reads through the size scale.
 */
export interface LinkChannels extends ColorChannel, RowChannel {
  x: Uint32Array
  x2: Uint32Array
  x2Region: Uint32Array
  y?: Float32Array
  size?: Float32Array
  count: number
}

/**
 * One displayed region as a foot places through it: the canvas px of an
 * anchor bp chosen near the view, so a foot's offset from it stays inside
 * float32 on the GPU, and the signed px per bp, negative on a reversed
 * region.
 */
export interface LinkRegion {
  anchorPx: number
  anchorBp: number
  signedPxPerBp: number
}

export interface LinkSizeScale {
  domain: [number, number]
  scale: 'linear' | 'log'
  range: [number, number]
}

export interface LinkParams extends RowParams, MarkValueScale {
  /** The quantitative colour scale, for a link whose colour is a ramp. */
  ramp?: MarkRamp
  /** The view's displayed regions, indexed as `x2Region` and the block's own index are. */
  regions: readonly LinkRegion[]
  /** `dome` clamps the apex to the band; `arc` is a true semicircle. */
  linkShape: 'dome' | 'arc'
  /** Whether the mark names a `y`, which then places the apex. */
  valued: boolean
  /** The stroke width where no `size` channel is read. */
  sizePx: number
  sizeScale?: LinkSizeScale
  /** How far inside the band the value range ends, the axis's own. */
  insetPx?: number
}

const KIND_ELLIPSE = 0
const KIND_CIRCLE = 1
const KIND_STEM = 2

// The painter's leg polyline: enough segments that the chord sagitta on any
// leg the band can show is under a pixel.
const LEG_SEGMENTS = 32

interface LinkFrame {
  band: number
  reach: number
  screenW: number
  regions: readonly LinkRegion[]
  own: number
  dpr: number
  scaleType: number
  symlogConstant: number
  domainMin: number
  domainMax: number
  insetPx: number
  shape: number
  valued: number
  sizeMode: number
  sizePx: number
  sizeDomainMin: number
  sizeDomainMax: number
  sizeScaleType: number
  sizeRangeMin: number
  sizeRangeMax: number
  // per instance, written by placeLink
  kind: number
  xPx: number
  x2Px: number
  baseY: number
  rx: number
  ry: number
  /** How far above the baseline a far circle's legs reach. */
  legHeight: number
  /** The leg sweep in radians, the painter's and the ink's one number. */
  legSweep: number
  strokePx: number
}

function linkFrame(
  block: RenderBlock,
  frame: MarkFrame,
  params: LinkParams,
): LinkFrame {
  const band = bandHeightPx(params, frame.canvasHeight)
  const { valueScaleType, valueSymlogConstant } = valueScaleUniforms(params)
  const { sizeScale } = params
  return {
    band,
    reach: Math.max(band - (params.insetPx ?? 0), 0),
    screenW:
      clampBlockScissor(
        block.screenStartPx,
        block.screenEndPx,
        frame.canvasWidth,
      )?.scissorW ?? 0,
    regions: params.regions,
    own: block.displayedRegionIndex,
    dpr: getDpr(),
    scaleType: valueScaleType,
    symlogConstant: valueSymlogConstant,
    domainMin: params.domain[0],
    domainMax: params.domain[1],
    insetPx: params.insetPx ?? 0,
    shape: params.linkShape === 'arc' ? LINK_SHAPE_ARC : LINK_SHAPE_DOME,
    valued: params.valued ? 1 : 0,
    sizeMode: sizeScale ? LINK_SIZE_SCALED : LINK_SIZE_CONSTANT,
    sizePx: params.sizePx,
    sizeDomainMin: sizeScale?.domain[0] ?? 0,
    sizeDomainMax: sizeScale?.domain[1] ?? 1,
    sizeScaleType: sizeScale?.scale === 'log' ? SCALE_TYPE_LOG : 0,
    sizeRangeMin: sizeScale?.range[0] ?? params.sizePx,
    sizeRangeMax: sizeScale?.range[1] ?? params.sizePx,
    kind: KIND_STEM,
    xPx: 0,
    x2Px: 0,
    baseY: 0,
    rx: 0,
    ry: 0,
    legHeight: 0,
    legSweep: 0,
    strokePx: 0,
  }
}

function regionPx(regions: readonly LinkRegion[], index: number, bp: number) {
  const r = regions[index]!
  return r.anchorPx + (bp - r.anchorBp) * r.signedPxPerBp
}

function placeLink(c: LinkChannels, g: LinkFrame, i: number) {
  const { regions } = g
  g.strokePx = linkStrokeWidthPx(
    c.size ? c.size[i]! : LINK_NO_SIZE,
    g.sizeMode,
    g.sizePx,
    g.sizeDomainMin,
    g.sizeDomainMax,
    g.sizeScaleType,
    g.sizeRangeMin,
    g.sizeRangeMax,
    g.dpr,
  )
  g.baseY = bandTopPx(c.row, i, g.band) + g.band
  g.xPx = regionPx(regions, g.own, c.x[i]!)
  const region = c.x2Region[i]!
  if (region >= regions.length || region >= LINK_MAX_REGIONS) {
    g.kind = KIND_STEM
    g.x2Px = g.xPx
    g.rx = 0
    g.ry = LINK_STEM_PX
    return
  }
  g.x2Px = regionPx(regions, region, c.x2[i]!)
  const pairHalf = Math.abs(g.x2Px - g.xPx) / 2
  const valuePx = linkValuePx(
    c.y ? c.y[i]! : 0,
    g.domainMin,
    g.domainMax,
    g.band,
    g.scaleType,
    g.insetPx,
    g.symlogConstant,
  )
  const apex = linkApexPx(pairHalf, g.reach, g.shape, g.valued, valuePx)
  const [rx, ry] = linkRadiiPx(pairHalf, apex, g.screenW)
  g.rx = rx
  g.ry = ry
  if (2 * pairHalf > LINK_FAR_SCREEN_WIDTHS * g.screenW) {
    g.kind = KIND_CIRCLE
    g.legSweep = Math.asin(
      Math.min(1, Math.max(0, (g.reach + g.strokePx / 2) / Math.max(rx, 1e-6))),
    )
    g.legHeight = rx * Math.sin(g.legSweep)
  } else {
    g.kind = KIND_ELLIPSE
  }
}

function sizeLane(size: Float32Array | undefined, count: number) {
  const lane = new Float32Array(count)
  if (size) {
    for (let i = 0; i < count; i++) {
      const v = size[i]!
      lane[i] = Number.isFinite(v) ? v : LINK_NO_SIZE
    }
  }
  return lane
}

const NO_VALUES = new Float32Array(0)

// The region table the uniform writer takes, mutated in place per write so a
// frame allocates nothing per block.
const TABLE = Array.from(
  { length: LINK_MAX_REGIONS },
  (): [number, number, number, number] => [0, 0, 0, 0],
) as Parameters<typeof shader.writeUniforms>[1]['regionTable']

function fillTable(regions: readonly LinkRegion[]) {
  const n = Math.min(regions.length, LINK_MAX_REGIONS)
  for (let i = 0; i < n; i++) {
    const { anchorPx, anchorBp, signedPxPerBp } = regions[i]!
    const lo = anchorBp % 4096
    const entry = TABLE[i]!
    entry[0] = anchorPx
    entry[1] = anchorBp - lo
    entry[2] = lo
    entry[3] = signedPxPerBp
  }
  return n
}

interface LegPoint {
  x: number
  y: number
}

// The visible part of a far circle's leg rising from `footX`, in canvas px,
// built from the foot outward with the half-angle identity as the shader
// does, so a radius past 1e6 px cancels nothing.
function legPoints(g: LinkFrame, footX: number, legDir: number): LegPoint[] {
  const points: LegPoint[] = []
  for (let k = 0; k <= LEG_SEGMENTS; k++) {
    const b = (k / LEG_SEGMENTS) * g.legSweep
    const sh = Math.sin(b / 2)
    points.push({
      x: footX + legDir * (-2 * g.rx * sh * sh),
      y: g.baseY - Math.sin(b) * g.rx,
    })
  }
  return points
}

function tracePath(
  ctx: Parameters<MarkShape<LinkChannels, LinkParams>['paintBlock']>[0],
  g: LinkFrame,
) {
  const { baseY } = g
  if (g.kind === KIND_STEM) {
    ctx.moveTo(g.xPx, baseY)
    ctx.lineTo(g.xPx, baseY - LINK_STEM_PX)
    return
  }
  const left = Math.min(g.xPx, g.x2Px)
  const right = Math.max(g.xPx, g.x2Px)
  if (g.kind === KIND_CIRCLE) {
    for (const [footX, legDir] of [
      [right, 1],
      [left, -1],
    ] as const) {
      const points = legPoints(g, footX, legDir)
      ctx.moveTo(points[0]!.x, points[0]!.y)
      for (let k = 1; k < points.length; k++) {
        ctx.lineTo(points[k]!.x, points[k]!.y)
      }
    }
    return
  }
  const mid = (left + right) / 2
  ctx.moveTo(mid - g.rx, baseY)
  ctx.ellipse(mid, baseY, g.rx, g.ry, 0, Math.PI, 2 * Math.PI)
}

function inkBox(g: LinkFrame): InkRect {
  const half = g.strokePx / 2
  const { baseY } = g
  if (g.kind === KIND_STEM) {
    return {
      left: g.xPx - half,
      top: baseY - LINK_STEM_PX - half,
      width: g.strokePx,
      height: LINK_STEM_PX + g.strokePx,
    }
  }
  const left = Math.min(g.xPx, g.x2Px)
  const right = Math.max(g.xPx, g.x2Px)
  const rise = g.kind === KIND_CIRCLE ? g.legHeight : g.ry
  return {
    left: left - half,
    top: baseY - rise - half,
    width: right - left + g.strokePx,
    height: rise + g.strokePx,
  }
}

interface CurvePoint {
  x: number
  y: number
  dist: number
}

// The nearest point of the drawn curve to (px, py), in canvas px, and how far
// the cursor is from it.
function nearestOnCurve(g: LinkFrame, px: number, py: number): CurvePoint {
  const { baseY } = g
  if (g.kind === KIND_STEM) {
    const y = Math.min(baseY, Math.max(baseY - LINK_STEM_PX, py))
    return { x: g.xPx, y, dist: Math.hypot(px - g.xPx, py - y) }
  }
  const left = Math.min(g.xPx, g.x2Px)
  const right = Math.max(g.xPx, g.x2Px)
  if (g.kind === KIND_CIRCLE) {
    let best: CurvePoint | undefined
    for (const [footX, legDir] of [
      [right, 1],
      [left, -1],
    ] as const) {
      const dist = distToWideCirclePx((px - footX) * legDir, py - baseY, g.rx)
      if (!best || dist < best.dist) {
        // The nearest point of the whole circle, then held to the leg the
        // painter drew: from the foot up to the band's reach.
        const cx = footX - legDir * g.rx
        const vx = px - cx
        const vy = py - baseY
        const len = Math.hypot(vx, vy) || 1
        let x = cx + (vx / len) * g.rx
        let y = baseY + (vy / len) * g.rx
        if (y >= baseY) {
          x = footX
          y = baseY
        } else if (y < baseY - g.legHeight) {
          const sh = Math.sin(g.legSweep / 2)
          x = footX + legDir * (-2 * g.rx * sh * sh)
          y = baseY - g.legHeight
        }
        best = { x, y, dist: Math.hypot(px - x, py - y) }
      }
    }
    return best!
  }
  const mid = (left + right) / 2
  if (py > baseY) {
    const x = px < mid ? left : right
    return { x, y: baseY, dist: Math.hypot(px - x, py - baseY) }
  }
  const near = ellipseNearest(px - mid, py - baseY, g.rx, g.ry)
  return { x: mid + near.x, y: baseY + near.y, dist: near.dist }
}

export const linkMark: MarkShape<LinkChannels, LinkParams> = {
  id: 'link',
  pass: {
    ...slangPass({ id: 'link', mod: shader }),
    pack: c =>
      shader.packInstances(
        {
          x: c.x,
          x2: c.x2,
          x2Region: c.x2Region,
          y: c.y ?? (c.count === 0 ? NO_VALUES : new Float32Array(c.count)),
          size: sizeLane(c.size, c.count),
          color: colorBits(c),
          row: rowLane(c.row, c.count),
        },
        c.count,
      ),
  },

  writeUniforms(scratch, clip, block, frame, params) {
    const { sizeScale } = params
    shader.writeUniforms(scratch, {
      canvasHeight: frame.canvasHeight,
      blockPxX: clip.scissorX,
      blockPxW: clip.scissorW,
      devicePixelRatio: getDpr(),
      rowHeight: bandHeightPx(params, frame.canvasHeight),
      insetPx: params.insetPx ?? 0,
      domainMin: params.domain[0],
      domainMax: params.domain[1],
      ...valueScaleUniforms(params),
      ...rampUniforms(params.ramp),
      valued: params.valued ? 1 : 0,
      linkShape: params.linkShape === 'arc' ? LINK_SHAPE_ARC : LINK_SHAPE_DOME,
      sizeMode: sizeScale ? LINK_SIZE_SCALED : LINK_SIZE_CONSTANT,
      sizeConstantPx: params.sizePx,
      sizeDomainMin: sizeScale?.domain[0] ?? 0,
      sizeDomainMax: sizeScale?.domain[1] ?? 1,
      sizeScaleType: sizeScale?.scale === 'log' ? SCALE_TYPE_LOG : 0,
      sizeRangeMin: sizeScale?.range[0] ?? params.sizePx,
      sizeRangeMax: sizeScale?.range[1] ?? params.sizePx,
      ownRegion: block.displayedRegionIndex,
      regionCount: fillTable(params.regions),
      zero: 0,
      regionTable: TABLE,
    })
  },

  paintBlock(ctx, channels, block, frame, params) {
    const { count } = channels
    if (count === 0) {
      return
    }
    const color = paintColors(channels, count, params.ramp)
    const g = linkFrame(block, frame, params)
    ctx.lineCap = 'butt'
    for (let i = 0; i < count; i++) {
      placeLink(channels, g, i)
      ctx.lineWidth = g.strokePx
      ctx.strokeStyle = abgrToCssRgba(color[i]!)
      ctx.beginPath()
      tracePath(ctx, g)
      ctx.stroke()
    }
  },

  // The box the stroke lies in: the curve's extent padded by half the stroke,
  // which is the highlight and what the sweep holds the painting to. The hit
  // test below is the curve's own.
  ink(channels, block, frame, params, i) {
    const g = linkFrame(block, frame, params)
    placeLink(channels, g, i)
    return inkBox(g)
  },

  hitNearest(channels, block, frame, params, xPx, yPx, candidates, maxDistSq) {
    const g = linkFrame(block, frame, params)
    return nearestInk(candidates, maxDistSq, i => {
      placeLink(channels, g, i)
      const near = nearestOnCurve(g, xPx, yPx)
      const half = g.strokePx / 2
      if (near.dist <= half) {
        return { x: xPx, y: yPx, distSq: 0 }
      }
      const t = half / near.dist
      const x = near.x + (xPx - near.x) * t
      const y = near.y + (yPx - near.y) * t
      return { x, y, distSq: (xPx - x) ** 2 + (yPx - y) ** 2 }
    })
  },
}

export { LINK_NO_REGION }
