import { namesToBlock } from '@jbrowse/alignments-core'
import { SAM_FLAG_SUPPLEMENTARY } from '@jbrowse/cigar-utils'

import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { arcSlotCategory } from '../../shaders/palettes.ts'
import {
  ARC_COLOR_DEFAULT,
  ARC_COLOR_SPLIT_FORWARD,
} from '../arcs/arcColors.ts'
import { buildArcBandFeeds } from '../arcs/bandFeed.ts'
import { computeArcsByGroup } from '../arcs/compute.ts'
import { ARC_SHAPE_ARC } from '../arcs/shapes.ts'
import {
  arcSplitJunction,
  junctionSupportingReadSlots,
} from './supportingReads.ts'

import type { ArcSettings, RegionInfo } from '../arcs/arcTypes.ts'
import type { ArcBandFeed, ArcBandHit, ArcHit } from '../arcs/bandFeed.ts'

type Segment = [start: number, end: number, strand: number]

// The SA entry naming a segment whose read-order clip at the start of the
// read is `clip` and whose read carries `tail` bases after it.
function saEntry([start, end, strand]: Segment, clip: number, tail: number) {
  const len = end - start
  const cigar =
    strand === -1 ? `${tail}S${len}M${clip}S` : `${clip}S${len}M${tail}S`
  return `chr1,${start + 1},${strand === -1 ? '-' : '+'},${cigar},60,0;`
}

// One split read of two segments in read order, each fetched as a record
// whose SA tag names the other, or only the first when `fetchSecond` is off.
function splitRead(a: Segment, b: Segment, fetchSecond = true) {
  const lenA = a[1] - a[0]
  const lenB = b[1] - b[0]
  const records = [
    { seg: a, clip: 0, flags: 0, sa: saEntry(b, lenA, 0) },
    {
      seg: b,
      clip: lenA,
      flags: SAM_FLAG_SUPPLEMENTARY,
      sa: saEntry(a, 0, lenB),
    },
  ].slice(0, fetchSecond ? 2 : 1)
  return makePileupDataResult({
    readPositions: new Uint32Array(records.flatMap(r => [r.seg[0], r.seg[1]])),
    readStrands: new Int8Array(records.map(r => r.seg[2])),
    readFlags: new Uint16Array(records.map(r => r.flags)),
    readClipAtStart: new Uint32Array(records.map(r => r.clip)),
    readSuppAlignments: records.map(r => r.sa),
    ...namesToBlock(records.map(() => 'split')),
  })
}

const ONE_REGION: RegionInfo[] = [
  { refName: 'chr1', start: 0, end: 10_000, displayedRegionIndex: 0 },
]

function feedHits(feed: ArcBandFeed) {
  return [
    ...feed.tickHits,
    ...feed.linkHits,
    ...feed.crossLinkHits,
    ...feed.clippedLinkHits,
  ]
}

// Every connection the band draws from these reads, with its region's refName.
function arcHits(
  data: ReturnType<typeof splitRead>,
  regions: RegionInfo[],
  settings: ArcSettings = {},
) {
  const { byGroup, crossRegionByGroup } = computeArcsByGroup(
    new Map([['', new Map(regions.map(r => [r.displayedRegionIndex, data]))]]),
    { loaded: regions, displayed: regions },
    settings,
  )
  const feeds = buildArcBandFeeds({
    byRegion: byGroup.get('') ?? new Map(),
    crossRegion: crossRegionByGroup.get('') ?? [],
    displayed: regions,
    colors: makeTestPalette(),
  })
  return [...feeds].flatMap(([index, feed]) =>
    feedHits(feed).map(hit => ({
      hit,
      refName: regions.find(r => r.displayedRegionIndex === index)?.refName,
    })),
  )
}

function category(hit: ArcBandHit) {
  return hit.kind === 'arc' ? arcSlotCategory(hit.colorType) : undefined
}

function litBy(
  data: ReturnType<typeof splitRead>,
  regions: RegionInfo[],
  settings: ArcSettings = {},
) {
  return arcHits(data, regions, settings).map(({ hit, refName }) => {
    const junction = arcSplitJunction(hit, refName)
    return {
      category: category(hit),
      junction,
      reads: junction
        ? junctionSupportingReadSlots(
            [{ displayedRegionIndex: 0, refName: 'chr1', data }],
            { ...junction, groupKey: '' },
          ).map(s => s.idx)
        : [],
    }
  })
}

const flip = ([start, end, strand]: Segment): Segment => [start, end, -strand]

describe('a split arc names the sashimi junction its reads make', () => {
  const cases: [string, Segment, Segment][] = [
    ['splitForward', [100, 200, 1], [500, 600, 1]],
    ['splitBack', [400, 600, 1], [100, 300, 1]],
    ['splitInvLL', [100, 200, 1], [300, 500, -1]],
    ['splitInvRR', [300, 500, -1], [600, 800, 1]],
  ]
  test.each(cases)('%s, read forward', (split, a, b) => {
    const [arc] = litBy(splitRead(a, b), ONE_REGION)
    expect(arc?.category).toBe(split)
    expect(arc?.junction?.split).toBe(split)
    expect(arc?.reads).toEqual([0, 1])
  })

  test.each(cases)('%s, read from the other end', (split, a, b) => {
    const [arc] = litBy(splitRead(flip(b), flip(a)), ONE_REGION)
    expect(arc?.category).toBe(split)
    expect(arc?.junction?.split).toBe(split)
    expect(arc?.reads).toEqual([0, 1])
  })

  test('a read-cloud split bar names the same junction', () => {
    const data = splitRead([100, 200, 1], [500, 600, 1])
    const [arc] = litBy(data, ONE_REGION, { cloud: true })
    expect(arc?.junction).toEqual({
      refName: 'chr1',
      start: 200,
      end: 500,
      split: 'splitForward',
    })
    expect(arc?.reads).toEqual([0, 1])
  })

  test('an arc to a segment off screen keeps both feet', () => {
    const data = splitRead([100, 200, 1], [8000, 8100, 1], false)
    const [arc] = litBy(data, [
      { refName: 'chr1', start: 0, end: 1000, displayedRegionIndex: 0 },
    ])
    expect(arc?.junction).toEqual({
      refName: 'chr1',
      start: 200,
      end: 8000,
      split: 'splitForward',
    })
    expect(arc?.reads).toEqual([0])
  })

  test('an arc between two displayed regions of one chromosome', () => {
    const data = splitRead([100, 200, 1], [5500, 5600, 1])
    const lit = litBy(data, [
      { refName: 'chr1', start: 0, end: 1000, displayedRegionIndex: 0 },
      { refName: 'chr1', start: 5000, end: 6000, displayedRegionIndex: 1 },
    ])
    expect(lit.map(l => l.junction)).toEqual([
      { refName: 'chr1', start: 200, end: 5500, split: 'splitForward' },
    ])
    expect(lit[0]?.reads).toEqual([0, 1])
  })

  test('two feet on one base take a split color but name no junction', () => {
    const [arc] = litBy(splitRead([100, 200, 1], [200, 300, 1]), ONE_REGION)
    expect(arc?.category).toBe('splitForward')
    expect(arc?.junction).toBeUndefined()
  })
})

describe('arcSplitJunction', () => {
  const arc: ArcHit = {
    kind: 'arc',
    x1: 500,
    x2: 200,
    support: 1,
    colorType: ARC_COLOR_SPLIT_FORWARD,
    shapeType: ARC_SHAPE_ARC,
    spanBp: 300,
  }

  test('a split arc names its junction low foot first', () => {
    expect(arcSplitJunction(arc, 'chr1')).toEqual({
      refName: 'chr1',
      start: 200,
      end: 500,
      split: 'splitForward',
    })
  })

  test('a mate link names nothing', () => {
    expect(
      arcSplitJunction({ ...arc, colorType: ARC_COLOR_DEFAULT }, 'chr1'),
    ).toBeUndefined()
  })

  test('an arc to another chromosome names nothing', () => {
    expect(
      arcSplitJunction({ ...arc, endRefName: 'chr2' }, 'chr1'),
    ).toBeUndefined()
  })
})
