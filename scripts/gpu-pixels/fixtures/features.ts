import {
  snapBoxCenterYPx,
  snapBoxHeightPx,
  snapBoxTopPx,
} from '../../../packages/render-core/src/shaders/hpmath.js.generated.ts'
import * as arrow from '../../../plugins/features/src/LinearBasicDisplay/passes/shaders/arrow.generated.ts'
import { arrowHeadHalfHeightPx } from '../../../plugins/features/src/LinearBasicDisplay/passes/shaders/arrow.js.generated.ts'
import * as rect from '../../../plugins/features/src/LinearBasicDisplay/passes/shaders/rect.generated.ts'
import { rectSpanPx } from '../../../plugins/features/src/LinearBasicDisplay/passes/shaders/rect.js.generated.ts'
import { abgr, box, defineFixture, paintOver, rgba } from '../fixture.ts'

const SHADERS = 'plugins/features/src/LinearBasicDisplay/passes/shaders'
const W = 200
const H = 48
const START = 1000
const BP_PER_PX = 1.37
const bp = (px: number) => Math.round(START + px * BP_PER_PX)
const px = (b: number) => (b - START) / BP_PER_PX

const uniforms = (dpr: number) => ({
  bpRangeX: [START, 0, W * BP_PER_PX] as [number, number, number],
  canvasHeight: H,
  canvasWidth: W,
  scrollY: 0,
  bpPerPx: BP_PER_PX,
  zero: 0,
  reversed: 0,
  outlineColor: 0,
  leftIsCanvasEdge: 1,
  rightIsCanvasEdge: 1,
  devicePixelRatio: dpr,
})

// [left px, right px, top px, height px]: sub-pixel ends, odd and thin heights
const RECTS = [
  [3.3, 40.6, 2.2, 9],
  [50.4, 51.1, 4.7, 10],
  [60.6, 120.2, 16.5, 3],
  [130.1, 190.7, 24.2, 7.4],
  [12.8, 98.3, 36.6, 11],
] as const
const DARK = [51, 51, 51] as const

const rectFixture = defineFixture({
  name: 'features-rect',
  slang: `${SHADERS}/rect.slang`,
  about:
    'feature boxes, edges snapped to CSS px, ramped where they miss the device grid',
  mod: rect,
  width: W,
  height: H,
  count: RECTS.length,
  instances: {
    startEnd: RECTS.flatMap(r => [bp(r[0]), bp(r[1])]),
    y: RECTS.map(r => r[2]),
    height: RECTS.map(r => r[3]),
    color: RECTS.map(() => abgr(DARK)),
    densityFade: RECTS.map(() => 0),
    strand: RECTS.map(() => 1),
  },
  uniforms,
  reference: paintOver(
    RECTS.map(([l, r, y, h]) => {
      const [left, right] = rectSpanPx(px(bp(l)), px(bp(r)), false)
      const top = snapBoxTopPx(y, h, 0)
      return {
        inside: box(left, top, right, top + snapBoxHeightPx(h)),
        color: rgba(DARK),
      }
    }),
  ),
  budget: { max: 0.02, meanErr: 0.002 },
})

// [root px, center y px, direction, box height px]
const ARROWS = [
  [20.3, 8.6, 1, 10],
  [70.8, 20.3, -1, 10],
  [110.4, 32.5, 1, 6],
  [160.7, 40.9, -1, 12],
] as const
const ARROW_ALPHA = 0.5
const STEM_END = 3.5
const LENGTH = 7

const arrowFixture = defineFixture({
  name: 'features-arrow',
  slang: `${SHADERS}/arrow.slang`,
  about: 'strand arrows, stem and head in one quad, drawn translucent',
  mod: arrow,
  width: W,
  height: H,
  count: ARROWS.length,
  instances: {
    x: ARROWS.map(a => bp(a[0])),
    y: ARROWS.map(a => a[1]),
    direction: ARROWS.map(a => a[2]),
    color: ARROWS.map(() => abgr(DARK, ARROW_ALPHA)),
    height: ARROWS.map(a => a[3]),
    widthBp: ARROWS.map(() => 200),
    gene: ARROWS.map(() => 1),
  },
  uniforms,
  translucent: ARROW_ALPHA,
  reference: paintOver(
    ARROWS.map(([root, y, dir, h]) => {
      const cx = px(bp(root))
      const cy = snapBoxCenterYPx(y, 0)
      const head = arrowHeadHalfHeightPx(h)
      return {
        color: rgba(DARK, ARROW_ALPHA),
        inside: (x: number, yy: number) => {
          const along = (x - cx) * dir
          const across = Math.abs(yy - cy)
          return (
            (along >= 0 && along <= STEM_END && across <= 0.5) ||
            (along >= STEM_END &&
              along <= LENGTH &&
              across <= (head * (LENGTH - along)) / STEM_END)
          )
        },
      }
    }),
  ),
  budget: { max: 0.18, meanErr: 0.085, twice: 0, holes: 0 },
})

export default [rectFixture, arrowFixture]
