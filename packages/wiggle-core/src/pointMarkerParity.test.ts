import { crispSquareTopLeftPx } from '@jbrowse/render-core/shaders/pointGlyph'
import { SMALL_POINT_MAX_DIAMETER } from '@jbrowse/render-core/shaders/pointGlyphConsts'

import { SMALL_POINT_MAX_DIAMETER_PX } from './pointMarker.ts'

// Retirement gate for the two things `pointMarker.ts` used to keep in step with
// pointGlyph.slang by comment: the square/disc threshold (now `export-consts`)
// and the pixel-grid snap (now `js-export`). See adr-051.

// The retired snap, verbatim from appendPointMarker.
function retiredSnap(center: number, diameter: number) {
  return Math.floor(center - diameter / 2 + 0.5)
}

test('the threshold is the shader constant, not a re-typed literal', () => {
  expect(SMALL_POINT_MAX_DIAMETER_PX).toBe(SMALL_POINT_MAX_DIAMETER)
  // Pinned to its historical value too: a shader-side edit should be a
  // deliberate visual decision, not a silent one.
  expect(SMALL_POINT_MAX_DIAMETER_PX).toBe(3)
})

test('crispSquareTopLeftPx matches the hand-written snap it replaced', () => {
  for (let d = 1; d <= 6; d++) {
    for (let c = 0; c <= 200; c++) {
      const center = c / 4
      expect(crispSquareTopLeftPx(center, d)).toBe(retiredSnap(center, d))
    }
  }
})

test('the snapped square lands on whole pixels at every sub-pixel center', () => {
  // The property the snap exists for: an unsnapped top-left AA-blurs the square
  // across two columns and it reads as a blob rather than a crisp point.
  // `% 1` would be -0 for a negative result and fail Object.is against 0, which
  // says nothing about integrality — ask the question directly.
  for (let c = -40; c <= 40; c++) {
    expect(Number.isInteger(crispSquareTopLeftPx(c / 8, 3))).toBe(true)
  }
})
