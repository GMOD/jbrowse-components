import {
  GLYPH_DIAMOND,
  GLYPH_DISC,
  GLYPH_TRIANGLE,
} from '../shaders/pointMark.consts.generated.ts'
import { pointInsetPx } from './glyphPaint.ts'
import { pointMark } from './pointMark.ts'

import type { PointChannels } from './pointMark.ts'

const DOMAIN: [number, number] = [0, 1000]
const CANVAS_HEIGHT = 40
const DIAMETER = 8

const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}

// One instance per glyph at each domain endpoint, each a single bp so none of
// them takes the extent-bar branch.
const glyphs = [GLYPH_DISC, GLYPH_TRIANGLE, GLYPH_DIAMOND]
const channels: PointChannels = {
  x: Uint32Array.from(glyphs.flatMap((_, i) => [i * 100, i * 100 + 10])),
  x2: Uint32Array.from(glyphs.flatMap((_, i) => [i * 100 + 1, i * 100 + 11])),
  y: Float32Array.from(glyphs.flatMap(() => [1000, 0])),
  glyph: Uint8Array.from(glyphs.flatMap(g => [g, g])),
  color: new Uint32Array(6),
  count: 6,
}

const inkAt = (
  insetPx: number,
  i: number,
  channelsOver: PointChannels = channels,
) => {
  const box = pointMark.ink!(
    channelsOver,
    block,
    { canvasWidth: 1000, canvasHeight: CANVAS_HEIGHT },
    { domain: DOMAIN, diameterPx: DIAMETER, insetPx },
    i,
  )
  if (!box) {
    throw new Error('the point shape drew no ink')
  }
  return box
}

const boxes = (insetPx: number) =>
  Array.from({ length: channels.count }, (_, i) => inkAt(insetPx, i))

test('an inset range keeps every glyph at a domain endpoint inside the plot', () => {
  for (const box of boxes(pointInsetPx(DIAMETER))) {
    expect(box.top).toBeGreaterThanOrEqual(0)
    expect(box.top + box.height).toBeLessThanOrEqual(CANVAS_HEIGHT)
  }
})

test('without the inset a glyph at a domain endpoint hangs off the plot', () => {
  const overshoot = boxes(0).filter(
    box => box.top < 0 || box.top + box.height > CANVAS_HEIGHT,
  )
  expect(overshoot).toHaveLength(channels.count)
})

test('the inset compresses the range without reordering it', () => {
  const inset = pointInsetPx(DIAMETER)
  const centre = (value: number) =>
    inkAt(inset, 0, { ...channels, y: Float32Array.from([value]), count: 1 })
      .top +
    DIAMETER / 2

  expect(centre(1000)).toBeCloseTo(inset)
  expect(centre(0)).toBeCloseTo(CANVAS_HEIGHT - inset)
  expect(centre(500)).toBeCloseTo(CANVAS_HEIGHT / 2)
})

test('a reversed scale puts the domain minimum at the top of a band below its offset', () => {
  const centre = (y: number) => {
    const box = pointMark.ink!(
      { ...channels, y: Float32Array.of(y), count: 1 },
      block,
      { canvasWidth: 1000, canvasHeight: 200 },
      {
        domain: DOMAIN,
        diameterPx: DIAMETER,
        rowHeight: CANVAS_HEIGHT,
        rowOffsetPx: 100,
        reverse: true,
      },
      0,
    )!
    return box.top + box.height / 2
  }
  expect(centre(0)).toBeCloseTo(100)
  expect(centre(1000)).toBeCloseTo(100 + CANVAS_HEIGHT)
})
