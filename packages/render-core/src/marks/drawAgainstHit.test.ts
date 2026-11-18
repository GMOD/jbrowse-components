import { canvasWideBlock } from '../renderBlock.ts'
import {
  GLYPH_DIAMOND,
  GLYPH_DISC,
  GLYPH_SQUARE,
  GLYPH_TRIANGLE,
} from '../shaders/pointMark.consts.generated.ts'
import { barMark } from './barMark.ts'
import { abgrToCssRgba } from './colorFill.ts'
import { recordingContext, sweepMarkAgainstHit } from './drawAgainstHit.ts'
import { lineCenterMark, lineStepMark } from './lineMark.ts'
import {
  LINK_ELSEWHERE,
  LINK_NO_REGION,
  linkFeet,
  linkMark,
} from './linkMark.ts'
import { inkHitNearest } from './markHit.ts'
import { instanceColor } from './markRamp.ts'
import { pointInstance, pointMark } from './pointMark.ts'
import { HIDDEN_ROW, NO_ROW_COLOR, buildRowTable } from './rowTable.ts'
import { ruleMark } from './ruleMark.ts'
import { spanMark } from './spanMark.ts'
import { defineMark } from './types.ts'

import type { BarChannels, BarParams } from './barMark.ts'
import type { RecordedRect, SweepOptions } from './drawAgainstHit.ts'
import type { LineChannels, LineParams } from './lineMark.ts'
import type { LinkChannels, LinkParams } from './linkMark.ts'
import type { PointChannels, PointParams } from './pointMark.ts'
import type { RuleChannels, RuleParams } from './ruleMark.ts'
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
    color: instanceColor(c.color, i),
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
    color: instanceColor(c.color, i),
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

// A rule is a rect, so this arm gets the containment claim, as span's does.
// The 1 bp rule takes the min-width floor.
const rules: RuleChannels = {
  x: Uint32Array.from([10, 40, 70, 97]),
  x2: Uint32Array.from([30, 60, 95, 98]),
  y: Float32Array.from([0.2, 0.5, 0.8, 0.35]),
  color: Uint32Array.from([RED, BLUE, RED, BLUE]),
  count: 4,
}

const ruleParams: RuleParams = { domain: [0, 1], sizePx: 6, minWidthPx: 2 }

// A constant far from d3's default 1, so a painter and a hit test reading two
// different ones place the same value pixels apart.
const SYMLOG = { scaleType: 'symlog', symlogConstant: 0.05 } as const

test.each<[string, Partial<RuleParams>]>([
  ['linear', {}],
  ['symlog', SYMLOG],
  ['reversed below an offset', { reverse: true, rowOffsetPx: 12 }],
])('rule: every drawn rule answers its own hit, %s', (_label, scale) => {
  for (const reversed of [false, true]) {
    expect(
      sweepMarkAgainstHit(
        defineMark({
          shape: ruleMark,
          channels: (c: RuleChannels) => c,
          params: () => ({ ...ruleParams, ...scale }),
        }),
        rules,
        { ...block, reversed },
        { canvasWidth: 60, canvasHeight: 100 },
        { maxDistSq: Number.MIN_VALUE },
      ),
    ).toEqual([])
  }
})

// Every glyph kind, one of them over 20 bp, which stands at its centre. The
// painter batches a color run into one path, so nothing here is attributable
// positionally and the whole arm rests on `sliceOne`.
//
// Two diameters: 2 takes `appendGlyph`'s crisp-square branch
// (SMALL_POINT_MAX_DIAMETER is 3) and 6 its disc, and the square is the one that
// SNAPS, so its box is not centred on the bp the hit test measures from.
const glyphs: PointChannels = {
  x: Uint32Array.from([12, 38, 64, 68, 50]),
  x2: Uint32Array.from([13, 39, 65, 89, 51]),
  y: Float32Array.from([0.15, 0.4, 0.65, 0.9, 0.3]),
  color: Uint32Array.from([RED, RED, BLUE, BLUE, RED]),
  glyph: Uint8Array.from([
    GLYPH_DISC,
    GLYPH_TRIANGLE,
    GLYPH_DIAMOND,
    GLYPH_DISC,
    GLYPH_SQUARE,
  ]),
  count: 5,
}

describe('point: a glyph hit lands on the glyph the painter drew', () => {
  test.each<[number, Partial<PointParams>]>([
    [2, {}],
    [6, {}],
    [6, SYMLOG],
    [6, { reverse: true, rowOffsetPx: 12, rowHeight: 40 }],
    [7, { triangleHeightPx: 4.5 }],
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
          { maxDistSq: 400, sliceOne: pointInstance },
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

// One bar at a time, for a batch that paints more rects than it has bars: a
// bar the domain cut paints its clip strip too, inside its own box.
function sliceOneBar(c: BarChannels, i: number): BarChannels {
  return {
    x: c.x.subarray(i, i + 1),
    x2: c.x2.subarray(i, i + 1),
    y: c.y.subarray(i, i + 1),
    color: instanceColor(c.color, i),
    count: 1,
  }
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
          { maxDistSq: Number.MIN_VALUE, sliceOne: sliceOneBar },
        ),
      ).toEqual([])
    }
  })
})

// A bar past either end of the domain is clamped to the band edge and wears
// the clip strip there (ADR-183); a bar the domain holds paints one rect. A
// bar cut to no height, its origin on the same edge, paints only the strip,
// which is then its ink.
test('bar: the clip strip marks the cut edge, after every bar', () => {
  const cut: BarChannels = {
    x: Uint32Array.from([10, 30, 50]),
    x2: Uint32Array.from([20, 40, 60]),
    y: Float32Array.from([5, 12, -3]),
    color: Uint32Array.from([RED, RED, RED]),
    count: 3,
  }
  const params: BarParams = {
    domain: [0, 10],
    origin: 0,
    minWidthPx: 2,
    seamPx: 0,
  }
  const mark = defineMark({
    shape: barMark,
    channels: (c: BarChannels) => c,
    params: () => params,
  })
  const { ctx, calls } = recordingContext()
  mark.paintBlock(ctx, cut, block, { canvasWidth: 60, canvasHeight: 100 })
  expect(calls.map(r => [r.y, r.h])).toEqual([
    [50, 50],
    [0, 100],
    [0, 2],
    [98, 2],
  ])
  expect(
    mark.ink!(cut, block, { canvasWidth: 60, canvasHeight: 100 }, 2),
  ).toEqual(expect.objectContaining({ top: 98, height: 2 }))
  expect(
    sweepMarkAgainstHit(
      mark,
      cut,
      block,
      { canvasWidth: 60, canvasHeight: 100 },
      { maxDistSq: Number.MIN_VALUE, sliceOne: sliceOneBar },
    ),
  ).toEqual([])
})

// Rows: the same bars and rules banded three ways, each band the value
// scale's own, so a hit in a band answers the instance in that band.
test('bar and rule: rows band the plot and a hit lands in its own band', () => {
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
          shape: ruleMark,
          channels: (c: RuleChannels) => c,
          params: () => ({ ...ruleParams, rowHeight: 40 }),
        }),
        { ...rules, row: Uint32Array.from([0, 1, 2, 1]) },
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
          color: instanceColor(c.color, i),
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

// The grab radius a display asks with is 8 px, a third of this glyph.
test.each([false, true])(
  'point: a glyph wider than the grab radius answers out to its rim and past it, reversed %s',
  reversed => {
    const one: PointChannels = {
      x: Uint32Array.of(50),
      x2: Uint32Array.of(51),
      y: Float32Array.of(0.5),
      color: Uint32Array.of(RED),
      glyph: GLYPH_DISC,
      count: 1,
    }
    const f = { canvasWidth: 60, canvasHeight: 100 }
    const p = { domain: [0, 1] as [number, number], diameterPx: 24 }
    const b = { ...block, reversed }
    const box = pointMark.ink!(one, b, f, p, 0)!
    const at = (dx: number, dy: number) =>
      pointMark.hitNearest!(
        one,
        b,
        f,
        p,
        box.left + 12 + dx,
        box.top + 12 + dy,
        [0],
        64,
      )
    expect(at(10, 0)).toMatchObject({ index: 0, distSq: 0 })
    expect(at(0, -11)).toMatchObject({ index: 0, distSq: 0 })
    expect(at(-15, 0)?.distSq).toBeCloseTo(9)
    expect(at(0, 21)).toBeUndefined()
  },
)

// 4 px is the mark display's default diameter. Wherever a disc's centre lay
// within the grab radius, the nearest centre answers, as when a glyph was
// measured from its centre alone.
test.each([false, true])(
  'point: default-size discs answer the nearest centre, reversed %s',
  reversed => {
    const discs: PointChannels = { ...glyphs, glyph: GLYPH_DISC }
    const f = { canvasWidth: 60, canvasHeight: 100 }
    const p = { domain: [0, 1] as [number, number], diameterPx: 4 }
    const b = { ...block, reversed }
    const order = [4, 3, 2, 1, 0]
    const centres = order.map(i => {
      const r = pointMark.ink!(discs, b, f, p, i)!
      return { i, x: r.left + 2, y: r.top + 2 }
    })
    const differ: [number, number, number, number?][] = []
    let answered = 0
    for (let y = 0; y <= f.canvasHeight; y += 0.5) {
      for (let x = 0; x <= f.canvasWidth; x += 0.5) {
        let want: number | undefined
        let wantSq = 64
        for (const c of centres) {
          const distSq = (x - c.x) ** 2 + (y - c.y) ** 2
          if (distSq < wantSq) {
            want = c.i
            wantSq = distSq
          }
        }
        if (want !== undefined) {
          answered++
          const got = pointMark.hitNearest!(discs, b, f, p, x, y, order, 64)
          if (got?.index !== want) {
            differ.push([x, y, want, got?.index])
          }
        }
      }
    }
    expect(answered).toBeGreaterThan(1000)
    expect(differ.slice(0, 3)).toEqual([])
  },
)

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
  feet: Uint8Array.from([
    linkFeet(1, -1),
    linkFeet(-1, 0),
    linkFeet(1, 1),
    linkFeet(-1, 1),
    linkFeet(1, 1),
  ]),
  count: 5,
}

const sliceLink = (c: LinkChannels, i: number): LinkChannels => ({
  x: c.x.subarray(i, i + 1),
  x2: c.x2.subarray(i, i + 1),
  x2Region: c.x2Region.subarray(i, i + 1),
  y: c.y?.subarray(i, i + 1),
  size: c.size?.subarray(i, i + 1),
  color: instanceColor(c.color, i),
  feet: c.feet?.subarray(i, i + 1),
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
          {
            ...(reversed
              ? { anchorPx: 60, anchorBp: 0, signedPxPerBp: -0.5 }
              : { anchorPx: 10, anchorBp: 0, signedPxPerBp: 0.5 }),
            leftPx: 10,
            rightPx: 60,
          },
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

// Two series on one row that cross: the first steps through three abutting
// spans, a gap and two more; the second's spans stand apart, each linking to
// the last within `gapBp` but the final one, a dot. The painter strokes a run
// through its instances, so none paints alone, and each wears a color of its
// own to be told apart in the record.
const lineInstances: LineChannels = {
  x: Uint32Array.from([5, 20, 30, 60, 75, 10, 40, 70]),
  x2: Uint32Array.from([20, 30, 45, 70, 90, 25, 55, 95]),
  y: Float32Array.from([0.2, 0.8, 0.5, 0.9, 0.1, 0.9, 0.1, 0.6]),
  series: Uint32Array.from([0, 0, 0, 0, 0, 1, 1, 1]),
  color: Uint32Array.from({ length: 8 }, (_, i) => 0xff000000 + i * 0x10101),
  gapBp: 32,
  count: 8,
}

const lineCss = [...lineInstances.color].map(c => abgrToCssRgba(c))
const lineInstanceOf = (r: RecordedRect) => {
  const i = lineCss.indexOf(r.fillStyle)
  return i === -1 ? undefined : i
}

const lineParams: LineParams = { domain: [0, 1], origin: 0, lineWidth: 2 }

describe('line: every stroke answers its own hit, in both orientations', () => {
  const sweepLine = (
    shape: MarkShape<LineChannels, LineParams>,
    reversed: boolean,
    options: SweepOptions<LineChannels>,
  ) =>
    sweepMarkAgainstHit(
      defineMark({
        shape,
        channels: (c: LineChannels) => c,
        params: () => lineParams,
      }),
      lineInstances,
      { ...block, reversed },
      frame,
      { instanceOf: lineInstanceOf, ...options },
    )

  // The step's quads are square capped, so the boxes the recorder takes for
  // its edges are its stroke exactly, and a point inside one answers it.
  test.each([false, true])('step, reversed %s', reversed => {
    const { ctx, calls } = recordingContext()
    lineStepMark.paintBlock(
      ctx,
      lineInstances,
      { ...block, reversed },
      frame,
      lineParams,
    )
    const onStroke = (i: number, x: number, y: number) =>
      calls.some(
        r =>
          lineInstanceOf(r) === i &&
          x >= r.x &&
          x <= r.x + r.w &&
          y >= r.y &&
          y <= r.y + r.h,
      )
    expect(
      sweepLine(lineStepMark, reversed, {
        maxDistSq: Number.MIN_VALUE,
        contains: onStroke,
      }),
    ).toEqual([])
  })

  test.each([false, true])('linear, reversed %s', reversed => {
    expect(sweepLine(lineCenterMark, reversed, { maxDistSq: 400 })).toEqual([])
  })
})
