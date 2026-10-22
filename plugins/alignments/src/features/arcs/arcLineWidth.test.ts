import { ARC_LINK_MARKS } from '../../LinearAlignmentsDisplay/renderers/arcMarks.ts'
import {
  makeTestPalette,
  makeTestRenderState,
} from '../../LinearAlignmentsDisplay/testUtils.ts'
import {
  ARC_WIDTH_MAX_SCALE,
  ARC_WIDTH_PER_DOUBLING,
  arcStrokeScale,
  strokeWidthScale,
} from './arcLineWidth.ts'
import { arcsToRegionResult } from './arcRegions.ts'
import { buildArcBandFeeds } from './bandFeed.ts'

// The stroke the band draws for `support` reads at a configured `base` width,
// read off a tick's ink, which is exactly its stroke wide.
function strokeFor(support: number, base: number) {
  const region = {
    refName: 'chr1',
    start: 0,
    end: 1000,
    displayedRegionIndex: 0,
  }
  const feed = buildArcBandFeeds({
    colorField: 'insertSizeAndOrientation',
    byRegion: new Map([
      [
        0,
        arcsToRegionResult(
          [],
          [
            {
              x: { refName: 'chr1', bp: 500 },
              support,
              partnerRefNames: ['chr2'],
              partnerLoci: [],
            },
          ],
        ),
      ],
    ]),
    crossRegion: [],
    displayed: [region],
    colors: makeTestPalette(),
  }).get(0)!
  const state = {
    ...makeTestRenderState({
      canvasWidth: 1000,
      readConnectionsStrokeScale: arcStrokeScale(base),
      linkRegions: [{ anchorPx: 0, anchorBp: 0, signedPxPerBp: 1 }],
    }),
    arcBand: { top: 0, height: 50, down: false },
  }
  const block = {
    displayedRegionIndex: 0,
    start: 0,
    end: 1000,
    screenStartPx: 0,
    screenEndPx: 1000,
    reversed: false,
  }
  return ARC_LINK_MARKS[0]!.ink!(feed, block, state, 0)!.width
}

describe('the stroke a connection draws for its support', () => {
  // The guarantee that makes coalescing safe to turn on everywhere: a feed
  // with no repeats paints exactly what it painted before.
  test('support 1 is the configured width, exactly', () => {
    expect(strokeFor(1, 2)).toBeCloseTo(2)
    expect(strokeFor(1, 3.5)).toBeCloseTo(3.5)
  })

  test('each doubling adds the same amount of width', () => {
    const step = strokeFor(2, 2) - strokeFor(1, 2)
    expect(step).toBeCloseTo(2 * ARC_WIDTH_PER_DOUBLING)
    expect(strokeFor(4, 2) - strokeFor(2, 2)).toBeCloseTo(step)
    expect(strokeFor(8, 2) - strokeFor(4, 2)).toBeCloseTo(step)
  })

  test('a deep pileup is capped rather than drawing a band', () => {
    expect(strokeFor(100_000, 2)).toBeCloseTo(2 * ARC_WIDTH_MAX_SCALE)
  })

  // Where the cap starts binding is DERIVED from the two constants, not
  // chosen, so it is the thing to state and the thing to pin: the comment on
  // ARC_WIDTH_MAX_SCALE claimed 128 reads for a while, which is the width at
  // 128 (4.85x) mistaken for the support the ceiling is reached at.
  test('the ceiling binds at the support the two constants imply', () => {
    const crossover = 2 ** ((ARC_WIDTH_MAX_SCALE - 1) / ARC_WIDTH_PER_DOUBLING)
    expect(crossover).toBeCloseTo(43.9, 1)
    expect(strokeFor(Math.floor(crossover), 2)).toBeLessThan(
      2 * ARC_WIDTH_MAX_SCALE,
    )
    expect(strokeFor(Math.ceil(crossover), 2)).toBeCloseTo(
      2 * ARC_WIDTH_MAX_SCALE,
    )
  })

  // Support is a count and cannot be 0, but the arrays are Uint32 and a bug
  // upstream would read as one — a zero must not invert the curve.
  test('a degenerate support does not shrink the connection', () => {
    expect(strokeFor(0, 2)).toBeCloseTo(2)
  })
})

describe('strokeWidthScale, the scale encoding.strokeWidth draws', () => {
  const scale = { type: 'log' as const, range: [] as string[] }

  test('unset maps reads from 1 px to 4 px, as the default curve does', () => {
    expect(
      strokeWidthScale({ value: undefined, field: undefined, scale }),
    ).toEqual(arcStrokeScale(1))
  })

  test('a written value strokes every connection alike', () => {
    const constant = strokeWidthScale({ value: 3, field: undefined, scale })
    expect(constant.range).toEqual([3, 3])
  })

  test('a written field maps reads over any value, through its range', () => {
    expect(
      strokeWidthScale({
        value: 3,
        field: 'reads',
        scale: { type: 'linear', range: ['2', '8'] },
      }),
    ).toEqual({
      domain: arcStrokeScale(1).domain,
      scale: 'linear',
      range: [2, 8],
    })
  })

  test('a range that is not two numbers keeps the default px', () => {
    expect(
      strokeWidthScale({
        value: undefined,
        field: 'reads',
        scale: { type: 'log', range: ['2'] },
      }).range,
    ).toEqual(arcStrokeScale(1).range)
  })
})
