import { extendToMinWidthPx } from '../../../packages/render-core/src/shaders/hpmath.js.generated.ts'
import { GAP_Y } from '../../../packages/render-core/src/shaders/lineCommon.generated.ts'
import * as lineStep from '../../../packages/render-core/src/shaders/lineStepMark.generated.ts'
import { SMALL_POINT_MAX_DIAMETER } from '../../../packages/render-core/src/shaders/pointGlyph.generated.ts'
import { crispSquareTopLeftPx } from '../../../packages/render-core/src/shaders/pointGlyph.js.generated.ts'
import * as point from '../../../packages/render-core/src/shaders/pointMark.generated.ts'
import {
  pointYPx,
  valueToYPxScaled,
} from '../../../packages/render-core/src/shaders/pointMark.js.generated.ts'
import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '../../../packages/render-core/src/shaders/rowRect.js.generated.ts'
import * as span from '../../../packages/render-core/src/shaders/spanMark.generated.ts'
import {
  abgr,
  box,
  boxShape,
  defineFixture,
  paintOver,
  rgba,
  union,
} from '../fixture.ts'

import type { Budget, Shape } from '../fixture.ts'

const SHADERS = 'packages/render-core/src/shaders'
const W = 200
const H = 60
const START = 20000
const BP_PER_PX = 3.7
const bp = (px: number) => Math.round(START + px * BP_PER_PX)
const px = (b: number) => (b - START) / BP_PER_PX
const BP_RANGE: [number, number, number] = [START, 0, W * BP_PER_PX]
const DOMAIN = [0, 100] as const

const zero4: [number, number, number, number] = [0, 0, 0, 0]
const NO_RAMP = {
  rampMode: 0,
  rampMin: 0,
  rampMax: 1,
  rampMidNorm: 0.5,
  colorCutCount: 0,
  colorCuts: [zero4, zero4] as [typeof zero4, typeof zero4],
  colorBands: [
    zero4,
    zero4,
    zero4,
    zero4,
    zero4,
    zero4,
    zero4,
    zero4,
    zero4,
  ] as [
    typeof zero4,
    typeof zero4,
    typeof zero4,
    typeof zero4,
    typeof zero4,
    typeof zero4,
    typeof zero4,
    typeof zero4,
    typeof zero4,
  ],
}

const PALETTE = [
  [31, 119, 180],
  [214, 39, 40],
  [44, 160, 44],
  [148, 103, 189],
] as const

// ---- point ----

interface Point {
  x: number
  value: number
  glyph: number
}

function pointUniforms(radiusPx: number, rule: number, minWidthPx = 0) {
  return (dpr: number) => ({
    bpRangeX: BP_RANGE,
    canvasHeight: H,
    domainMin: DOMAIN[0],
    domainMax: DOMAIN[1],
    valueScaleType: 0,
    valueSymlogConstant: 1,
    ...NO_RAMP,
    zero: 0,
    viewportWidth: W,
    radiusPx,
    triangleRadiusYPx: radiusPx,
    rowHeight: H,
    rowOffsetPx: 0,
    reverse: 0,
    insetPx: 0,
    devicePixelRatio: dpr,
    rowTableKeys: -1,
    rule,
    minWidthPx,
  })
}

const valueY = (value: number) =>
  pointYPx(value, DOMAIN[0], DOMAIN[1], H, 0, 0, 1)

function glyphShape(p: Point, r: number): Shape['inside'] {
  const cx = px(bp(p.x))
  const cy = valueY(p.value)
  const crisp =
    p.glyph === point.GLYPH_DISC && 2 * r <= SMALL_POINT_MAX_DIAMETER
  switch (crisp ? point.GLYPH_SQUARE : p.glyph) {
    case point.GLYPH_TRIANGLE:
      return (x, y) => {
        const lx = (x - cx) / r
        const ly = (cy - y) / r
        return ly <= 1 && Math.abs(lx) <= (ly + 1) / 2
      }
    case point.GLYPH_DIAMOND:
      return (x, y) =>
        Math.abs(x - cx) + Math.abs(y - cy) <= r * point.DIAMOND_GLYPH_SCALE
    case point.GLYPH_SQUARE: {
      const d = 2 * r
      const left = crispSquareTopLeftPx(cx, d)
      const top = crispSquareTopLeftPx(cy, d)
      return box(left, top, left + d, top + d)
    }
    default:
      return (x, y) => Math.hypot(x - cx, y - cy) <= r
  }
}

function pointFixture(
  name: string,
  about: string,
  radiusPx: number,
  points: Point[],
  budget?: Budget,
) {
  const color = (i: number) => PALETTE[i % PALETTE.length]!
  return defineFixture({
    name,
    slang: `${SHADERS}/pointMark.slang`,
    about,
    mod: point,
    width: W,
    height: H,
    count: points.length,
    instances: {
      x: points.map(p => bp(p.x)),
      x2: points.map(p => bp(p.x)),
      y: points.map(p => p.value),
      color: points.map((_, i) => abgr(color(i))),
      glyph: points.map(p => p.glyph),
      row: points.map(() => 0),
    },
    uniforms: pointUniforms(radiusPx, 0),
    reference: paintOver(
      points.map((p, i) => ({
        inside: glyphShape(p, radiusPx),
        color: rgba(color(i)),
      })),
    ),
    budget,
  })
}

const scattered = (n: number, spacing: number, glyphs: number[]): Point[] =>
  Array.from({ length: n }, (_, i) => ({
    x: 9.3 + i * spacing + ((i * 7) % 3) * 0.37,
    value: 12.4 + ((i * 37) % 76) + 0.31 * i,
    glyph: glyphs[i % glyphs.length]!,
  }))
const { GLYPH_DISC, GLYPH_TRIANGLE, GLYPH_DIAMOND, GLYPH_SQUARE } = point

// [x px, x2 px, value]: sub-pixel ends; the last two abut at one value, as
// adjacent segments' means do.
const RULES = [
  [6.3, 48.7, 81.3],
  [55.1, 55.4, 63.7],
  [62.6, 110.2, 40.45],
  [120.3, 150.65, 22.1],
  [150.65, 191.2, 22.1],
] as const
const RULE_RADIUS = 1.3
const RULE_MIN_WIDTH = 2

const ruleFixture = defineFixture({
  name: 'mark-rule',
  slang: `${SHADERS}/pointMark.slang`,
  about: `rules ${2 * RULE_RADIUS} px thick across sub-pixel extents, the last two abutting`,
  mod: point,
  width: W,
  height: H,
  count: RULES.length,
  instances: {
    x: RULES.map(r => bp(r[0])),
    x2: RULES.map(r => bp(r[1])),
    y: RULES.map(r => r[2]),
    color: RULES.map(() => abgr(PALETTE[0])),
    glyph: RULES.map(() => 0),
    row: RULES.map(() => 0),
  },
  uniforms: pointUniforms(RULE_RADIUS, 1, RULE_MIN_WIDTH),
  reference: paintOver(
    RULES.map(([x1, x2, value]) => {
      const a = px(bp(x1))
      const b = extendToMinWidthPx(a, px(bp(x2)), RULE_MIN_WIDTH)
      const cy = valueY(value)
      return {
        inside: box(
          Math.min(a, b),
          cy - RULE_RADIUS,
          Math.max(a, b),
          cy + RULE_RADIUS,
        ),
        color: rgba(PALETTE[0]),
      }
    }),
  ),
  budget: { meanErr: 0.05 },
})

// ---- span ----

interface Span {
  x: number
  x2: number
  row: number
  color: number
}

function spanFixture(
  name: string,
  about: string,
  spans: Span[],
  rowHeight: number,
  rowProportion: number,
  minCellPx: number,
  rows: 'exact' | 'device' = 'exact',
) {
  const offset = rowBandOffsetPx(rowHeight, rowProportion)
  const band = drawnRowHeightPx(rowHeight, rowProportion)
  const scene = (dpr: number) => {
    const onDevicePx = (y: number) =>
      rows === 'device' ? Math.round(y * dpr) / dpr : y
    return paintOver(
      spans.map(s => {
        const a = px(bp(s.x))
        const b = extendToMinWidthPx(a, px(bp(s.x2)), minCellPx)
        const top = offset + rowHeight * s.row
        const t = onDevicePx(top)
        const bottom = Math.max(onDevicePx(top + band), t + 1 / dpr)
        return boxShape(
          Math.min(a, b),
          t,
          Math.max(a, b),
          rows === 'device' ? bottom : top + band,
          rgba(PALETTE[s.color]!),
        )
      }),
    )
  }
  const scenes = new Map<number, ReturnType<typeof scene>>()
  return defineFixture({
    name,
    slang: `${SHADERS}/spanMark.slang`,
    about,
    mod: span,
    width: W,
    height: H,
    count: spans.length,
    instances: {
      x: spans.map(s => bp(s.x)),
      x2: spans.map(s => bp(s.x2)),
      row: spans.map(s => s.row),
      color: spans.map(s => abgr(PALETTE[s.color]!)),
    },
    uniforms: dpr => ({
      bpRangeX: BP_RANGE,
      canvasHeight: H,
      devicePixelRatio: dpr,
      minCellDenomPx: W,
      minCellPx,
      zero: 0,
      rowHeight,
      rowProportion,
      scrollTop: 0,
      rowTableKeys: -1,
      ...NO_RAMP,
    }),
    reference: (x, y, dpr) => {
      let f = scenes.get(dpr)
      if (!f) {
        f = scene(dpr)
        scenes.set(dpr, f)
      }
      return f(x, y)
    },
  })
}

const sparseSpans: Span[] = Array.from({ length: 24 }, (_, i) => {
  const x = 4.3 + ((i * 53.7) % 180)
  return {
    x,
    x2: x + (i % 4 === 0 ? 0.4 : 3.6 + ((i * 11) % 30) * 0.83),
    row: i % 8,
    color: i % 4,
  }
})

// Run-merged cells tiling each row, as MAF draws them: widths from a fifth of
// a pixel to a few, every edge shared with the next cell's.
const tilingSpans: Span[] = []
for (let row = 0; row < 10; row++) {
  let x = 0.37 * row
  let i = 0
  while (x < W) {
    const width = i % 5 === 0 ? 2.9 : 0.2 + ((i * 7 + row) % 9) * 0.13
    tilingSpans.push({ x, x2: x + width, row, color: (i + row) % 4 })
    x += width
    i++
  }
}

// ---- step line ----

// [x px, x2 px, value]; a gap after the third run drops to the origin
const WIDE_STEPS = [
  [5.4, 30.2, 20.3],
  [30.2, 61.7, 55.8],
  [61.7, 80.3, 37.15],
  [95.6, 120.1, 70.4],
  [120.1, 150.9, 70.4],
  [150.9, 160.2, 12.6],
  [160.2, 194.7, 88.3],
] as const
const STEP_ALPHA = 0.6
const ORIGIN = 0

function abuts(
  a: readonly number[] | undefined,
  b: readonly number[] | undefined,
) {
  return a !== undefined && b !== undefined && bp(a[1]!) === bp(b[0]!)
}

// Bins 0.7 to 2.1 px wide, a joint in nearly every pixel column.
function denseSteps(value: number) {
  const steps: (readonly [number, number, number])[] = []
  let x = 4.2
  let i = 0
  while (x < W - 6) {
    const width = 0.7 + ((i * 7) % 5) * 0.35
    steps.push([x, x + width, value])
    x += width
    i++
  }
  return steps
}

function stepFixture(
  lineWidth: number,
  budget: Budget,
  STEPS: readonly (readonly [number, number, number])[] = WIDE_STEPS,
  name = `mark-step-${lineWidth}px`,
) {
  const yOf = (v: number) => valueToYPxScaled(v, DOMAIN[0], DOMAIN[1], H, 0, 1)
  const prevY = STEPS.map((s, i) =>
    abuts(STEPS[i - 1], s) ? STEPS[i - 1]![2] : GAP_Y,
  )
  const nextY = STEPS.map((s, i) => (abuts(s, STEPS[i + 1]) ? s[2] : GAP_Y))
  const hw = lineWidth / 2
  const pieces: Shape['inside'][] = []
  STEPS.forEach(([x1v, x2v, v], i) => {
    const x1 = px(bp(x1v))
    const x2 = px(bp(x2v))
    const y = yOf(v)
    const prev = yOf(prevY[i] === GAP_Y ? ORIGIN : prevY[i]!)
    const next = yOf(nextY[i] === GAP_Y ? ORIGIN : nextY[i]!)
    pieces.push(
      box(x1 - hw, Math.min(prev, y) - hw, x1 + hw, Math.max(prev, y) + hw),
      box(x1 - hw, y - hw, x2 + hw, y + hw),
      box(x2 - hw, Math.min(y, next) - hw, x2 + hw, Math.max(y, next) + hw),
    )
  })
  return defineFixture({
    name,
    slang: `${SHADERS}/lineStepMark.slang`,
    about: `a ${lineWidth} px step line, translucent, its joints overlapping quads`,
    mod: lineStep,
    width: W,
    height: H,
    count: STEPS.length,
    instances: {
      x: STEPS.map(s => bp(s[0])),
      x2: STEPS.map(s => bp(s[1])),
      y: STEPS.map(s => s[2]),
      color: STEPS.map(() => abgr(PALETTE[1], STEP_ALPHA)),
      row: STEPS.map(() => 0),
      prevY,
      nextY,
    },
    uniforms: dpr => ({
      bpRangeX: BP_RANGE,
      canvasHeight: H,
      domainMin: DOMAIN[0],
      domainMax: DOMAIN[1],
      valueScaleType: 0,
      valueSymlogConstant: 1,
      ...NO_RAMP,
      colorFromY: 0,
      rowHeight: H,
      rowBandPx: H,
      rowOffsetPx: 0,
      origin: ORIGIN,
      lineWidth,
      zero: 0,
      viewportWidth: W,
      devicePixelRatio: dpr,
      rowTableKeys: -1,
    }),
    translucent: STEP_ALPHA,
    reference: paintOver([union(rgba(PALETTE[1], STEP_ALPHA), pieces)]),
    budget,
  })
}

export default [
  pointFixture(
    'mark-point',
    'disc, triangle and diamond glyphs, radius 4.2',
    4.2,
    scattered(15, 12.4, [GLYPH_DISC, GLYPH_TRIANGLE, GLYPH_DIAMOND]),
    { max: 0.5, meanErr: 0.025 },
  ),
  pointFixture(
    'mark-point-square',
    'the crisp square glyph, radius 4.2, its corner on the CSS px grid',
    4.2,
    scattered(15, 12.4, [GLYPH_SQUARE]),
    { max: 0.1, meanErr: 0.01 },
  ),
  pointFixture(
    'mark-point-small',
    'radius 1.2, where the disc draws as the crisp square',
    1.2,
    scattered(24, 7.9, [GLYPH_DISC, GLYPH_TRIANGLE, GLYPH_DIAMOND]),
    { max: 0.5, meanErr: 0.1 },
  ),
  ruleFixture,
  spanFixture(
    'mark-span-sparse',
    'sparse intervals on 8 rows, floored to 2 px, as the multi-row painter draws them',
    sparseSpans,
    7.3,
    0.8,
    2,
  ),
  spanFixture(
    'mark-span-tiling',
    'cells 0.2-3 px wide tiling 10 rows, as MAF draws them, no floor',
    tilingSpans,
    6,
    0.9,
    0,
  ),
  spanFixture(
    'mark-span-sparse-c2d',
    'mark-span-sparse against rows on device px, as the Canvas2D painter draws them',
    sparseSpans,
    7.3,
    0.8,
    2,
    'device',
  ),
  spanFixture(
    'mark-span-tiling-c2d',
    'mark-span-tiling against rows on device px, as the Canvas2D painter draws them',
    tilingSpans,
    6,
    0.9,
    0,
    'device',
  ),
  // No budgets: the step line draws flat quads at four samples, and its
  // translucent joints blend twice either way (lineStepMark.slang's header).
  stepFixture(1, {}),
  stepFixture(2, {}),
  stepFixture(1, {}, denseSteps(40.37), 'mark-step-dense-flat'),
]
