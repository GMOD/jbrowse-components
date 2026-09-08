import {
  GLYPH_DIAMOND,
  GLYPH_DISC,
  GLYPH_TRIANGLE,
} from '../shaders/pointMark.consts.generated.ts'
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

// Bars, which are a rect on both sides — so this arm gets the containment
// claim, as span's does, and sweeps at containment only. The glyph arm below is
// the one that needs `sliceOne`.
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
  for (const reversed of [false, true]) {
    expect(
      sweepDrawAgainstHit(
        pointMark,
        points,
        { ...block, reversed },
        { canvasWidth: 60, canvasHeight: 100 },
        pointParams,
        { maxDistSq: Number.MIN_VALUE },
      ),
    ).toEqual([])
  }
})

// Every glyph kind at 1bp, which at this zoom is half a pixel and so well under
// `pointDrawsBar`'s threshold — the branch Manhattan actually draws, and the one
// `findManhattanHit` picks through. The painter batches a colour run into one
// path, so nothing here is attributable positionally and the whole arm rests on
// `sliceOne`.
//
// Two diameters: 2 takes `appendGlyph`'s crisp-square branch
// (SMALL_POINT_MAX_DIAMETER is 3) and 6 its disc, and the square is the one that
// SNAPS, so its box is not centred on the bp the hit test measures from.
const glyphs: PointChannels = {
  x: Uint32Array.from([12, 38, 64, 88]),
  x2: Uint32Array.from([13, 39, 65, 89]),
  y: Float32Array.from([0.15, 0.4, 0.65, 0.9]),
  color: Uint32Array.from([RED, RED, BLUE, BLUE]),
  glyph: Uint8Array.from([
    GLYPH_DISC,
    GLYPH_TRIANGLE,
    GLYPH_DIAMOND,
    GLYPH_DISC,
  ]),
  count: 4,
}

const slicePoint = (c: PointChannels, i: number): PointChannels => ({
  x: c.x.subarray(i, i + 1),
  x2: c.x2.subarray(i, i + 1),
  y: c.y.subarray(i, i + 1),
  color: c.color.subarray(i, i + 1),
  glyph: c.glyph.subarray(i, i + 1),
  count: 1,
})

describe('point: a glyph hit lands on the glyph the painter drew', () => {
  test.each([2, 6])('diameter %i', diameterPx => {
    for (const reversed of [false, true]) {
      expect(
        sweepDrawAgainstHit(
          pointMark,
          glyphs,
          { ...block, reversed },
          { canvasWidth: 60, canvasHeight: 100 },
          { domain: [0, 1], diameterPx },
          // Wide enough that every swept point gets an answer, so the claims are
          // made everywhere rather than only on top of a glyph.
          { maxDistSq: 400, sliceOne: slicePoint },
        ),
      ).toEqual([])
    }
  })
})
