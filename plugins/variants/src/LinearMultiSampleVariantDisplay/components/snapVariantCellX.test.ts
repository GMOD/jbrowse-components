import { snapVariantCellX } from './snapVariantCellX.ts'

// `shaderSnap` is variant.slang's vertex path transliterated: clip x to px
// across the block's viewport, the snap there, and back. The viewport starts on
// a whole CSS pixel (`clampBlockScissor`), so a snap in viewport px lands on the
// canvas grid the CPU painters snap to, whatever the canvas or block width.
//
// Note the anchor is chosen from the RAW edges, not the snapped ones — a
// sub-pixel record snaps both of its edges onto one pixel, and that is every
// record at genome-wide zoom, so a fixture that compared the snapped pair would
// agree with the implementation about everything except the case that matters.
function shaderSnap(
  x1: number,
  x2: number,
  scissorX: number,
  scissorW: number,
) {
  const pxSize = 2 / scissorW
  const toClip = (px: number) => ((px - scissorX) / scissorW) * 2 - 1
  const toViewportPx = (clip: number) => clip / pxSize + scissorW / 2
  const snap = (px: number) => Math.floor(px + 0.5)
  const r1 = toViewportPx(toClip(x1))
  const r2 = toViewportPx(toClip(x2))
  const width = Math.max(2, Math.abs(snap(r2) - snap(r1)))
  const left = r2 < r1 ? snap(r1) - width : snap(r1)
  return { x: left + scissorX, width }
}

describe('snapVariantCellX', () => {
  test.each([
    [0, 800],
    [0, 801],
    [37, 423],
  ])('matches the shader over a viewport at %i, %i wide', (scissorX, w) => {
    // Fractional starts across a range of widths — the sub-pixel spans that are
    // every cell at genome-wide zoom, which is exactly where the unsnapped
    // Canvas2D path used to diverge. Run both orientations, since the anchor is
    // the half the two used to disagree about.
    for (let i = 0; i < 100; i++) {
      const a = scissorX + i * 3.7 + 0.31
      const b = a + (i % 5) * 0.4
      for (const [x1, x2] of [
        [a, b],
        [b, a],
      ] as const) {
        const got = snapVariantCellX(x1, x2)
        const want = shaderSnap(x1, x2, scissorX, w)
        expect(got.x).toBeCloseTo(want.x, 4)
        expect(got.width).toBeCloseTo(want.width, 4)
      }
    }
  })

  // The snap used to round about the canvas centre, which put every edge on a
  // half pixel when the track width was odd — about half of all window widths,
  // since the track is the view less its outline — and a half-pixel edge is
  // the blur the snap exists to remove.
  test('a cell edge is a whole pixel on an odd canvas too', () => {
    for (let i = 0; i < 50; i++) {
      const { x, width } = snapVariantCellX(i * 7.3 + 0.2, i * 7.3 + 3.9)
      expect(Number.isInteger(x)).toBe(true)
      expect(Number.isInteger(width)).toBe(true)
    }
  })

  test('a wide span is the same cell whichever way the block runs', () => {
    // The floor does nothing here, so the anchor is moot: both spellings land on
    // the leftmost snapped edge.
    expect(snapVariantCellX(100, 40)).toEqual(snapVariantCellX(40, 100))
  })

  test('a sub-pixel cell keeps the 2px visibility floor', () => {
    const { width } = snapVariantCellX(10.2, 10.3)
    expect(width).toBe(2)
  })

  test('a wide cell is not padded to the floor', () => {
    const { x, width } = snapVariantCellX(10.4, 50.6)
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
      expect(snapVariantCellX(10.2, 10.3)).toEqual({ x: 10, width: 2 })
    })

    test('reversed: the cell hangs to the left of the start', () => {
      // same record on a flipped block — start is now the RIGHT edge at 10, so
      // the cell is [8, 10). Anchoring min() would put it at [9, 11).
      expect(snapVariantCellX(10.3, 10.2)).toEqual({ x: 8, width: 2 })
    })

    test('the start edge bounds the cell in both orientations', () => {
      for (const [x1, x2] of [
        [10.2, 10.3],
        [10.3, 10.2],
        [500.6, 500.1],
      ] as const) {
        const { x, width } = snapVariantCellX(x1, x2)
        const start = Math.round(x1)
        expect(x).toBeLessThanOrEqual(start)
        expect(x + width).toBeGreaterThanOrEqual(start)
      }
    })
  })
})
