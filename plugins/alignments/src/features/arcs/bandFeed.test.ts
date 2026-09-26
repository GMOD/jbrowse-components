import {
  normalizedRgbToABGR,
  withAbgrAlpha,
} from '@jbrowse/core/util/colorBits'
import { LINK_NO_REGION, linkFeet } from '@jbrowse/render-core/marks'

import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { ARC_SLOT_KEYS, buildArcColorPalette } from '../../shaders/palettes.ts'
import { ARC_COLOR_INTERCHROM, COLOR_LONG_INSERT } from './arcColors.ts'
import { arcsToRegionMap } from './arcRegions.ts'
import { CLOUD_LINE_ALPHA, buildArcBandFeeds } from './bandFeed.ts'
import {
  ARC_SHAPE_ARC,
  ARC_SHAPE_FLAT,
  ARC_SHAPE_FLAT_SPLIT,
} from './shapes.ts'

import type { ComputedArc, CrossRegionArc, RegionInfo } from './arcTypes.ts'

const colors = makeTestPalette(
  Object.fromEntries(ARC_SLOT_KEYS.map((key, i) => [key, [i / 16, 0.5, 1]])),
)
const slotColor = (slot: number) => {
  const [r, g, b] = buildArcColorPalette(colors)[slot]!
  return normalizedRgbToABGR(r, g, b)
}

const displayed: RegionInfo[] = [
  { refName: 'chr1', start: 0, end: 1000, displayedRegionIndex: 0 },
  { refName: 'chr1', start: 5000, end: 6000, displayedRegionIndex: 1 },
  { refName: 'chr2', start: 0, end: 1000, displayedRegionIndex: 2 },
]

function arc(
  p1: number,
  p2: number,
  shapeType = ARC_SHAPE_ARC,
  over: Partial<ComputedArc> = {},
): ComputedArc {
  return {
    p1: { refName: 'chr1', bp: p1 },
    p2: { refName: 'chr1', bp: p2 },
    colorType: COLOR_LONG_INSERT,
    shapeType,
    yBp: 300,
    spanBp: 310,
    support: 4,
    key: `${p1}-${p2}-${shapeType}`,
    ...over,
  }
}

function feeds(
  arcs: ComputedArc[],
  crossRegion: CrossRegionArc[] = [],
  lines: Parameters<typeof arcsToRegionMap>[0]['lines'] = [],
) {
  return buildArcBandFeeds({
    byRegion: arcsToRegionMap({ arcs, lines }, displayed.slice(0, 2)),
    crossRegion,
    displayed,
    colors,
  })
}

test('an arc inside one region draws once, its far foot through that region', () => {
  const f = feeds([arc(100, 400), arc(900, 950)])
  expect([...f.keys()]).toEqual([0, 1])
  const { links, markers, linkHits } = f.get(0)!
  expect([...links.x]).toEqual([100, 900])
  expect([...links.x2Region]).toEqual([0, 0])
  expect([...links.size!]).toEqual([4, 4])
  expect(links.color![0]).toBe(slotColor(COLOR_LONG_INSERT))
  expect(markers.count).toBe(0)
  expect(linkHits[0]).toMatchObject({ kind: 'arc', spanBp: 310, support: 4 })
  expect(f.get(1)!.links.count).toBe(0)
})

test('an arc spanning two loaded regions is filed under the one holding a foot', () => {
  // 500 is in region 0 and 8000 is in neither, so the span crosses region 1
  // without a foot there
  const f = feeds([arc(500, 8000)])
  expect(f.get(0)!.links.count).toBe(1)
  expect(f.get(1)!.links.count).toBe(0)
  expect(f.get(0)!.links.x2Region[0]).toBe(LINK_NO_REGION)
})

test('the near foot is the one in the region, whichever end the worker put first', () => {
  const f = feeds([arc(3000, 5100)])
  const { links } = f.get(1)!
  expect([links.x[0], links.x2[0], links.x2Region[0]]).toEqual([
    5100,
    3000,
    LINK_NO_REGION,
  ])
})

test('a read cloud bar takes its category colour at the cloud alpha, squares at each mate, a split one dashed', () => {
  const f = feeds([
    arc(100, 400, ARC_SHAPE_FLAT),
    arc(200, 300, ARC_SHAPE_FLAT_SPLIT),
  ])
  const { links, dashed, markers, markerHits } = f.get(0)!
  expect([...links.x]).toEqual([100])
  expect([...dashed.x]).toEqual([200])
  expect(links.color![0]).toBe(
    withAbgrAlpha(
      slotColor(COLOR_LONG_INSERT),
      Math.round(CLOUD_LINE_ALPHA * 255),
    ),
  )
  expect([...links.y!]).toEqual([300])
  expect([...markers.x]).toEqual([100, 400, 200, 300])
  expect([...markers.x2]).toEqual([...markers.x])
  expect(markers.color![0]).toBe(slotColor(COLOR_LONG_INSERT))
  expect(markerHits[0]).toBe(f.get(0)!.linkHits[0])
})

test('ticks are stems in the interchromosomal colour, a mark of their own', () => {
  const f = feeds(
    [arc(100, 400)],
    [],
    [
      {
        x: { refName: 'chr1', bp: 700 },
        support: 3,
        partnerRefNames: ['chr9'],
        partnerLoci: [{ refName: 'chr9', bp: 5, support: 3 }],
      },
    ],
  )
  const { ticks, links, tickHits } = f.get(0)!
  expect([...ticks.x]).toEqual([700])
  expect([...links.x]).toEqual([100])
  expect(ticks.x2Region[0]).toBe(LINK_NO_REGION)
  expect(ticks.color![0]).toBe(slotColor(ARC_COLOR_INTERCHROM))
  expect(tickHits[0]).toMatchObject({ kind: 'tick', bp: 700, support: 3 })
})

test('a cross-region arc draws from its first foot, placing the second through its own region, with feet when interchromosomal', () => {
  const cross: CrossRegionArc = {
    ...arc(900, 10, ARC_SHAPE_ARC, {
      p2: { refName: 'chr2', bp: 10 },
      colorType: ARC_COLOR_INTERCHROM,
    }),
    p1RegionIndex: 0,
    p2RegionIndex: 2,
    p1Dir: 1,
    p2Dir: -1,
  }
  const f = feeds([], [cross])
  const { links, linkHits } = f.get(0)!
  expect([links.x[0], links.x2[0], links.x2Region[0]]).toEqual([900, 10, 2])
  expect(links.feet![0]).toBe(linkFeet(1, -1))
  expect(linkHits[0]).toMatchObject({ endRefName: 'chr2', x1: 900, x2: 10 })
})

test('a cross-region bar puts its far square in the far region', () => {
  const cross: CrossRegionArc = {
    ...arc(900, 5100, ARC_SHAPE_FLAT),
    p1RegionIndex: 0,
    p2RegionIndex: 1,
    p1Dir: 1,
    p2Dir: 1,
  }
  const f = feeds([], [cross])
  expect([...f.get(0)!.markers.x]).toEqual([900])
  expect([...f.get(1)!.markers.x]).toEqual([5100])
  expect(f.get(0)!.links.feet![0]).toBe(0)
})

test('an arc with neither foot in the region it was filed under draws nothing', () => {
  // filed under region 1 by the span it crosses, with a foot either side
  const f = feeds([arc(3000, 7000)])
  expect(f.get(1)!.links.count).toBe(0)
  expect(f.get(0)!.links.count).toBe(0)
})
