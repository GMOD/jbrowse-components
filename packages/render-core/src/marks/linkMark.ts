import { getDpr } from '../canvas2dUtils.ts'
import { SCALE_TYPE_LOG } from '../scoreScale.ts'
import { distToWideCirclePx } from '../shaders/curveDistance.js.generated.ts'
import {
  LINK_CURVE_SEGMENTS,
  LINK_ELSEWHERE,
  LINK_FAR_SCREEN_WIDTHS,
  LINK_FOOT_PX,
  LINK_MAX_REGIONS,
  LINK_NO_REGION,
  LINK_NO_SIZE,
  LINK_LINE_MIN_PX,
  LINK_SHAPE_ARC,
  LINK_SHAPE_DOME,
  LINK_SHAPE_LINE,
  LINK_SIZE_CONSTANT,
  LINK_SIZE_SCALED,
  LINK_STEM_PX,
} from '../shaders/linkMark.consts.generated.ts'
import * as shader from '../shaders/linkMark.generated.ts'
import {
  linkApexPx,
  linkBaseYPx,
  linkFootDir,
  linkFootLenPx,
  linkRadiiPx,
  linkStrokeWidthPx,
  linkValuePx,
} from '../shaders/linkMark.js.generated.ts'
import { slangPass } from '../slangPass.ts'
import { abgrToCssRgba } from './colorFill.ts'
import { ellipseNearest } from './ellipseDistance.ts'
import { nearestInk } from './markHit.ts'
import { colorBits, paintColors, rampUniforms } from './markRamp.ts'
import { bandHeightPx, rowLane } from './rowLane.ts'
import { valueScaleUniforms } from './valueScale.ts'

import type { RenderBlock } from '../renderBlock.ts'
import type { ColorChannel } from './markRamp.ts'
import type { RowChannel, RowParams } from './rowLane.ts'
import type { InkRect, MarkFrame, MarkRamp, MarkShape } from './types.ts'
import type { MarkValueScale } from './valueScale.ts'

/**
 * The `link` shape's channels: a stroked curve from `x`, on the displayed
 * region whose payload holds it, to `x2` on the displayed region `x2Region`
 * names, {@link LINK_NO_REGION} where the far end lies on none and
 * {@link LINK_ELSEWHERE} where another payload draws the curve. `y` is the
 * apex's value on the band's scale where the mark names one, and `size` the
 * raw value the stroke width reads through the size scale.
 */
export interface LinkChannels extends ColorChannel, RowChannel {
  x: Uint32Array
  x2: Uint32Array
  x2Region: Uint32Array
  y?: Float32Array
  size?: Float32Array
  /**
   * The breakend ticks each instance carries: two bits per foot, 1 pointing
   * forward along the genome and 2 back, the `x` foot in the low pair.
   */
  feet?: Uint8Array
  count: number
}

export const LINK_FOOT_FORWARD = 1
export const LINK_FOOT_REVERSE = 2

/** The `feet` lane's value for a tick at each foot, by genomic direction. */
export function linkFeet(xDir: number, x2Dir: number) {
  const bits = (d: number) =>
    d > 0 ? LINK_FOOT_FORWARD : d < 0 ? LINK_FOOT_REVERSE : 0
  return bits(xDir) | (bits(x2Dir) << 2)
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
  /** The region's screen extent, which a foot stops at; unbounded when absent. */
  leftPx?: number
  rightPx?: number
}

export interface LinkSizeScale {
  domain: [number, number]
  scale: 'linear' | 'log'
  range: [number, number]
}

export type LinkShape = 'dome' | 'arc' | 'line'

export interface LinkParams extends RowParams, MarkValueScale {
  /** The quantitative colour scale, for a link whose colour is a ramp. */
  ramp?: MarkRamp
  /** The view's displayed regions, indexed as `x2Region` and the block's own index are. */
  regions: readonly LinkRegion[]
  /**
   * `dome` clamps the apex to the band; `arc` is a true semicircle; `line` is
   * a straight segment at the apex height.
   */
  linkShape: LinkShape
  /** How far a stem rises from a foot whose mate lies on no displayed region. */
  stemPx?: number
  /** A straight segment's `[dash, gap]` in CSS px, starting on a dash. */
  strokeDash?: readonly [number, number]
  /** How long a breakend foot runs where its region has the room. */
  footPx?: number
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
const KIND_NONE = 3
const KIND_LINE = 4

// The painter's leg polyline: enough segments that the chord sagitta on any
// leg the band can show is under a pixel.
const LEG_SEGMENTS = 32

interface LinkFrame {
  band: number
  rowOffsetPx: number
  reverse: number
  /** Canvas y per frame y: the frame's y is negative away from the baseline. */
  ySign: number
  stemPx: number
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
  footPx: number
  /** Each foot's tick as a screen direction and length; 0 draws none. */
  foot1Dir: number
  foot1Len: number
  foot2Dir: number
  foot2Len: number
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
    rowOffsetPx: params.rowOffsetPx ?? 0,
    reverse: params.reverse ? 1 : 0,
    ySign: params.reverse ? -1 : 1,
    stemPx: params.stemPx ?? LINK_STEM_PX,
    reach: Math.max(band - (params.insetPx ?? 0), 0),
    screenW: frame.canvasWidth,
    regions: params.regions,
    own: block.displayedRegionIndex,
    dpr: getDpr(),
    scaleType: valueScaleType,
    symlogConstant: valueSymlogConstant,
    domainMin: params.domain[0],
    domainMax: params.domain[1],
    insetPx: params.insetPx ?? 0,
    shape: linkShapeCode(params.linkShape),
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
    footPx: params.footPx ?? LINK_FOOT_PX,
    foot1Dir: 0,
    foot1Len: 0,
    foot2Dir: 0,
    foot2Len: 0,
  }
}

// A straight line's strip needs one segment; a curve's, the full count.
function curveSegments(params: LinkParams) {
  return params.linkShape === 'line' ? 1 : LINK_CURVE_SEGMENTS
}

// The curve's strip, then the two feet's six vertices each.
const FOOT_STRIP_VERTS = 12

function linkShapeCode(shape: LinkShape) {
  return shape === 'arc'
    ? LINK_SHAPE_ARC
    : shape === 'line'
      ? LINK_SHAPE_LINE
      : LINK_SHAPE_DOME
}

function regionPx(regions: readonly LinkRegion[], index: number, bp: number) {
  const r = regions[index]!
  return r.anchorPx + (bp - r.anchorBp) * r.signedPxPerBp
}

function sizeOf(c: LinkChannels, i: number) {
  const v = c.size?.[i]
  return v !== undefined && Number.isFinite(v) ? v : LINK_NO_SIZE
}

// A foot's tick through its own region: the genomic direction mirrored where
// the region draws right to left, and held short of the region's edge.
function footOn(
  region: LinkRegion,
  x: number,
  genomicDir: number,
  footPx: number,
) {
  const dir = genomicDir * Math.sign(region.signedPxPerBp)
  const len = linkFootLenPx(
    x,
    dir,
    region.leftPx ?? -Infinity,
    region.rightPx ?? Infinity,
    footPx,
  )
  return dir !== 0 && len > 0 ? { dir, len } : { dir: 0, len: 0 }
}

function placeFeet(c: LinkChannels, g: LinkFrame, i: number) {
  const feet = c.feet?.[i] ?? 0
  const placed = g.kind !== KIND_STEM && g.kind !== KIND_NONE
  const one =
    feet === 0 || g.kind === KIND_NONE
      ? { dir: 0, len: 0 }
      : footOn(g.regions[g.own]!, g.xPx, linkFootDir(feet, 0), g.footPx)
  const two =
    feet === 0 || !placed
      ? { dir: 0, len: 0 }
      : footOn(
          g.regions[c.x2Region[i]!]!,
          g.x2Px,
          linkFootDir(feet, 2),
          g.footPx,
        )
  g.foot1Dir = one.dir
  g.foot1Len = one.len
  g.foot2Dir = two.dir
  g.foot2Len = two.len
}

function placeLink(c: LinkChannels, g: LinkFrame, i: number) {
  placeCurve(c, g, i)
  placeFeet(c, g, i)
}

function placeCurve(c: LinkChannels, g: LinkFrame, i: number) {
  const { regions } = g
  g.strokePx = linkStrokeWidthPx(
    sizeOf(c, i),
    g.sizeMode,
    g.sizePx,
    g.sizeDomainMin,
    g.sizeDomainMax,
    g.sizeScaleType,
    g.sizeRangeMin,
    g.sizeRangeMax,
    g.dpr,
  )
  g.baseY = linkBaseYPx(g.rowOffsetPx, g.band, c.row?.[i] ?? 0, g.reverse)
  g.xPx = regionPx(regions, g.own, c.x[i]!)
  const region = c.x2Region[i]!
  if (region === LINK_ELSEWHERE) {
    g.kind = KIND_NONE
    return
  }
  if (region >= regions.length || region >= LINK_MAX_REGIONS) {
    g.kind = KIND_STEM
    g.x2Px = g.xPx
    g.rx = 0
    g.ry = g.stemPx
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
  if (g.shape === LINK_SHAPE_LINE) {
    g.kind = KIND_LINE
    g.rx = Math.max(2 * pairHalf, LINK_LINE_MIN_PX)
    g.ry = apex
    return
  }
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

function sizeLane(c: LinkChannels) {
  const lane = new Float32Array(c.count)
  for (let i = 0; i < c.count; i++) {
    lane[i] = sizeOf(c, i)
  }
  return lane
}

const NO_VALUES = new Float32Array(0)
const NO_FEET = new Uint8Array(0)

// The region table the uniform writer takes, mutated in place per write so a
// frame allocates nothing per block.
const TABLE = Array.from(
  { length: LINK_MAX_REGIONS },
  (): [number, number, number, number] => [0, 0, 0, 0],
) as Parameters<typeof shader.writeUniforms>[1]['regionTable']

function writeEntry(
  entry: [number, number, number, number],
  { anchorPx, anchorBp, signedPxPerBp }: LinkRegion,
) {
  const lo = anchorBp % 4096
  entry[0] = anchorPx
  entry[1] = anchorBp - lo
  entry[2] = lo
  entry[3] = signedPxPerBp
  return entry
}

const OWN: [number, number, number, number] = [0, 0, 0, 0]

function tableEntry(region: LinkRegion | undefined) {
  return region ? writeEntry(OWN, region) : OWN.fill(0)
}

// Past float32's reach, so an unbounded edge never shortens a foot.
const UNBOUNDED_PX = 1e30

const SPANS = Array.from(
  { length: LINK_MAX_REGIONS / 2 },
  (): [number, number, number, number] => [0, 0, 0, 0],
) as Parameters<typeof shader.writeUniforms>[1]['regionSpan']

const OWN_SPAN: [number, number, number, number] = [0, 0, 0, 0]

function writeSpan(
  entry: [number, number, number, number],
  at: 0 | 2,
  region: LinkRegion | undefined,
) {
  entry[at] = region?.leftPx ?? -UNBOUNDED_PX
  entry[at + 1] = region?.rightPx ?? UNBOUNDED_PX
  return entry
}

function fillTable(regions: readonly LinkRegion[]) {
  const n = Math.min(regions.length, LINK_MAX_REGIONS)
  for (let i = 0; i < n; i++) {
    writeEntry(TABLE[i]!, regions[i]!)
    writeSpan(SPANS[i >> 1]!, (i & 1) === 0 ? 0 : 2, regions[i])
  }
  return n
}

interface LegPoint {
  x: number
  y: number
}

// Canvas y of a point `up` px from the baseline on the drawn side.
function yAt(g: LinkFrame, up: number) {
  return g.baseY - g.ySign * up
}

function lineStart(g: LinkFrame) {
  return (g.xPx + g.x2Px) / 2 - g.rx / 2
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
      y: yAt(g, Math.sin(b) * g.rx),
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
    ctx.lineTo(g.xPx, yAt(g, g.stemPx))
    return
  }
  if (g.kind === KIND_LINE) {
    const x = lineStart(g)
    const y = yAt(g, g.ry)
    ctx.moveTo(x, y)
    ctx.lineTo(x + g.rx, y)
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
  if (g.reverse) {
    ctx.moveTo(mid + g.rx, baseY)
    ctx.ellipse(mid, baseY, g.rx, g.ry, 0, 0, Math.PI)
  } else {
    ctx.moveTo(mid - g.rx, baseY)
    ctx.ellipse(mid, baseY, g.rx, g.ry, 0, Math.PI, 2 * Math.PI)
  }
}

interface FootSegment {
  from: number
  to: number
  y: number
}

// The ticks, a half stroke inside the band so one on its edge draws whole.
function footSegments(g: LinkFrame): FootSegment[] {
  const y = yAt(g, g.strokePx / 2)
  const segments: FootSegment[] = []
  if (g.foot1Len > 0) {
    segments.push({ from: g.xPx, to: g.xPx + g.foot1Dir * g.foot1Len, y })
  }
  if (g.foot2Len > 0) {
    segments.push({ from: g.x2Px, to: g.x2Px + g.foot2Dir * g.foot2Len, y })
  }
  return segments
}

function footBox({ from, to, y }: FootSegment, half: number): InkRect {
  const left = Math.min(from, to)
  return {
    left: left - half,
    top: y - half,
    width: Math.abs(to - from) + 2 * half,
    height: 2 * half,
  }
}

function union(a: InkRect, b: InkRect): InkRect {
  const left = Math.min(a.left, b.left)
  const top = Math.min(a.top, b.top)
  return {
    left,
    top,
    width: Math.max(a.left + a.width, b.left + b.width) - left,
    height: Math.max(a.top + a.height, b.top + b.height) - top,
  }
}

function dashes(g: LinkFrame) {
  return g.kind === KIND_LINE || g.kind === KIND_STEM
}

// The box from the baseline to `rise` px off it, padded by `pad`.
function riseBox(
  g: LinkFrame,
  left: number,
  width: number,
  rise: number,
  pad: number,
): InkRect {
  const top = g.reverse ? g.baseY - pad : g.baseY - rise - pad
  return { left, top, width, height: rise + 2 * pad }
}

function inkBox(g: LinkFrame): InkRect | undefined {
  const curve = curveBox(g)
  const half = g.strokePx / 2
  return curve
    ? footSegments(g).reduce((box, f) => union(box, footBox(f, half)), curve)
    : undefined
}

function curveBox(g: LinkFrame): InkRect | undefined {
  if (g.kind === KIND_NONE) {
    return undefined
  }
  const half = g.strokePx / 2
  if (g.kind === KIND_STEM) {
    return riseBox(g, g.xPx - half, g.strokePx, g.stemPx, half)
  }
  if (g.kind === KIND_LINE) {
    return {
      left: lineStart(g) - half,
      top: yAt(g, g.ry) - half,
      width: g.rx + g.strokePx,
      height: g.strokePx,
    }
  }
  const left = Math.min(g.xPx, g.x2Px)
  const right = Math.max(g.xPx, g.x2Px)
  const rise = g.kind === KIND_CIRCLE ? g.legHeight : g.ry
  return riseBox(g, left - half, right - left + g.strokePx, rise, half)
}

interface CurvePoint {
  x: number
  y: number
  dist: number
}

// The nearest point of the drawn curve to (px, py), in canvas px, and how far
// the cursor is from it. Measured with the curve rising above its baseline:
// under a reversed scale the cursor is reflected there and the answer back.
function nearestOnCurve(g: LinkFrame, px: number, py: number): CurvePoint {
  const flip = (y: number) => (g.reverse ? 2 * g.baseY - y : y)
  const rising = nearestRising(g, px, flip(py))
  let near = { ...rising, y: flip(rising.y) }
  for (const { from, to, y } of footSegments(g)) {
    const x = Math.min(Math.max(from, to), Math.max(Math.min(from, to), px))
    const dist = Math.hypot(px - x, py - y)
    if (dist < near.dist) {
      near = { x, y, dist }
    }
  }
  return near
}

function nearestRising(g: LinkFrame, px: number, py: number): CurvePoint {
  const { baseY } = g
  if (g.kind === KIND_STEM) {
    const y = Math.min(baseY, Math.max(baseY - g.stemPx, py))
    return { x: g.xPx, y, dist: Math.hypot(px - g.xPx, py - y) }
  }
  if (g.kind === KIND_LINE) {
    const start = lineStart(g)
    const x = Math.min(start + g.rx, Math.max(start, px))
    const y = baseY - g.ry
    return { x, y, dist: Math.hypot(px - x, py - y) }
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
  spansView: true,
  pass: {
    ...slangPass({ id: 'link', mod: shader }),
    pack: c =>
      shader.packInstances(
        {
          x: c.x,
          x2: c.x2,
          x2Region: c.x2Region,
          y: c.y ?? (c.count === 0 ? NO_VALUES : new Float32Array(c.count)),
          size: sizeLane(c),
          color: colorBits(c),
          row: rowLane(c.row, c.count),
          feet: c.feet ?? (c.count === 0 ? NO_FEET : new Uint8Array(c.count)),
        },
        c.count,
      ),
  },

  writeUniforms(scratch, _clip, block, frame, params) {
    const { sizeScale } = params
    shader.writeUniforms(scratch, {
      canvasHeight: frame.canvasHeight,
      devicePixelRatio: getDpr(),
      rowHeight: bandHeightPx(params, frame.canvasHeight),
      rowOffsetPx: params.rowOffsetPx ?? 0,
      reverse: params.reverse ? 1 : 0,
      stemPx: params.stemPx ?? LINK_STEM_PX,
      dashPx: params.strokeDash?.[0] ?? 0,
      gapPx: params.strokeDash?.[1] ?? 0,
      footPx: params.footPx ?? LINK_FOOT_PX,
      curveSegments: curveSegments(params),
      insetPx: params.insetPx ?? 0,
      domainMin: params.domain[0],
      domainMax: params.domain[1],
      ...valueScaleUniforms(params),
      ...rampUniforms(params.ramp),
      valued: params.valued ? 1 : 0,
      linkShape: linkShapeCode(params.linkShape),
      sizeMode: sizeScale ? LINK_SIZE_SCALED : LINK_SIZE_CONSTANT,
      sizeConstantPx: params.sizePx,
      sizeDomainMin: sizeScale?.domain[0] ?? 0,
      sizeDomainMax: sizeScale?.domain[1] ?? 1,
      sizeScaleType: sizeScale?.scale === 'log' ? SCALE_TYPE_LOG : 0,
      sizeRangeMin: sizeScale?.range[0] ?? params.sizePx,
      sizeRangeMax: sizeScale?.range[1] ?? params.sizePx,
      canvasWidth: frame.canvasWidth,
      regionCount: fillTable(params.regions),
      zero: 0,
      ownEntry: tableEntry(params.regions[block.displayedRegionIndex]),
      ownSpan: writeSpan(
        OWN_SPAN,
        0,
        params.regions[block.displayedRegionIndex],
      ),
      regionTable: TABLE,
      regionSpan: SPANS,
    })
  },

  paintsBlock(block, _frame, params) {
    return params.regions[block.displayedRegionIndex] !== undefined
  },

  verticesPerInstance(_frame, params) {
    return (curveSegments(params) + 1) * 2 + FOOT_STRIP_VERTS
  },

  paintBlock(ctx, channels, block, frame, params) {
    const { count } = channels
    if (count === 0) {
      return
    }
    const color = paintColors(channels, count, params.ramp)
    const g = linkFrame(block, frame, params)
    const dash = params.strokeDash ? [...params.strokeDash] : []
    ctx.lineCap = 'butt'
    for (let i = 0; i < count; i++) {
      placeLink(channels, g, i)
      if (g.kind === KIND_NONE) {
        continue
      }
      ctx.lineWidth = g.strokePx
      ctx.strokeStyle = abgrToCssRgba(color[i]!)
      ctx.setLineDash(dashes(g) ? dash : [])
      ctx.beginPath()
      tracePath(ctx, g)
      ctx.stroke()
      const feet = footSegments(g)
      if (feet.length > 0) {
        ctx.setLineDash([])
        ctx.beginPath()
        for (const { from, to, y } of feet) {
          ctx.moveTo(from, y)
          ctx.lineTo(to, y)
        }
        ctx.stroke()
      }
    }
    ctx.setLineDash([])
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
    const reach = Math.sqrt(maxDistSq)
    return nearestInk(candidates, maxDistSq, i => {
      placeLink(channels, g, i)
      const box = inkBox(g)
      if (
        !box ||
        xPx < box.left - reach ||
        xPx > box.left + box.width + reach ||
        yPx < box.top - reach ||
        yPx > box.top + box.height + reach
      ) {
        return undefined
      }
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

export { LINK_ELSEWHERE, LINK_NO_REGION }
