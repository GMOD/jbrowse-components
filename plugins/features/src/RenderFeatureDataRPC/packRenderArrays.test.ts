import { LITERAL } from './colorClasses.ts'
import { packRenderArrays } from './packRenderArrays.ts'

import type { ArrowData, LineData, RectData } from './packRenderArrays.ts'

function rect(start: number, end: number): RectData {
  return {
    start,
    end,
    y: 0,
    height: 10,
    color: 0,
    colorClass: LITERAL,
    flatbushIdx: 0,
    labelRowsAbove: 0,
    strand: 0,
  }
}
function line(start: number, end: number): LineData {
  return {
    start,
    end,
    y: 0,
    color: 0,
    colorClass: LITERAL,
    direction: 0,
    flatbushIdx: 0,
    labelRowsAbove: 0,
  }
}
function arrow(x: number, direction = 1, widthBp = 1000): ArrowData {
  return {
    x,
    y: 0,
    height: 10,
    widthBp,
    direction,
    color: 0,
    colorClass: LITERAL,
    flatbushIdx: 0,
    labelRowsAbove: 0,
  }
}

// Spans use a half-open overlap test. An arrow sits at its feature's end on the
// plus strand and its start on the minus, so it is open on the side where the
// feature's box is dropped.
test('rect/line use half-open spans; arrows follow their feature box', () => {
  const regionStart = 100
  const regionEnd = 200

  const rects = [
    rect(50, 100), // ends at regionStart -> excluded
    rect(50, 101), // crosses regionStart -> included
    rect(199, 250), // crosses regionEnd -> included
    rect(200, 250), // starts at regionEnd -> excluded
    rect(120, 180), // fully inside -> included
  ]
  const lines = [
    line(50, 100),
    line(50, 101),
    line(199, 250),
    line(200, 250),
    line(120, 180),
  ]
  const plusArrows = [
    arrow(99), // before -> excluded
    arrow(100), // at regionStart: its box [.., 100) is dropped -> excluded
    arrow(101), // just inside -> included
    arrow(150), // inside -> included
    arrow(200), // at regionEnd: end cap of a kept rect -> included
    arrow(201), // after -> excluded
  ]
  const minusArrows = [
    arrow(99, -1), // before -> excluded
    arrow(100, -1), // at regionStart: start of a kept rect -> included
    arrow(150, -1), // inside -> included
    arrow(199, -1), // last bp -> included
    arrow(200, -1), // at regionEnd: its box [200, ..) is dropped -> excluded
    arrow(201, -1), // after -> excluded
  ]

  const packed = packRenderArrays(
    rects,
    lines,
    [...plusArrows, ...minusArrows],
    regionStart,
    regionEnd,
  )

  expect(packed.rectPositions.length / 2).toBe(3)
  expect(packed.linePositions.length / 2).toBe(3)

  expect(Array.from(packed.arrowXs)).toEqual([101, 150, 200, 100, 150, 199])
})

test('a zero-width feature keeps its arrow at both region ends', () => {
  const packed = packRenderArrays(
    [],
    [],
    [arrow(100, 1, 0), arrow(200, -1, 0), arrow(99, 1, 0), arrow(201, -1, 0)],
    100,
    200,
  )

  expect(Array.from(packed.arrowXs)).toEqual([100, 200])
})

// A zero-width rect is a point: a CRISPR cut site or motif tick. The half-open
// span test satisfies neither bound for one landing on a seam.
test('zero-width rects keep both endpoints, like arrows', () => {
  const packed = packRenderArrays(
    [
      rect(99, 99), // before -> excluded
      rect(100, 100), // at regionStart -> included
      rect(150, 150), // inside -> included
      rect(200, 200), // at regionEnd -> included
      rect(201, 201), // after -> excluded
    ],
    [],
    [],
    100,
    200,
  )

  expect(Array.from(packed.rectPositions)).toEqual([
    100, 100, 150, 150, 200, 200,
  ])
})

// A gene with more labelled transcripts than a byte holds, each part a row
// below the last: past 255 a Uint8 lane wrapped and lifted the late isoforms
// onto the first ones.
test('label rows past 255 survive the pack', () => {
  const packed = packRenderArrays(
    [0, 256, 300].map(labelRowsAbove => ({
      ...rect(0, 10),
      labelRowsAbove,
    })),
    [],
    [],
    0,
    100,
  )
  expect(Array.from(packed.rectLabelRows)).toEqual([0, 256, 300])
})
