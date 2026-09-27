import {
  GLYPH_DIAMOND,
  GLYPH_DISC,
  GLYPH_TRIANGLE,
} from '../shaders/pointMark.consts.generated.ts'
import { pointInsetPx } from './glyphPaint.ts'
import { pointMark } from './pointMark.ts'
import { ruleMark } from './ruleMark.ts'

import type { PointChannels } from './pointMark.ts'
import type { RuleChannels } from './ruleMark.ts'

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

// One instance per glyph at each domain endpoint.
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

test('a point stands at the centre of its extent, whichever way the block runs', () => {
  const wide = {
    ...channels,
    x: Uint32Array.of(200),
    x2: Uint32Array.of(500),
    count: 1,
  }
  for (const reversed of [false, true]) {
    const box = pointMark.ink!(
      wide,
      { ...block, reversed },
      { canvasWidth: 1000, canvasHeight: CANVAS_HEIGHT },
      { domain: DOMAIN, diameterPx: DIAMETER },
      0,
    )!
    expect(box.left + box.width / 2).toBeCloseTo(reversed ? 650 : 350)
  }
})

test('a rule spans its extent, and one narrower than the floor grows from its x end', () => {
  const rules: RuleChannels = {
    x: Uint32Array.of(200, 700),
    x2: Uint32Array.of(500, 701),
    y: Float32Array.of(500, 500),
    count: 2,
  }
  const inkOf = (i: number, reversed: boolean) =>
    ruleMark.ink!(
      rules,
      { ...block, reversed },
      { canvasWidth: 1000, canvasHeight: CANVAS_HEIGHT },
      { domain: DOMAIN, sizePx: 4, minWidthPx: 3 },
      i,
    )
  expect(inkOf(0, false)).toEqual({ left: 200, top: 18, width: 300, height: 4 })
  expect(inkOf(0, true)).toEqual({ left: 500, top: 18, width: 300, height: 4 })
  expect(inkOf(1, false)).toMatchObject({ left: 700, width: 3 })
  expect(inkOf(1, true)).toMatchObject({ left: 297, width: 3 })
})
