import { snapVariantCellX } from './snapVariantCellX.ts'

// `shaderSnap` is variant.slang transliterated back into clip space — the
// coordinate system the snap actually happens in on the GPU, and the one the
// px-space `//! js-export` (adr-051) has to agree with exactly. So this is both
// the retirement gate for the hand-written snapVariantCellX and the proof that
// the px-space factoring did not move a pixel: clip and px round-trip exactly
// here, since the half-canvas offset is an integer well inside float32's exact
// range.
//
// Note the anchor is chosen from the RAW clip edges, not the snapped ones — a
// sub-pixel record snaps both of its edges onto one pixel, and that is every
// record at genome-wide zoom, so a fixture that compared the snapped pair would
// agree with the implementation about everything except the case that matters.
function shaderSnap(x1: number, x2: number, canvasWidth: number) {
  const toClip = (px: number) => (px / canvasWidth) * 2 - 1
  const toPx = (clip: number) => ((clip + 1) / 2) * canvasWidth
  const pxSize = 2 / canvasWidth
  const snap = (clip: number) => Math.floor(clip / pxSize + 0.5) * pxSize
  const c1 = toClip(x1)
  const c2 = toClip(x2)
  const width = Math.max(2 * pxSize, Math.abs(snap(c2) - snap(c1)))
  const left = c2 < c1 ? snap(c1) - width : snap(c1)
  return { x: toPx(left), width: toPx(left + width) - toPx(left) }
}

describe('snapVariantCellX', () => {
  test.each([800, 801])('matches the shader at canvasWidth %i', width => {
    // Fractional starts across a range of widths — the sub-pixel spans that are
    // every cell at genome-wide zoom, which is exactly where the unsnapped
    // Canvas2D path used to diverge. Run both orientations, since the anchor is
    // the half the two used to disagree about.
    for (let i = 0; i < 200; i++) {
      const a = i * 3.7 + 0.31
      const b = a + (i % 5) * 0.4
      for (const [x1, x2] of [
        [a, b],
        [b, a],
      ] as const) {
        const got = snapVariantCellX(x1, x2, width)
        const want = shaderSnap(x1, x2, width)
        expect(got.x).toBeCloseTo(want.x, 6)
        expect(got.width).toBeCloseTo(want.width, 6)
      }
    }
  })

  test('a wide span is the same cell whichever way the block runs', () => {
    // The floor does nothing here, so the anchor is moot: both spellings land on
    // the leftmost snapped edge.
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

  // The reversed-block family (`spanLeft`, `extendToMinWidthPx`): a mark widened
  // to a floor grows *away from the record's start*, and on a flipped block the
  // start is the right edge. Anchoring the leftmost edge instead is identical
  // forward and slides every sub-pixel cell a full 2px toward the block's end
  // when reversed — which is where the ruler, and the same VCF in a
  // LinearVariantDisplay beside it, are not.
  describe('the 2px floor grows away from the record start', () => {
    test('forward: the cell hangs to the right of the start', () => {
      // start snaps to 10, end is under a pixel past it
      expect(snapVariantCellX(10.2, 10.3, 800)).toEqual({ x: 10, width: 2 })
    })

    test('reversed: the cell hangs to the left of the start', () => {
      // same record on a flipped block — start is now the RIGHT edge at 10, so
      // the cell is [8, 10). Anchoring min() would put it at [9, 11).
      expect(snapVariantCellX(10.3, 10.2, 800)).toEqual({ x: 8, width: 2 })
    })

    test('the start edge bounds the cell in both orientations', () => {
      for (const [x1, x2] of [
        [10.2, 10.3],
        [10.3, 10.2],
        [500.6, 500.1],
      ] as const) {
        const { x, width } = snapVariantCellX(x1, x2, 800)
        const start = Math.round(x1)
        expect(x).toBeLessThanOrEqual(start)
        expect(x + width).toBeGreaterThanOrEqual(start)
      }
    })
  })
})
