import { sweepDrawAgainstHit } from './drawAgainstHit.ts'
import { pointMark } from './pointMark.ts'
import { spanMark } from './spanMark.ts'

import type { PointChannels, PointParams } from './pointMark.ts'
import type { SpanChannels, SpanParams } from './spanMark.ts'

const RED = 0xff0000ff
const BLUE = 0xffff0000

// 100 bp over 50 px, so the 1 bp instance is half a pixel wide and takes the
// min-width floor where there is one; the two on row 0 overlap.
const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 100,
  screenStartPx: 10,
  screenEndPx: 60,
  reversed: false,
}

const frame = { canvasWidth: 60, canvasHeight: 40 }

const spans: SpanChannels = {
  x: Uint32Array.from([10, 30, 50, 70, 90]),
  x2: Uint32Array.from([40, 60, 51, 85, 100]),
  row: Uint32Array.from([0, 0, 1, 2, 1]),
  color: Uint32Array.from([RED, BLUE, RED, BLUE, RED]),
  count: 5,
}

const spanParams: SpanParams = {
  rowHeight: 8,
  rowProportion: 1,
  minWidthPx: 2,
  seamPx: 0,
  scrollTop: 0,
}

describe('span: every drawn rect answers its own hit, in both orientations', () => {
  test.each<[string, Partial<SpanParams>]>([
    ['floor 2, full rows', { minWidthPx: 2, rowProportion: 1 }],
    ['no floor, full rows', { minWidthPx: 0, rowProportion: 1 }],
    ['floor 2, half rows', { minWidthPx: 2, rowProportion: 0.5 }],
    ['no floor, half rows', { minWidthPx: 0, rowProportion: 0.5 }],
    ['scrolled', { scrollTop: 5.25 }],
    ['sub-pixel rows', { rowHeight: 0.4 }],
  ])('%s', (_label, overrides) => {
    const params = { ...spanParams, ...overrides }
    for (const reversed of [false, true]) {
      expect(
        sweepDrawAgainstHit(
          spanMark,
          spans,
          { ...block, reversed },
          frame,
          params,
          { maxDistSq: Number.MIN_VALUE },
        ),
      ).toEqual([])
    }
  })
})

// Bars only: a glyph paints a path rather than a rect, and its hit target is
// its centre. Each bar is wider than the glyph and the rows sit far enough
// apart that no bar is nearer to a point on another's rect than that rect's
// own centreline.
const points: PointChannels = {
  x: Uint32Array.from([10, 40, 70]),
  x2: Uint32Array.from([30, 60, 95]),
  y: Float32Array.from([0.2, 0.5, 0.8]),
  color: Uint32Array.from([RED, BLUE, RED]),
  glyph: Uint8Array.from([0, 0, 0]),
  count: 3,
}

const pointParams: PointParams = { domain: [0, 1], diameterPx: 6 }

test('point: every drawn bar answers its own hit, in both orientations', () => {
  const r = pointParams.diameterPx / 2
  for (const reversed of [false, true]) {
    expect(
      sweepDrawAgainstHit(
        pointMark,
        points,
        { ...block, reversed },
        { canvasWidth: 60, canvasHeight: 100 },
        pointParams,
        { maxDistSq: r * r + 1e-9 },
      ),
    ).toEqual([])
  }
})
