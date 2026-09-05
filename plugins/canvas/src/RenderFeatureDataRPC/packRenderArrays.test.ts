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
    height: 10,
    color: 0,
    colorClass: LITERAL,
    direction: 0,
    flatbushIdx: 0,
    labelRowsAbove: 0,
  }
}
function arrow(x: number): ArrowData {
  return {
    x,
    y: 0,
    height: 10,
    widthBp: 1000,
    direction: 1,
    color: 0,
    colorClass: LITERAL,
    flatbushIdx: 0,
    labelRowsAbove: 0,
  }
}

// Spans use a half-open overlap test; arrows are points, so both ends are
// inclusive. An arrow on regionEnd caps a feature whose box was kept.
test('rect/line use half-open spans; arrows keep both endpoints', () => {
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
  const arrows = [
    arrow(99), // before -> excluded
    arrow(100), // at regionStart -> included
    arrow(150), // inside -> included
    arrow(199), // last bp -> included
    arrow(200), // at regionEnd -> included (end cap of a kept rect)
    arrow(201), // after -> excluded
  ]

  const packed = packRenderArrays(rects, lines, arrows, regionStart, regionEnd)

  expect(packed.rectPositions.length / 2).toBe(3)
  expect(packed.linePositions.length / 2).toBe(3)

  expect(Array.from(packed.arrowXs)).toEqual([100, 150, 199, 200])
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
