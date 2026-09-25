import * as linkGlsl from './linkMark.glsl.generated.ts'
import { linkValuePx } from './linkMark.js.generated.ts'
import * as linkWgsl from './linkMark.wgsl.generated.ts'
import * as pointGlsl from './pointMark.glsl.generated.ts'
import { pointYPx } from './pointMark.js.generated.ts'
import * as pointWgsl from './pointMark.wgsl.generated.ts'
import { SCALE_TYPE_LOG, SCALE_TYPE_SYMLOG } from './scoreScale.generated.ts'

// `valueScale.slang`'s `insetValueYPx` — the value scale over a range inset at
// both ends — with the two anchors its consumers add. A point measures down
// from the top of its row band, a link measures up from the band's baseline,
// so the two are reflections of one number and were two open-coded copies of
// it until they shared one.

const HEIGHTS = [8, 12, 20, 40, 100]
const INSETS = [0, 1, 2.5, 5, 9]
const DOMAINS: [number, number][] = [
  [0, 1],
  [-1, 1],
  [0, 100],
  [1, 1024],
  [0.01, 0.5],
  [5, 5],
]
const SCALES = [0, SCALE_TYPE_LOG, SCALE_TYPE_SYMLOG]

test('a link measures the same value up that a point measures down', () => {
  for (const h of HEIGHTS) {
    for (const insetPx of INSETS) {
      for (const [min, max] of DOMAINS) {
        for (const scale of SCALES) {
          for (const v of [min, max, (min + max) / 2, min - 1, max + 1, 0.02]) {
            expect(linkValuePx(v, min, max, h, scale, insetPx, 1)).toBeCloseTo(
              h - pointYPx(v, min, max, h, scale, insetPx, 1),
              9,
            )
          }
        }
      }
    }
  }
})

// The half-height clamp, which is the part of this that is not obvious. A band
// shorter than its two insets has no range left, and without the clamp the
// range goes negative and the scale runs backwards — an edge value drawn on
// the wrong side of the plot rather than merely squeezed.
test('a band shorter than two insets collapses to its midline, never inverts', () => {
  for (const scale of SCALES) {
    expect(pointYPx(0, 0, 100, 8, scale, 5, 1)).toBe(4)
    expect(pointYPx(100, 0, 100, 8, scale, 5, 1)).toBe(4)
    expect(linkValuePx(0, 0, 100, 8, scale, 5, 1)).toBe(4)
    expect(linkValuePx(100, 0, 100, 8, scale, 5, 1)).toBe(4)
  }
})

// The numbers above pin what the inset scale is. This pins that both shapes
// reach it on both backends — a shared function nothing calls is how the two
// copies drifted apart unnoticed before.
test.each([
  ['pointMark', pointWgsl.WGSL_SOURCE, pointGlsl.GLSL_VERTEX],
  ['linkMark', linkWgsl.WGSL_SOURCE, linkGlsl.GLSL_VERTEX],
])('%s reads the shared inset scale on every backend', (_name, wgsl, glsl) => {
  for (const src of [wgsl, glsl]) {
    expect(src).toContain('insetValueYPx_0(')
  }
})
