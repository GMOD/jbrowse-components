import { sweepDrawAgainstHit } from '@jbrowse/render-core/marks/drawAgainstHit'

import { arrowShape, rectShape } from './featureGlyphShapes.ts'

import type { ArrowChannels, RectChannels } from './featureGlyphShapes.ts'

// 200 bp over 100 px: the third rect is a sub-pixel feature that takes the
// snap floor, the second sits on a row the scroll has pushed off the canvas.
const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 200,
  screenStartPx: 20,
  screenEndPx: 120,
  reversed: false,
}

const frame = { canvasWidth: 140, canvasHeight: 40 }

const rects: RectChannels = {
  startEnd: Uint32Array.from([10, 60, 80, 140, 150, 151, 170, 199]),
  y: Float32Array.from([2, 90, 14.5, 26]),
  height: Float32Array.from([8, 8, 7, 5]),
  color: Uint32Array.from([0xff0000ff, 0xff00ff00, 0xffff0000, 0xff0000ff]),
  densityFade: Uint32Array.from([0, 0, 1, 0]),
  strand: Float32Array.from([1, -1, 1, 0]),
  count: 4,
}

const sliceRect = (c: RectChannels, i: number): RectChannels => ({
  startEnd: c.startEnd.subarray(i * 2, i * 2 + 2),
  y: c.y.subarray(i, i + 1),
  height: c.height.subarray(i, i + 1),
  color: c.color.subarray(i, i + 1),
  densityFade: c.densityFade.subarray(i, i + 1),
  strand: c.strand.subarray(i, i + 1),
  count: 1,
})

describe('rect: the box is the fill, snapped as the painter snaps it', () => {
  test.each([false, true])('reversed %s', reversed => {
    expect(
      sweepDrawAgainstHit(
        rectShape,
        rects,
        { ...block, reversed },
        frame,
        { scrollY: 0, outlineColor: 0 },
        { maxDistSq: Number.MIN_VALUE, sliceOne: sliceRect },
      ),
    ).toEqual([])
  })
})

const arrows: ArrowChannels = {
  x: Uint32Array.from([60, 100]),
  y: Float32Array.from([6, 20]),
  height: Float32Array.from([8, 8]),
  widthBp: Uint32Array.from([50, 40]),
  direction: Int8Array.from([1, -1]),
  color: Uint32Array.from([0xff0000ff, 0xff00ff00]),
  count: 2,
}

const sliceArrow = (c: ArrowChannels, i: number): ArrowChannels => ({
  x: c.x.subarray(i, i + 1),
  y: c.y.subarray(i, i + 1),
  height: c.height.subarray(i, i + 1),
  widthBp: c.widthBp.subarray(i, i + 1),
  direction: c.direction.subarray(i, i + 1),
  color: c.color.subarray(i, i + 1),
  count: 1,
})

describe('arrow: the box holds the stem and the head', () => {
  test.each([false, true])('reversed %s', reversed => {
    expect(
      sweepDrawAgainstHit(
        arrowShape,
        arrows,
        { ...block, reversed },
        frame,
        { scrollY: 0, outlineColor: 0 },
        { maxDistSq: 100, sliceOne: sliceArrow },
      ),
    ).toEqual([])
  })
})
