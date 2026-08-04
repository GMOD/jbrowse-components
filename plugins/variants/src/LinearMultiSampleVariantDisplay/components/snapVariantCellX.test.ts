import { snapVariantCellX } from './snapVariantCellX.ts'

// `shaderSnap` is the shader as it was *before* the snap moved into px space to
// be `//! js-export`ed (adr-051): the original clip-space rounding, kept as the
// fixture. So this is both the retirement gate for the hand-written
// snapVariantCellX and the proof that the px-space factoring did not move a
// pixel — clip and px round-trip exactly here, since the half-canvas offset is
// an integer well inside float32's exact range.
function shaderSnap(x1: number, x2: number, canvasWidth: number) {
  const toClip = (px: number) => (px / canvasWidth) * 2 - 1
  const toPx = (clip: number) => ((clip + 1) / 2) * canvasWidth
  const loClip = Math.min(toClip(x1), toClip(x2))
  const hiClip = Math.max(toClip(x1), toClip(x2))
  const pxSize = 2 / canvasWidth
  const cx1 = Math.floor(loClip / pxSize + 0.5) * pxSize
  const cx2 = Math.max(
    Math.floor(hiClip / pxSize + 0.5) * pxSize,
    cx1 + 2 * pxSize,
  )
  return { x: toPx(cx1), width: toPx(cx2) - toPx(cx1) }
}

describe('snapVariantCellX', () => {
  test.each([800, 801])('matches the shader at canvasWidth %i', width => {
    // Fractional starts across a range of widths — the sub-pixel spans that are
    // every cell at genome-wide zoom, which is exactly where the unsnapped
    // Canvas2D path used to diverge.
    for (let i = 0; i < 200; i++) {
      const x1 = i * 3.7 + 0.31
      const x2 = x1 + (i % 5) * 0.4
      const got = snapVariantCellX(x1, x2, width)
      const want = shaderSnap(x1, x2, width)
      expect(got.x).toBeCloseTo(want.x, 6)
      expect(got.width).toBeCloseTo(want.width, 6)
    }
  })

  test('reversed blocks hand back swapped edges', () => {
    expect(snapVariantCellX(100, 40, 800)).toEqual(
      snapVariantCellX(40, 100, 800),
    )
  })

  test('a sub-pixel cell keeps the 2px visibility floor', () => {
    const { width } = snapVariantCellX(10.2, 10.3, 800)
    expect(width).toBe(2)
  })

  test('a wide cell is not padded to the floor', () => {
    const { x, width } = snapVariantCellX(10.4, 50.6, 800)
    expect(x).toBe(10)
    expect(width).toBe(41)
  })
})
