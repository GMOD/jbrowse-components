import {
  markerHalfHeight,
  markerIsDark,
  runsOffEdge,
} from '../passes/shaders/continuation.js.generated.ts'
import {
  CONT_MIN_OVERHANG_PX,
  CONT_TRI_HALF_H_PX,
} from './sharedRendererConstants.ts'

// The retirement gate (adr-051) for the three decisions `continuation.slang`'s
// `vs_main` was still making inline while `drawContinuation` made them again in
// its own units. The retired spellings are below verbatim, swept against the
// generated twins over the inputs where a difference would show.
//
// None of these had drifted. They are lifted because the chevron window — the
// fourth decision in the neighbouring shader, left inline by the pass that
// lifted the other three — had, and silently.

// `drawContinuation`, before the lift: 0..255 channels against a 127.5 midpoint,
// where the shader weighed 0..1 channels against 0.5.
function retiredIsDark(r255: number, g255: number, b255: number) {
  return 0.299 * r255 + 0.587 * g255 + 0.114 * b255 > 127.5
}

function retiredHalfH(boxHeightPx: number) {
  return Math.min(CONT_TRI_HALF_H_PX, boxHeightPx * 0.4)
}

function retiredOffLeft(left: number, right: number, scissorLeft: number) {
  return scissorLeft - left > CONT_MIN_OVERHANG_PX && right > scissorLeft
}

function retiredOffRight(left: number, right: number, scissorRight: number) {
  return right - scissorRight > CONT_MIN_OVERHANG_PX && left < scissorRight
}

test('markerIsDark matches the 0..255 twin it replaced', () => {
  // Every channel corner plus a sweep through the midpoint, which is the only
  // place the two spellings could disagree.
  const channels = [0, 1, 63, 127, 128, 191, 254, 255]
  for (const r of channels) {
    for (const g of channels) {
      for (const b of channels) {
        expect(markerIsDark(r / 255, g / 255, b / 255)).toBe(
          retiredIsDark(r, g, b),
        )
      }
    }
  }
})

test('markerIsDark picks dark on a light fill and light on a dark one', () => {
  // The property, so a sign flip that agrees with a mirrored fixture still fails.
  expect(markerIsDark(1, 1, 1)).toBe(true)
  expect(markerIsDark(0, 0, 0)).toBe(false)
  // Green carries most of the luma weight, blue almost none.
  expect(markerIsDark(0, 1, 0)).toBe(true)
  expect(markerIsDark(0, 0, 1)).toBe(false)
})

test('markerHalfHeight matches the twin it replaced', () => {
  for (const h of [0, 0.5, 1, 4, 9.99, 10, 10.01, 40, 1e4]) {
    expect(markerHalfHeight(h)).toBeCloseTo(retiredHalfH(h), 6)
  }
  // The shrink binds below a 10px box and the cap above it — the crossover the
  // fixture above is swept across.
  expect(markerHalfHeight(5)).toBeCloseTo(2, 6)
  expect(markerHalfHeight(100)).toBe(CONT_TRI_HALF_H_PX)
})

test('runsOffEdge matches the two hand-mirrored gates it replaced', () => {
  const coords = [-500, -100, -21, -20, -19, 0, 1, 300, 799, 800, 819, 820, 821]
  for (const left of coords) {
    for (const right of coords) {
      if (right < left) {
        continue
      }
      for (const [scissorLeft, scissorRight] of [
        [0, 800],
        [200, 600],
      ] as const) {
        expect(
          runsOffEdge(left, right, scissorLeft, -1, CONT_MIN_OVERHANG_PX),
        ).toBe(retiredOffLeft(left, right, scissorLeft))
        expect(
          runsOffEdge(right, left, scissorRight, 1, CONT_MIN_OVERHANG_PX),
        ).toBe(retiredOffRight(left, right, scissorRight))
      }
    }
  }
})

test('runsOffEdge needs both the overhang AND a foot still in view', () => {
  // A rect wholly off the left of the canvas is not "running past" the edge —
  // there is nothing on screen for the marker to belong to. The second clause is
  // what says so, and it is the one a refactor drops.
  expect(runsOffEdge(-500, -100, 0, -1, CONT_MIN_OVERHANG_PX)).toBe(false)
  expect(runsOffEdge(-500, 100, 0, -1, CONT_MIN_OVERHANG_PX)).toBe(true)
  // …and the overhang has to clear the threshold, so a few px of clipping on a
  // short repeat stays unmarked.
  expect(runsOffEdge(-19, 100, 0, -1, CONT_MIN_OVERHANG_PX)).toBe(false)
  expect(runsOffEdge(-21, 100, 0, -1, CONT_MIN_OVERHANG_PX)).toBe(true)
})
