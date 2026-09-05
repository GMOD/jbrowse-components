import {
  extendToMinWidthPx,
  snapBoxCenterYPx,
  snapBoxHeightPx,
  snapBoxTopPx,
} from '@jbrowse/render-core/shaders/hpmath'

const THIN_BOX_PX = 4

function retiredBoxHeightPx(heightPx: number) {
  const hPx = Math.floor(heightPx + 0.5)
  return hPx % 2 === 0 && hPx >= 2 && hPx <= THIN_BOX_PX ? hPx + 1 : hPx
}

function retiredMinWidth(x1: number, x2: number, minWidth: number) {
  const width = Math.max(minWidth, Math.abs(x2 - x1))
  return x2 < x1 ? x1 - width : x1 + width
}

// Quarter-pixel steps across the range a feature height can take, so the
// even/odd nudge boundary is crossed from both sides.
const HEIGHTS = Array.from({ length: 129 }, (_, i) => i * 0.25)

test('snapBoxHeightPx matches the hand-written twin it replaced', () => {
  for (const h of HEIGHTS) {
    expect(snapBoxHeightPx(h)).toBe(retiredBoxHeightPx(h))
  }
})

test('a thin box is drawn at an odd height so it has a center row', () => {
  // Without the nudge a 2px body puts its intron line on the box's bottom row
  // and the exons read as floating above it.
  for (const h of [2, 3, 4]) {
    expect(snapBoxHeightPx(h) % 2).toBe(1)
  }
  expect(snapBoxHeightPx(0)).toBe(0)
  expect(snapBoxHeightPx(0.4)).toBe(0)
  expect(snapBoxHeightPx(6)).toBe(6)
  expect(snapBoxHeightPx(20)).toBe(20)
})

test('a glyph centers on the middle row of the box the rect shader draws', () => {
  for (const h of HEIGHTS) {
    for (const centerY of [0, 0.5, 1, 7.25, 100.5, 1000.75]) {
      for (const scrollY of [0, 0.5, 13, 250.25]) {
        const topPx = snapBoxTopPx(centerY - h / 2, h, scrollY)
        expect(snapBoxCenterYPx(centerY, h, scrollY)).toBe(
          topPx + Math.floor(snapBoxHeightPx(h) / 2) + 0.5,
        )
      }
    }
  }
})

test('a shrunken box stays inside the row it was centered in', () => {
  for (const rowHeight of [10, 6, 3, 5, 2.1, 4.5]) {
    for (const rowTop of [0, 20, 20.4, 33.5]) {
      const shrunkHeight = rowHeight * 0.65
      const rowDrawnTop = snapBoxTopPx(rowTop, rowHeight, 0)
      const rowDrawnBottom = rowDrawnTop + snapBoxHeightPx(rowHeight)
      const shrunkTop = snapBoxTopPx(
        rowTop + ((1 - 0.65) / 2) * rowHeight,
        shrunkHeight,
        0,
      )
      const shrunkBottom = shrunkTop + snapBoxHeightPx(shrunkHeight)
      expect(shrunkTop).toBeGreaterThanOrEqual(rowDrawnTop)
      expect(shrunkBottom).toBeLessThanOrEqual(rowDrawnBottom)
    }
  }
})

test('the glyph center lands on a pixel center, at every height', () => {
  // Thin glyphs are 1px strokes, so a center on x.0 straddles two rows and
  // renders 2px soft.
  for (const h of HEIGHTS) {
    expect(snapBoxCenterYPx(37.5, h, 0) % 1).toBe(0.5)
  }
})

test('extendToMinWidthPx matches the max(floor, |dx|) spelling it replaced', () => {
  for (const x1 of [0, 10, 10.5, 400]) {
    for (const dx of [-9, -2.5, -1, -0.4, 0, 0.4, 1, 2.5, 9]) {
      const x2 = extendToMinWidthPx(x1, x1 + dx, 2)
      expect(x2).toBe(retiredMinWidth(x1, x1 + dx, 2))
    }
  }
})

test('widening grows away from the anchor, so reversed spans stay anchored', () => {
  expect(extendToMinWidthPx(100, 100.3, 2)).toBe(102)
  // On a reversed span x1 is still the feature's START, its right edge, so the
  // span grows leftward; anchoring the leftmost edge would slide the mark a full
  // min-width on flipped regions only.
  expect(extendToMinWidthPx(100, 99.7, 2)).toBe(98)
  expect(extendToMinWidthPx(100, 110, 2)).toBe(110)
  expect(extendToMinWidthPx(100, 90, 2)).toBe(90)
})
