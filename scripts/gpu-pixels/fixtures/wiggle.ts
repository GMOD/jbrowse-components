import { extendToMinWidthPx } from '../../../packages/render-core/src/shaders/hpmath.js.generated.ts'
import { crispSquareTopLeftPx } from '../../../packages/render-core/src/shaders/pointGlyph.js.generated.ts'
import { valueToYPxUnclamped } from '../../../packages/render-core/src/shaders/valueScale.js.generated.ts'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
} from '../../../packages/wiggle-core/src/wiggleRenderModes.generated.ts'
import * as wiggle from '../../../plugins/wiggle/src/shared/shaders/wiggle.generated.ts'
import { MIN_FILL_WIDTH_PX } from '../../../plugins/wiggle/src/shared/shaders/wiggleCommon.generated.ts'
import * as wiggleDensity from '../../../plugins/wiggle/src/shared/shaders/wiggleDensity.generated.ts'
import * as wiggleLine from '../../../plugins/wiggle/src/shared/shaders/wiggleLine.generated.ts'
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

const W = 200
const H = 60
const START = 20000
const BP_PER_PX = 3.7
const bp = (px: number) => Math.round(START + px * BP_PER_PX)
const px = (b: number) => (b - START) / BP_PER_PX
const DIAMETER = 2.6

const zero4: [number, number, number, number] = [0, 0, 0, 0]
const PALETTE = [
  [31, 119, 180],
  [214, 39, 40],
  [44, 160, 44],
] as const
const SLANG = 'plugins/wiggle/src/shared/shaders'
const DOMAIN = [0, 100] as const

const color = (i: number) => PALETTE[i % PALETTE.length]!
const scoreY = (score: number, rowTop: number, rowHeight: number) =>
  rowTop + valueToYPxUnclamped(score, DOMAIN[0], DOMAIN[1], rowHeight, 0, 1)

function uniforms(
  renderingType: number,
  dpr: number,
  { numRows = 1, lineWidth = 1 } = {},
) {
  return {
    bpRangeX: [START, 0, W * BP_PER_PX] as [number, number, number],
    canvasHeight: H,
    scaleType: 0,
    renderingType,
    numRows,
    domainYMin: DOMAIN[0],
    domainYMax: DOMAIN[1],
    zero: 0,
    viewportWidth: W,
    diameterPx: DIAMETER,
    lineWidth,
    origin: 0,
    rampMidNorm: 0.5,
    symlogConstant: 1,
    devicePixelRatio: dpr,
    rampLut: 0,
    numCuts: 0,
    cuts: [zero4, zero4] as [typeof zero4, typeof zero4],
    innerColor: [zero4, zero4, zero4, zero4, zero4, zero4, zero4] as [
      typeof zero4,
      typeof zero4,
      typeof zero4,
      typeof zero4,
      typeof zero4,
      typeof zero4,
      typeof zero4,
    ],
  }
}

const points = Array.from({ length: 30 }, (_, i) => ({
  start: bp(4.3 + i * 6.4 + ((i * 7) % 3) * 0.37),
  score: 6.4 + ((i * 37) % 86) + 0.31 * i,
}))

// Abutting bins from 0.6 to 6.1 px wide, so some fall under the min-width floor
// and overlap their neighbour, as a bigwig at a fractional zoom does.
function tilingBins(rows: number) {
  const startEnd: number[] = []
  const score: number[] = []
  const rowIndex: number[] = []
  for (let r = 0; r < rows; r++) {
    let x = 3.3 + r * 0.45
    let i = 0
    while (x < W - 8) {
      const width = 0.6 + ((i * 13 + r * 5) % 12) * 0.47
      startEnd.push(bp(x), bp(x + width))
      score.push(Math.min(99, 4.2 + ((i * 29 + r * 11) % 91) + 0.17 * i))
      rowIndex.push(r)
      x += width
      i++
    }
  }
  return { startEnd, score, rowIndex, count: rowIndex.length }
}

function binBox(startEnd: readonly number[], i: number) {
  const x1 = px(startEnd[i * 2]!)
  return [
    x1,
    extendToMinWidthPx(x1, px(startEnd[i * 2 + 1]!), MIN_FILL_WIDTH_PX),
  ]
}

const bars = tilingBins(1)
const DENSITY_ROWS = 7
const density = tilingBins(DENSITY_ROWS)

// [x px, x2 px, score]: three runs, a gap to the origin, then two more
const WIDE_STEPS: Step[] = [
  [5.4, 30.2, 20.3],
  [30.2, 61.7, 55.8],
  [61.7, 80.3, 37.15],
  [95.6, 120.1, 70.4],
  [120.1, 150.9, 70.4],
  [150.9, 160.2, 12.6],
  [160.2, 194.7, 88.3],
]
const ORIGIN = 0

type Step = [number, number, number]

// Bins 0.7 to 2.1 px wide, a joint in nearly every pixel column, as a bigwig
// zoomed out draws.
function denseSteps(score: (i: number) => number) {
  const steps: Step[] = []
  let x = 4.2
  let i = 0
  while (x < W - 6) {
    const width = 0.7 + ((i * 7) % 5) * 0.35
    steps.push([x, x + width, score(i)])
    x += width
    i++
  }
  return steps
}

function stepFixture(
  name: string,
  about: string,
  steps: Step[],
  lineWidth: number,
  budget: Budget,
) {
  const abuts = (i: number, j: number) =>
    steps[i] !== undefined &&
    steps[j] !== undefined &&
    bp(steps[i][1]) === bp(steps[j][0])
  const prev = steps.map((_, i) =>
    abuts(i - 1, i) ? steps[i - 1]![2] : ORIGIN,
  )
  const next = steps.map((s, i) => (abuts(i, i + 1) ? s[2] : ORIGIN))
  const hw = lineWidth / 2
  const pieces: Shape['inside'][] = []
  steps.forEach(([x1v, x2v, v], i) => {
    const x1 = px(bp(x1v))
    const x2 = px(bp(x2v))
    const y = scoreY(v, 0, H)
    const yp = scoreY(prev[i]!, 0, H)
    const yn = scoreY(next[i]!, 0, H)
    pieces.push(
      box(x1 - hw, Math.min(yp, y) - hw, x1 + hw, Math.max(yp, y) + hw),
      box(x1 - hw, y - hw, x2 + hw, y + hw),
      box(x2 - hw, Math.min(y, yn) - hw, x2 + hw, Math.max(y, yn) + hw),
    )
  })
  return defineFixture({
    name,
    slang: `${SLANG}/wiggleLine.slang`,
    about,
    mod: wiggleLine,
    width: W,
    height: H,
    count: steps.length,
    instances: {
      startEnd: steps.flatMap(s => [bp(s[0]), bp(s[1])]),
      score: steps.map(s => s[2]),
      prevScore: prev,
      nextScore: next,
      color: steps.map(() => abgr(PALETTE[1])),
      rowIndex: steps.map(() => 0),
      negColor: steps.map(() => abgr(PALETTE[1])),
    },
    uniforms: (dpr: number) =>
      uniforms(RENDERING_TYPE_LINE, dpr, { lineWidth }),
    reference: paintOver([union(rgba(PALETTE[1]), pieces)]),
    budget,
  })
}

export default [
  // The scatter's small-point square: the shape `pointMark` draws through the
  // same kernel, so the two displays agree on it.
  defineFixture({
    name: 'wiggle-scatter-square',
    slang: `${SLANG}/wiggle.slang`,
    about: `wiggle scatter points ${DIAMETER} px across, drawn as the small-point square`,
    mod: wiggle,
    width: W,
    height: H,
    count: points.length,
    instances: {
      startEnd: points.flatMap(p => [p.start, p.start]),
      score: points.map(p => p.score),
      color: points.map((_, i) => abgr(color(i))),
      rowIndex: points.map(() => 0),
    },
    uniforms: (dpr: number) => uniforms(RENDERING_TYPE_SCATTER, dpr),
    reference: paintOver(
      points.map((p, i) => {
        const left = crispSquareTopLeftPx(px(p.start), DIAMETER)
        const top = crispSquareTopLeftPx((1 - p.score / 100) * H, DIAMETER)
        return {
          inside: box(left, top, left + DIAMETER, top + DIAMETER),
          color: rgba(color(i)),
        }
      }),
    ),
    // A 2.6 px square is mostly edge, where the 8x8 supersampled reference
    // departs from the exact area the shader inks.
    budget: { max: 0.1, meanErr: 0.025 },
  }),
  defineFixture({
    name: 'wiggle-xyplot-bars',
    slang: `${SLANG}/wiggle.slang`,
    about:
      'abutting xyplot bars 0.6 to 6.1 px wide in three colors, the narrow ones floored',
    mod: wiggle,
    width: W,
    height: H,
    count: bars.count,
    instances: {
      startEnd: bars.startEnd,
      score: bars.score,
      color: bars.rowIndex.map((_, i) => abgr(color(i))),
      rowIndex: bars.rowIndex,
    },
    uniforms: (dpr: number) => uniforms(RENDERING_TYPE_XYPLOT, dpr),
    reference: paintOver(
      bars.rowIndex.map((_, i) => {
        const [left, right] = binBox(bars.startEnd, i)
        return boxShape(
          left!,
          scoreY(bars.score[i]!, 0, H),
          right!,
          H,
          rgba(color(i)),
        )
      }),
    ),
  }),
  defineFixture({
    name: 'wiggle-density',
    slang: `${SLANG}/wiggleDensity.slang`,
    about: `${DENSITY_ROWS} density rows ${(H / DENSITY_ROWS).toFixed(2)} px tall of abutting bins 0.6 to 6.1 px wide`,
    mod: wiggleDensity,
    width: W,
    height: H,
    count: density.count,
    instances: {
      startEnd: density.startEnd,
      score: density.score,
      color: density.rowIndex.map((r, i) => abgr(color(i + r))),
      rowIndex: density.rowIndex,
    },
    uniforms: (dpr: number) =>
      uniforms(RENDERING_TYPE_DENSITY, dpr, { numRows: DENSITY_ROWS }),
    reference: paintOver(
      density.rowIndex.map((r, i) => {
        const [left, right] = binBox(density.startEnd, i)
        const rowHeight = H / DENSITY_ROWS
        return boxShape(
          left!,
          r * rowHeight,
          right!,
          (r + 1) * rowHeight,
          rgba(color(i + r)),
        )
      }),
    ),
  }),
  stepFixture(
    'wiggle-step-1px',
    "wiggle's 1 px step line over wide bins, opaque",
    WIDE_STEPS,
    1,
    { meanErr: 0.075 },
  ),
  stepFixture(
    'wiggle-step-2px',
    "wiggle's 2 px step line over wide bins, opaque",
    WIDE_STEPS,
    2,
    { meanErr: 0.05 },
  ),
  // Every joint is up to four overlapping quads; under src-over their edge
  // pixels composite 1-(1-a)^4 and the line beads.
  stepFixture(
    'wiggle-step-dense-flat',
    'a 1 px step line over 0.7 to 2.1 px bins at one score',
    denseSteps(() => 40.37),
    1,
    {},
  ),
  stepFixture(
    'wiggle-step-dense-varied',
    'a 1 px step line over 0.7 to 2.1 px bins of varied scores',
    denseSteps(i => 30 + ((i * 17) % 23) * 1.3),
    1,
    {},
  ),
]
