import { arcsToRegionResult } from '../../features/arcs/arcRegions.ts'
import { buildArcBandFeeds } from '../../features/arcs/bandFeed.ts'
import {
  ARC_SHAPE_ARC,
  ARC_SHAPE_FLAT_SPLIT,
} from '../../features/arcs/shapes.ts'
import { makeTestPalette, makeTestRenderState } from '../testUtils.ts'
import { resolveArcBandHover } from './arcHitTest.ts'

import type { ComputedArc, ComputedLine } from '../../features/arcs/arcTypes.ts'
import type { ArcBand } from '../renderers/rendererTypes.ts'

// Two regions side by side at 1 bp per px: region 0 is bp 0..400 over px
// 0..400, region 1 bp 1000..1400 over px 400..800.
const displayed = [
  { refName: 'chr1', start: 0, end: 400, displayedRegionIndex: 0 },
  { refName: 'chr1', start: 1000, end: 1400, displayedRegionIndex: 1 },
]
const linkRegions = [
  { anchorPx: 0, anchorBp: 0, signedPxPerBp: 1, leftPx: 0, rightPx: 400 },
  {
    anchorPx: 400,
    anchorBp: 1000,
    signedPxPerBp: 1,
    leftPx: 400,
    rightPx: 800,
  },
]
const blocks = displayed.map(r => ({
  displayedRegionIndex: r.displayedRegionIndex,
  start: r.start,
  end: r.end,
  screenStartPx: r.displayedRegionIndex * 400,
  screenEndPx: r.displayedRegionIndex * 400 + 400,
  reversed: false,
}))
const upBand: ArcBand = { top: 100, height: 60, down: false }

function arc(p1: number, p2: number, over: Partial<ComputedArc> = {}) {
  return {
    p1: { refName: 'chr1', bp: p1 },
    p2: { refName: 'chr1', bp: p2 },
    colorType: 0,
    shapeType: ARC_SHAPE_ARC,
    yBp: Math.abs(p2 - p1) / 2,
    spanBp: Math.abs(p2 - p1) / 2,
    support: 5,
    key: `${p1}-${p2}`,
    ...over,
  }
}

interface HoverCase {
  arcs?: ComputedArc[]
  lines?: ComputedLine[]
  cloud?: boolean
  band?: ArcBand
}

function hover(
  x: number,
  y: number,
  { arcs = [], lines = [], cloud = false, band = upBand }: HoverCase = {},
) {
  const feeds = buildArcBandFeeds({
    byRegion: new Map([[0, arcsToRegionResult(arcs, lines)]]),
    crossRegion: [],
    displayed,
    colors: makeTestPalette(),
  })
  return resolveArcBandHover(
    x,
    y,
    feeds,
    {
      ...makeTestRenderState({
        canvasWidth: 800,
        canvasHeight: 200,
        linkRegions,
        arcsYDomainBp: cloud ? 1000 : undefined,
      }),
      arcBand: band,
    },
    blocks,
  )
}

test('finds the arc at its apex, and carries its support and region out', () => {
  // 100..200 is a 100 px pair, its apex 50 px above the baseline at 160
  const found = hover(150, 110, { arcs: [arc(100, 200)] })
  expect(found?.hit).toMatchObject({ kind: 'arc', support: 5, x1: 100 })
  expect(found?.regionIndex).toBe(0)
  expect(found!.highlight.d).toMatch(/^M/)
  expect(found!.highlight.dash).toBeUndefined()
  expect(found!.highlight.clip).toEqual({
    x: 0,
    y: 100,
    width: 800,
    height: 60,
  })
})

test('the highlight is the width of the ink it covers', () => {
  const found = hover(150, 110, { arcs: [arc(100, 200)] })!
  const thin = hover(150, 110, { arcs: [arc(100, 200, { support: 1 })] })!
  expect(found.highlight.lineWidth).toBeGreaterThan(thin.highlight.lineWidth)
})

test('a cursor off the band, or a band with no room, answers nothing', () => {
  expect(hover(150, 90, { arcs: [arc(100, 200)] })).toBeUndefined()
  expect(
    hover(150, 110, {
      arcs: [arc(100, 200)],
      band: { top: 100, height: 0, down: false },
    }),
  ).toBeUndefined()
})

test('a band hung from its top finds the arc below its baseline', () => {
  const band = { top: 100, height: 60, down: true }
  expect(hover(150, 150, { arcs: [arc(100, 200)], band })?.hit.kind).toBe('arc')
  expect(hover(150, 110, { arcs: [arc(100, 200)], band })).toBeUndefined()
})

describe('a band of ticks and no arcs', () => {
  const lines: ComputedLine[] = [
    {
      x: { refName: 'chr1', bp: 300 },
      support: 3,
      partnerRefNames: ['chr9'],
      partnerLoci: [{ refName: 'chr9', bp: 5, support: 3 }],
    },
  ]

  test('answers, and reports what the tick points at', () => {
    expect(hover(300, 120, { lines })?.hit).toMatchObject({
      kind: 'tick',
      bp: 300,
      support: 3,
      partnerRefNames: ['chr9'],
    })
  })

  test('the highlight traces the full-band vertical the tick draws', () => {
    expect(hover(300, 120, { lines })!.highlight.d).toBe('M300 160L300 100')
  })
})

test('a split-read connector in the read cloud highlights with its dash', () => {
  const found = hover(150, 150, {
    cloud: true,
    arcs: [arc(100, 200, { shapeType: ARC_SHAPE_FLAT_SPLIT, yBp: 2 })],
  })
  expect(found?.hit.kind).toBe('arc')
  expect(found!.highlight.dash).toBe('3 3')
})
