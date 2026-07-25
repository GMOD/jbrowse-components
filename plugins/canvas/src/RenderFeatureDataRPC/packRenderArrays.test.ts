import { packRenderArrays } from './packRenderArrays.ts'

import type { ArrowData, LineData, RectData } from './packRenderArrays.ts'

function rect(start: number, end: number): RectData {
  return {
    start,
    end,
    y: 0,
    height: 10,
    color: 0,
    flatbushIdx: 0,
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
    direction: 0,
    flatbushIdx: 0,
  }
}
function arrow(x: number): ArrowData {
  return { x, y: 0, height: 10, direction: 1, color: 0, flatbushIdx: 0 }
}

// Spans (rect/line) use a half-open overlap test against [regionStart, regionEnd);
// arrows are points, so both ends are inclusive. An arrow sitting exactly on
// regionEnd is the end cap of a feature whose box was kept, so dropping it left
// that feature stranded without its strand marker.
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
