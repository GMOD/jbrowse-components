import { MockHal } from '../hal/mockHal.ts'
import { recordingContext } from './drawAgainstHit.ts'
import { linkMark } from './linkMark.ts'
import { GpuMarkBackend } from './markBackend.ts'
import { inkOfInstances } from './markInk.ts'
import { paintMarkBlocks } from './markPaint.ts'
import { nearestMarkHit } from './nearestMarkHit.ts'
import { spanMark } from './spanMark.ts'
import { defineMark } from './types.ts'

import type { LinkChannels, LinkParams, LinkRegion } from './linkMark.ts'
import type { SpanChannels, SpanParams } from './spanMark.ts'

interface Region {
  span: SpanChannels
  link: LinkChannels
}

interface State {
  canvasWidth: number
  canvasHeight: number
  span: SpanParams
  link: LinkParams
}

// Three displayed regions side by side, 100 px each, bp 0..1000 at 10 bp/px.
const TABLE: LinkRegion[] = [0, 1, 2].map(i => ({
  anchorPx: i * 100,
  anchorBp: 0,
  signedPxPerBp: 0.1,
}))

const blocks = [0, 1, 2].map(i => ({
  displayedRegionIndex: i,
  start: 0,
  end: 1000,
  screenStartPx: i * 100,
  screenEndPx: (i + 1) * 100,
  reversed: false,
}))

const STATE: State = {
  canvasWidth: 300,
  canvasHeight: 60,
  span: {
    rowHeight: 10,
    rowProportion: 1,
    minWidthPx: 0,
    seamPx: 0,
    scrollTop: 0,
  },
  link: {
    domain: [0, 1],
    regions: TABLE,
    linkShape: 'dome',
    valued: false,
    sizePx: 2,
  },
}

const NO_LINKS: LinkChannels = {
  x: new Uint32Array(0),
  x2: new Uint32Array(0),
  x2Region: new Uint32Array(0),
  count: 0,
}

// Region 0 holds a link from its bp 500 to region 2's bp 500: px 50 to 250,
// over region 1, which holds no foot.
function regionData(link = NO_LINKS): Region {
  return {
    span: {
      x: Uint32Array.of(100),
      x2: Uint32Array.of(900),
      row: Uint32Array.of(0),
      color: Uint32Array.of(0xff0000ff),
      count: 1,
    },
    link,
  }
}

const LINK: LinkChannels = {
  x: Uint32Array.of(500),
  x2: Uint32Array.of(500),
  x2Region: Uint32Array.of(2),
  color: Uint32Array.of(0xff0000ff),
  count: 1,
}

const MARKS = [
  defineMark({
    shape: spanMark,
    channels: (d: Region) => d.span,
    params: (s: State) => s.span,
  }),
  defineMark({
    shape: linkMark,
    channels: (d: Region) => (d.link.count > 0 ? d.link : undefined),
    params: (s: State) => s.link,
  }),
]

const REGIONS = new Map([
  [0, regionData(LINK)],
  [1, regionData()],
  [2, regionData()],
])

test('a mark spanning the view draws after the blocks over the whole canvas, once per loaded region', () => {
  const hal = new MockHal(MARKS.map(m => m.pass))
  const backend = new GpuMarkBackend(hal, MARKS)
  for (const [key, region] of REGIONS) {
    backend.upload(key, region)
  }
  // region 0 is scrolled off: no block, but its link still draws
  expect(backend.renderBlocks(blocks.slice(1), REGIONS, STATE)).toBe(true)
  const draws = hal.draws().map(d => ({
    pass: d.passId,
    region: d.regionKey,
    scissor: d.scissor,
    viewport: d.viewport,
  }))
  expect(draws).toEqual([
    {
      pass: 'span',
      region: 1,
      scissor: { x: 100, y: 0, w: 100, h: 60 },
      viewport: { x: 100, y: 0, w: 100, h: 60 },
    },
    {
      pass: 'span',
      region: 2,
      scissor: { x: 200, y: 0, w: 100, h: 60 },
      viewport: { x: 200, y: 0, w: 100, h: 60 },
    },
    {
      pass: 'link',
      region: 0,
      scissor: null,
      viewport: { x: 0, y: 0, w: 300, h: 60 },
    },
  ])
})

test('the painter draws a link across a region holding neither foot, from a region with no block', () => {
  const { ctx, calls } = recordingContext()
  paintMarkBlocks(ctx, MARKS, REGIONS, blocks.slice(1), STATE)
  const linkEdges = calls.filter(r => r.y < 50)
  expect(Math.min(...linkEdges.map(r => r.x))).toBeLessThan(60)
  expect(Math.max(...linkEdges.map(r => r.x + r.w))).toBeGreaterThan(240)
})

test('the hit test and the highlight find a link over the region between its feet', () => {
  const regionOf = (i: number) => REGIONS.get(i)
  // the dome's apex: centre px 150, ry clamped to the 60 px band
  const hit = nearestMarkHit(MARKS, blocks, regionOf, STATE, 150, 0, {
    radiusPx: 8,
    regionKeys: REGIONS.keys(),
    candidates: (d, m) => (m === 1 ? [0] : d.span.count > 0 ? [0] : undefined),
  })
  expect(hit).toMatchObject({ mark: 1, index: 0 })
  expect(hit!.block.displayedRegionIndex).toBe(0)
  const [ink] = inkOfInstances(
    MARKS,
    blocks,
    regionOf,
    STATE,
    i => (i === 0 ? [{ mark: 1, index: 0 }] : undefined),
    [0],
  )
  expect(ink).toMatchObject({ left: 49, width: 202 })
})
