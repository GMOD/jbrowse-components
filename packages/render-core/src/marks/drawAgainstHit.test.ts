import { canvasWideBlock } from '../renderBlock.ts'
import {
  GLYPH_DIAMOND,
  GLYPH_DISC,
  GLYPH_TRIANGLE,
} from '../shaders/pointMark.consts.generated.ts'
import { barMark } from './barMark.ts'
import { sweepMarkAgainstHit } from './drawAgainstHit.ts'
import { LINK_ELSEWHERE, LINK_NO_REGION, linkMark } from './linkMark.ts'
import { inkHitNearest } from './markHit.ts'
import { pointMark } from './pointMark.ts'
import { HIDDEN_ROW, NO_ROW_COLOR, buildRowTable } from './rowTable.ts'
import { spanMark } from './spanMark.ts'
import { defineMark } from './types.ts'

import type { BarChannels, BarParams } from './barMark.ts'
import type { LinkChannels, LinkParams } from './linkMark.ts'
import type { PointChannels, PointParams } from './pointMark.ts'
import type { SpanChannels, SpanParams } from './spanMark.ts'
import type { MarkShape } from './types.ts'

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
        sweepMarkAgainstHit(
          defineMark({
            shape: spanMark,
            channels: (c: SpanChannels) => c,
            params: () => params,
          }),
          spans,
          { ...block, reversed },
          frame,
          { maxDistSq: Number.MIN_VALUE },
        ),
      ).toEqual([])
    }
  })
})

// The table between a key and its band: a reorder and a hidden row, swept
// through `sliceOne` because a hidden instance paints nothing.
describe('span through a row table: every drawn rect answers its own hit, in both orientations', () => {
  const table = buildRowTable(
    Uint32Array.of(2, HIDDEN_ROW, 0),
    Uint32Array.of(NO_ROW_COLOR, NO_ROW_COLOR, 0xff00ff00),
  )
  const sliceSpan = (c: SpanChannels, i: number): SpanChannels => ({
    x: c.x.subarray(i, i + 1),
    x2: c.x2.subarray(i, i + 1),
    row: c.row.subarray(i, i + 1),
    color: c.color.subarray(i, i + 1),
    count: 1,
  })
  test.each([false, true])('reversed %s', reversed => {
    expect(
      sweepMarkAgainstHit(
        defineMark({
          shape: spanMark,
          channels: (c: SpanChannels) => c,
          params: () => ({ ...spanParams, rowTable: table }),
        }),
        spans,
        { ...block, reversed },
        frame,
        { maxDistSq: Number.MIN_VALUE, sliceOne: sliceSpan },
      ),
    ).toEqual([])
  })
})

describe('containment: a rule in place of the painted box', () => {
  const sliceSpan = (c: SpanChannels, i: number): SpanChannels => ({
    x: c.x.subarray(i, i + 1),
    x2: c.x2.subarray(i, i + 1),
    row: c.row.subarray(i, i + 1),
    color: c.color.subarray(i, i + 1),
    count: 1,
  })
  const onInk =
    (reversed: boolean, except = -1) =>
    (i: number, x: number, y: number) => {
      const r = spanMark.ink!(
        spans,
        { ...block, reversed },
        frame,
        spanParams,
        i,
      )!
      return (
        i !== except &&
        x >= r.left &&
        x <= r.left + r.width &&
        y >= r.top &&
        y <= r.top + r.height
      )
    }
  const sweep = (
    reversed: boolean,
    contains: (i: number, x: number, y: number) => boolean,
    shape: MarkShape<SpanChannels, SpanParams> = spanMark,
  ) =>
    sweepMarkAgainstHit(
      defineMark({
        shape,
        channels: (c: SpanChannels) => c,
        params: () => spanParams,
      }),
      spans,
      { ...block, reversed },
      frame,
      { contains, sliceOne: sliceSpan, maxDistSq: Number.MIN_VALUE },
    )

  test.each([false, true])('the box as the rule agrees, reversed %s', r => {
    expect(sweep(r, onInk(r))).toEqual([])
  })

  test('a hit the rule does not contain is reported', () => {
    expect(sweep(false, onInk(false, 3))[0]).toBe(
      '(45, 16) should answer nothing, answered 3',
    )
  })

  test('a rule the hit test does not answer is reported', () => {
    const boxHit = inkHitNearest<SpanChannels, SpanParams>(spanMark.ink!)
    const blindToFour: MarkShape<SpanChannels, SpanParams> = {
      ...spanMark,
      hitNearest: (c, b, f, p, x, y, candidates, maxDistSq) =>
        boxHit(
          c,
          b,
          f,
          p,
          x,
          y,
          [...candidates].filter(i => i !== 4),
          maxDistSq,
        ),
    }
    expect(sweep(false, onInk(false), blindToFour)[0]).toBe(
      '(55, 8) should answer 4, answered nothing',
    )
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

// A constant far from d3's default 1, so a painter and a hit test reading two
// different ones place the same value pixels apart.
const SYMLOG = { scaleType: 'symlog', symlogConstant: 0.05 } as const

test.each<[string, Partial<PointParams>]>([
  ['linear', {}],
  ['symlog', SYMLOG],
  ['reversed below an offset', { reverse: true, rowOffsetPx: 12 }],
])('point: every drawn bar answers its own hit, %s', (_label, scale) => {
  for (const reversed of [false, true]) {
    expect(
      sweepMarkAgainstHit(
        defineMark({
          shape: pointMark,
          channels: (c: PointChannels) => c,
          params: () => ({ ...pointParams, ...scale }),
        }),
        points,
        { ...block, reversed },
        { canvasWidth: 60, canvasHeight: 100 },
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
  color: c.color!.subarray(i, i + 1),
  glyph: c.glyph.subarray(i, i + 1),
  count: 1,
})

describe('point: a glyph hit lands on the glyph the painter drew', () => {
  test.each<[number, Partial<PointParams>]>([
    [2, {}],
    [6, {}],
    [6, SYMLOG],
    [6, { reverse: true, rowOffsetPx: 12, rowHeight: 40 }],
  ])('diameter %i, scale %j', (diameterPx, scale) => {
    for (const reversed of [false, true]) {
      expect(
        sweepMarkAgainstHit(
          defineMark({
            shape: pointMark,
            channels: (c: PointChannels) => c,
            params: () => ({ domain: [0, 1], diameterPx, ...scale }),
          }),
          glyphs,
          { ...block, reversed },
          { canvasWidth: 60, canvasHeight: 100 },
          // Wide enough that every swept point gets an answer, so the claims are
          // made everywhere rather than only on top of a glyph.
          { maxDistSq: 400, sliceOne: slicePoint },
        ),
      ).toEqual([])
    }
  })
})

// Bars stand between the origin and the value, on both sides of it, and one is
// narrower than the min-width floor. Every instance is one `fillRect`, so the
// containment claim holds — a point on a bar answers that bar.
const bars: BarChannels = {
  x: Uint32Array.from([5, 30, 50, 70, 90]),
  x2: Uint32Array.from([25, 45, 51, 85, 100]),
  y: Float32Array.from([0.8, -0.4, 0.5, 0.05, -1]),
  color: Uint32Array.from([RED, BLUE, RED, BLUE, RED]),
  count: 5,
}

// The same bars with every value strictly inside (-1, 1), for the params that
// clamp: a value landing on the same edge as the origin is a zero-height bar,
// which the arm below covers on its own.
const barsInside: BarChannels = {
  ...bars,
  y: Float32Array.from([0.8, -0.4, 0.5, 0.05, -0.9]),
}

describe('bar: every drawn rect answers its own hit, in both orientations', () => {
  test.each<[string, BarParams, BarChannels]>([
    [
      'zero origin',
      { domain: [-1, 1], origin: 0, minWidthPx: 2, seamPx: 0 },
      bars,
    ],
    [
      'no floor',
      { domain: [-1, 1], origin: 0, minWidthPx: 0, seamPx: 0 },
      bars,
    ],
    [
      'origin below the domain',
      { domain: [-1, 1], origin: -2, minWidthPx: 2, seamPx: 0 },
      barsInside,
    ],
    [
      'clamped domain',
      { domain: [-0.5, 0.5], origin: 0, minWidthPx: 2, seamPx: 0 },
      barsInside,
    ],
    [
      'symlog',
      { domain: [-1, 1], origin: 0, minWidthPx: 2, seamPx: 0, ...SYMLOG },
      bars,
    ],
    [
      'symlog, origin inside the linear region',
      { domain: [-1, 1], origin: 0.02, minWidthPx: 2, seamPx: 0, ...SYMLOG },
      bars,
    ],
  ])('%s', (_label, params, channels) => {
    for (const reversed of [false, true]) {
      expect(
        sweepMarkAgainstHit(
          defineMark({
            shape: barMark,
            channels: (c: BarChannels) => c,
            params: () => params,
          }),
          channels,
          { ...block, reversed },
          { canvasWidth: 60, canvasHeight: 100 },
          { maxDistSq: Number.MIN_VALUE },
        ),
      ).toEqual([])
    }
  })
})

// Rows: the same bars and points banded three ways, each band the value
// scale's own, so a hit in a band answers the instance in that band.
test('bar and point: rows band the plot and a hit lands in its own band', () => {
  const rows = Uint32Array.from([0, 1, 2, 1, 0])
  for (const reversed of [false, true]) {
    expect(
      sweepMarkAgainstHit(
        defineMark({
          shape: barMark,
          channels: (c: BarChannels) => c,
          params: () => ({
            domain: [-1, 1] as [number, number],
            origin: 0,
            minWidthPx: 2,
            seamPx: 0,
            rowHeight: 40,
          }),
        }),
        { ...bars, row: rows },
        { ...block, reversed },
        { canvasWidth: 60, canvasHeight: 120 },
        { maxDistSq: Number.MIN_VALUE },
      ),
    ).toEqual([])
    expect(
      sweepMarkAgainstHit(
        defineMark({
          shape: pointMark,
          channels: (c: PointChannels) => c,
          params: () => ({ ...pointParams, rowHeight: 40 }),
        }),
        { ...points, row: Uint32Array.from([0, 1, 2]) },
        { ...block, reversed },
        { canvasWidth: 60, canvasHeight: 120 },
        { maxDistSq: Number.MIN_VALUE },
      ),
    ).toEqual([])
  }
})

// A bar whose value sits on the origin has no height: the painter fills
// nothing and the hit test answers nothing, which the sweep can only see
// through `sliceOne` (the batch paints fewer rects than it has instances).
test('bar: a zero-height bar paints nothing and is never the answer', () => {
  const flat: BarChannels = {
    x: Uint32Array.from([10, 40]),
    x2: Uint32Array.from([30, 60]),
    y: Float32Array.from([0, 0.5]),
    color: Uint32Array.from([RED, BLUE]),
    count: 2,
  }
  expect(
    sweepMarkAgainstHit(
      defineMark({
        shape: barMark,
        channels: (c: BarChannels) => c,
        params: () => ({ domain: [0, 1], origin: 0, minWidthPx: 2, seamPx: 0 }),
      }),
      flat,
      block,
      { canvasWidth: 60, canvasHeight: 100 },
      {
        maxDistSq: 400,
        sliceOne: (c, i) => ({
          x: c.x.subarray(i, i + 1),
          x2: c.x2.subarray(i, i + 1),
          y: c.y.subarray(i, i + 1),
          color: c.color!.subarray(i, i + 1),
          count: 1,
        }),
      },
    ),
  ).toEqual([])
})

// Why `point` keeps a hit test of its own where the rect shapes take the one
// their ink implies: two glyphs a pixel apart both contain the cursor, and the
// one under it is the nearer CENTRE, which the boxes cannot say.
test('point: overlapping glyphs answer the nearest centre, not the first box', () => {
  const cluster: PointChannels = {
    x: Uint32Array.from([50, 52]),
    x2: Uint32Array.from([51, 53]),
    y: Float32Array.from([0.5, 0.5]),
    color: Uint32Array.from([RED, RED]),
    glyph: Uint8Array.from([GLYPH_DISC, GLYPH_DISC]),
    count: 2,
  }
  const f = { canvasWidth: 60, canvasHeight: 100 }
  const p = { domain: [0, 1] as [number, number], diameterPx: 6 }
  const x1 = pointMark.ink!(cluster, block, f, p, 1)!
  const cursorX = x1.left + x1.width / 2 - 0.25
  expect(
    pointMark.hitNearest!(cluster, block, f, p, cursorX, 50, [0, 1], 100)
      ?.index,
  ).toBe(1)
})

// Links over the whole canvas, which a link spans: a dome, an upstream mate
// (x2 < x), a stem for a mate on no region, a far pair whose mate sits on a
// region 8000 px away, so its ellipse degenerates to legs, and a copy another
// region draws. `sliceOne` because a stroked curve records one box per
// flattened edge.
const links: LinkChannels = {
  x: Uint32Array.from([10, 30, 50, 70, 60]),
  x2: Uint32Array.from([40, 20, 95, 5, 90]),
  x2Region: Uint32Array.from([0, 0, LINK_NO_REGION, 1, LINK_ELSEWHERE]),
  y: Float32Array.from([0.2, 0.9, 0.5, 0.7, 0.4]),
  size: Float32Array.from([1, 4, NaN, 2, 3]),
  color: Uint32Array.from([RED, BLUE, RED, BLUE, RED]),
  count: 5,
}

const sliceLink = (c: LinkChannels, i: number): LinkChannels => ({
  x: c.x.subarray(i, i + 1),
  x2: c.x2.subarray(i, i + 1),
  x2Region: c.x2Region.subarray(i, i + 1),
  y: c.y?.subarray(i, i + 1),
  size: c.size?.subarray(i, i + 1),
  color: c.color?.subarray(i, i + 1),
  count: 1,
})

describe('link: every stroked curve answers its own hit, in both orientations', () => {
  test.each<[string, Partial<LinkParams>]>([
    ['dome', {}],
    ['arc', { linkShape: 'arc' }],
    ['valued', { valued: true }],
    ['inset', { valued: true, insetPx: 6 }],
    [
      'sized',
      { sizeScale: { domain: [0, 4], scale: 'linear', range: [1, 5] } },
    ],
    ['rows', { rowHeight: 20 }],
    ['line', { linkShape: 'line' }],
    ['valued line', { linkShape: 'line', valued: true }],
    ['down', { reverse: true, rowOffsetPx: 10, rowHeight: 60 }],
    ['down line', { linkShape: 'line', valued: true, reverse: true }],
    ['long stem', { stemPx: 40, strokeDash: [3, 3] }],
  ])('%s', (_label, overrides) => {
    for (const reversed of [false, true]) {
      const params: LinkParams = {
        domain: [0, 1],
        linkShape: 'dome',
        valued: false,
        sizePx: 2,
        regions: [
          reversed
            ? { anchorPx: 60, anchorBp: 0, signedPxPerBp: -0.5 }
            : { anchorPx: 10, anchorBp: 0, signedPxPerBp: 0.5 },
          { anchorPx: 8000, anchorBp: 0, signedPxPerBp: 0.5 },
        ],
        ...overrides,
      }
      expect(
        sweepMarkAgainstHit(
          defineMark({
            shape: linkMark,
            channels: (c: LinkChannels) => c,
            params: () => params,
          }),
          links,
          canvasWideBlock(0, frame.canvasWidth),
          frame,
          { maxDistSq: 400, sliceOne: sliceLink },
        ),
      ).toEqual([])
    }
  })
})
