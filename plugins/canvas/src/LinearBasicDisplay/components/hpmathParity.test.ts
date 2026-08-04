import {
  extendToMinWidthPx,
  snapBoxCenterYPx,
  snapBoxHeightPx,
} from '@jbrowse/render-core/shaders/hpmath'

// The retirement gate for adr-051's first `//! js-export` set.
//
// These three functions were hand-written twins of hpmath.slang living in
// Canvas2DFeatureRenderer / canvas2dUtils, kept in step by comment. They are now
// transliterated from the shader's own WGSL by `pnpm gen:shaders`. The
// implementations below are the *retired originals*, verbatim — this file exists
// to prove the generated pair reproduces them before the hand-written ones stop
// being reviewed, and it is the pattern any future js-export set should copy:
// keep the twin as a fixture, sweep, then delete the twin, not the test.
//
// Sweeps favour the inputs where these historically broke: the 2-5px thin-box
// range that fit mode squeezes down to, half-pixel feature tops, zero, and
// reversed spans (x2 < x1), which only ever misbehave on flipped regions and so
// survive casual review.

const THIN_BOX_PX = 4

function retiredBoxHeightPx(heightPx: number) {
  const hPx = Math.floor(heightPx + 0.5)
  return hPx % 2 === 0 && hPx >= 2 && hPx <= THIN_BOX_PX ? hPx + 1 : hPx
}

function retiredBoxCenterY(centerY: number, heightPx: number, scrollY: number) {
  const topPx = Math.floor(centerY - heightPx / 2 - scrollY + 0.5)
  const hPx = retiredBoxHeightPx(heightPx)
  return topPx + Math.floor(hPx / 2) + 0.5
}

// The `max(floor, |dx|)` spelling drawRects used before it called the shader's
// widening rule directly.
function retiredMinWidth(x1: number, x2: number, minWidth: number) {
  const width = Math.max(minWidth, Math.abs(x2 - x1))
  return x2 < x1 ? x1 - width : x1 + width
}

// Quarter-pixel steps through the whole range a feature height can take, so the
// even/odd nudge boundary at 2 and 4 is crossed from both sides.
const HEIGHTS = Array.from({ length: 129 }, (_, i) => i * 0.25)

test('snapBoxHeightPx matches the hand-written twin it replaced', () => {
  for (const h of HEIGHTS) {
    expect(snapBoxHeightPx(h)).toBe(retiredBoxHeightPx(h))
  }
})

test('a thin box is drawn at an odd height so it has a center row', () => {
  // The property the nudge exists for, asserted directly rather than only
  // through the twin: without it a 2px body puts its intron line on the box's
  // bottom row and the exons read as floating above the line.
  for (const h of [2, 3, 4]) {
    expect(snapBoxHeightPx(h) % 2).toBe(1)
  }
  // A zero-height box stays zero — it draws nothing, which is what was asked.
  expect(snapBoxHeightPx(0)).toBe(0)
  expect(snapBoxHeightPx(0.4)).toBe(0)
  // Above the thin range the nudge is off: a half-pixel of asymmetry is
  // invisible on a tall box, and growing it would misalign the row pitch.
  expect(snapBoxHeightPx(6)).toBe(6)
  expect(snapBoxHeightPx(20)).toBe(20)
})

test('snapBoxCenterYPx matches the hand-written twin it replaced', () => {
  for (const h of HEIGHTS) {
    for (const centerY of [0, 0.5, 1, 7.25, 100.5, 1000.75]) {
      for (const scrollY of [0, 0.5, 13, 250.25]) {
        expect(snapBoxCenterYPx(centerY, h, scrollY)).toBe(
          retiredBoxCenterY(centerY, h, scrollY),
        )
      }
    }
  }
})

test('the glyph center lands on a pixel center, at every height', () => {
  // Thin glyphs (intron line, chevrons, strand arrow) are 1px strokes, so a
  // center on x.0 straddles two rows and renders 2px soft.
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
  // Forward: a sub-pixel span grows rightward off its start edge.
  expect(extendToMinWidthPx(100, 100.3, 2)).toBe(102)
  // Reversed (x2 < x1): bp runs leftward, x1 is still the feature's START — its
  // right edge — so the span must grow leftward. Anchoring the leftmost edge
  // instead slides the mark a full min-width, and only on flipped regions.
  expect(extendToMinWidthPx(100, 99.7, 2)).toBe(98)
  // Already wide enough: returned untouched in both orientations.
  expect(extendToMinWidthPx(100, 110, 2)).toBe(110)
  expect(extendToMinWidthPx(100, 90, 2)).toBe(90)
})
