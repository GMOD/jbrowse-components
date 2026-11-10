// An indel is a wedge that narrows to nothing at one end. This integrates the
// fill fragment's coverage over one and compares it with the wedge's true
// area, which is what a Canvas2D path fill lays down for the same shape.
import { aaRamp } from '@jbrowse/render-core/shaders/antialias'

import { KIND_CIGAR_D } from '../../LinearSyntenyRPC/syntenyKinds.ts'
import { sBlend, thinWidthFade } from './syntenyTypes.js.generated.ts'

const HEIGHT = 100
const STEP = 0.02

const sBlendDeriv = (t: number) => 6 * t * (1 - t)
const yCurveDeriv = (t: number) => 1.5 - 3 * t + 3 * t * t

function curveParamAtY(yFrac: number) {
  const half = (yFrac - 0.5) / 2
  const root = Math.sqrt(half * half + 1 / 64)
  return 0.5 + Math.cbrt(half + root) + Math.cbrt(half - root)
}

interface Wedge {
  widthPx: number
  shearPx: number
  curve: boolean
}

function wedgeInk({ widthPx, shearPx, curve }: Wedge, taper: boolean) {
  const x1 = 100
  const x2 = 100 + widthPx
  const tip = 100 + shearPx
  let drawn = 0
  let area = 0
  for (let row = 0; row < HEIGHT; row++) {
    const yFrac = (row + 0.5) / HEIGHT
    const t = curve ? curveParamAtY(yFrac) : yFrac
    const s = curve ? sBlend(t) : t
    const slopeScale = curve
      ? sBlendDeriv(t) / (HEIGHT * yCurveDeriv(t))
      : 1 / HEIGHT
    const xL = x1 + (tip - x1) * s
    const xR = x2 + (tip - x2) * s
    const pfL = Math.hypot(1, (tip - x1) * slopeScale)
    const pfR = Math.hypot(1, (tip - x2) * slopeScale)
    const perpW = (xR - xL) / (0.5 * (pfL + pfR))
    const expand = Math.max(0.5 - 0.5 * perpW, 0)
    const fade = taper ? thinWidthFade(perpW, KIND_CIGAR_D, false) : 1
    for (let x = xL - 3 * pfL; x < xR + 3 * pfR; x += STEP) {
      drawn +=
        aaRamp((x - xL) / pfL + expand, 1) *
        aaRamp((xR - x) / pfR + expand, 1) *
        fade *
        STEP
    }
    area += xR - xL
  }
  return drawn / area
}

const wedges: Wedge[] = [false, true].flatMap(curve =>
  [0.4, 1.5, 4, 16].flatMap(widthPx =>
    [0, 200].map(shearPx => ({ widthPx, shearPx, curve })),
  ),
)

test.each(wedges)('an indel wedge inks its own area: %o', wedge => {
  expect(wedgeInk(wedge, true)).toBeCloseTo(1, 1)
})

test('held at full strength, the 1px minimum band over-inks the tip', () => {
  expect(
    wedgeInk({ widthPx: 4, shearPx: 200, curve: true }, false),
  ).toBeGreaterThan(1.4)
  expect(
    wedgeInk({ widthPx: 4, shearPx: 200, curve: false }, false),
  ).toBeGreaterThan(1.25)
})
