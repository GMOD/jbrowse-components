import { crispSquareTopLeftPx } from '../../../packages/render-core/src/shaders/pointGlyph.js.generated.ts'
import { RENDERING_TYPE_SCATTER } from '../../../packages/wiggle-core/src/wiggleRenderModes.generated.ts'
import * as wiggle from '../../../plugins/wiggle/src/shared/shaders/wiggle.generated.ts'
import { abgr, box, defineFixture, paintOver, rgba } from '../fixture.ts'

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

const points = Array.from({ length: 30 }, (_, i) => ({
  start: bp(4.3 + i * 6.4 + ((i * 7) % 3) * 0.37),
  score: 6.4 + ((i * 37) % 86) + 0.31 * i,
}))
const color = (i: number) => PALETTE[i % PALETTE.length]!

// The scatter's small-point square: the shape `pointMark` draws through the same
// kernel, so the two displays agree on it.
export default [
  defineFixture({
    name: 'wiggle-scatter-square',
    slang: 'plugins/wiggle/src/shared/shaders/wiggle.slang',
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
    uniforms: (dpr: number) => ({
      bpRangeX: [START, 0, W * BP_PER_PX] as [number, number, number],
      canvasHeight: H,
      scaleType: 0,
      renderingType: RENDERING_TYPE_SCATTER,
      numRows: 1,
      domainYMin: 0,
      domainYMax: 100,
      zero: 0,
      viewportWidth: W,
      diameterPx: DIAMETER,
      lineWidth: 1,
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
    }),
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
]
