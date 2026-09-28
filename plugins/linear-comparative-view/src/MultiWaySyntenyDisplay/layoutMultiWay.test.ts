import { SimpleFeature } from '@jbrowse/core/util'

import { resolvePanel } from '../LaunchSyntenyView/resolvePanel.ts'
import {
  computeRowFrame,
  decideLaneFrames,
  frameFromDecision,
} from './laneDecision.ts'
import { laneRegion } from './laneHeader.ts'
import {
  clipGroupToAnchor,
  frameReach,
  frameSpan,
  frameTickXs,
  laneFetchRegion,
  laneFetchRegionMaxBp,
  laneFetchWindow,
  groupFeatures,
  groupRunSpansOnRow,
  mergeContiguousRegions,
  rowAssembliesOf,
  rowFrameX,
  tickIntervalFor,
} from './layoutMultiWay.ts'

import type { LaneDecision } from './laneDecision.ts'
import type { MultiWayGroup, RowFrame } from './layoutMultiWay.ts'

// the run spans without orientation; production reads the oriented form
const groupSpansOnRow = (
  group: MultiWayGroup,
  assemblyName: string,
  frame: RowFrame,
  width: number,
) => groupRunSpansOnRow(group, assemblyName, frame, width).map(r => r.span)

function pairFeature({
  uniqueId,
  name,
  start,
  end,
  strand = 1,
  mate,
}: {
  uniqueId: string
  // absent for an alignment record, which names nothing and is weighed by bp
  name?: string
  start: number
  end: number
  strand?: number
  mate: {
    assemblyName: string
    refName: string
    start: number
    end: number
    name?: string
  }
}) {
  // no strand inside mate: the pair's orientation is the feature's own strand
  return new SimpleFeature({
    uniqueId,
    refName: 'chr1',
    start,
    end,
    strand,
    name,
    assemblyName: 'anchor',
    mate,
  })
}

// alignRowFrames's seed: each group's anchor-lane px, off a linear map over spanBp
function anchorSeed(
  groups: ReturnType<typeof groupFeatures>,
  width: number,
  spanBp = 1000,
) {
  return new Map(
    groups.map(g => [
      g.key,
      ((g.anchor.start + g.anchor.end) / 2 / spanBp) * width,
    ]),
  )
}

function anchorSeedX(bp: number, width: number, spanBp = 1000) {
  return (bp / spanBp) * width
}

function settleLanes(
  groups: ReturnType<typeof groupFeatures>,
  assemblyNames: string[],
  anchorX: Map<string, number>,
  spanBp: number,
  width: number,
  previous = new Map<string, LaneDecision | undefined>(),
) {
  return decideLaneFrames({
    groups,
    assemblyNames,
    anchorX,
    anchorCoordOf: g => ({
      refName: g.anchor.refName,
      coord: (g.anchor.start + g.anchor.end) / 2,
    }),
    pxOfAnchor: c => anchorSeedX(c.coord, width, spanBp),
    unitBp: spanBp,
    width,
    previous,
  })
}

// the frames a settle draws with no scroll since
function framesOf(
  decisions: Map<string, LaneDecision | undefined>,
  spanBp: number,
  width: number,
) {
  return new Map(
    [...decisions].map(([name, d]) => [
      name,
      d &&
        frameFromDecision(
          d,
          anchorSeedX(d.pivotAnchor.coord, width, spanBp),
          spanBp,
          width,
        ),
    ]),
  )
}

function alignRowFrames(
  groups: ReturnType<typeof groupFeatures>,
  assemblyNames: string[],
  anchorX: Map<string, number>,
  spanBp: number,
  width: number,
) {
  return framesOf(
    settleLanes(groups, assemblyNames, anchorX, spanBp, width),
    spanBp,
    width,
  )
}

const features = [
  pairFeature({
    uniqueId: '1',
    name: 'g1',
    start: 100,
    end: 200,
    mate: {
      assemblyName: 'peach',
      refName: 'Pp1',
      start: 1000,
      end: 1100,
      name: 'p1',
    },
  }),
  pairFeature({
    uniqueId: '2',
    name: 'g1',
    start: 100,
    end: 200,
    mate: {
      assemblyName: 'cacao',
      refName: 'Cc1',
      start: 9000,
      end: 9100,
      name: 'c1',
    },
  }),
  pairFeature({
    uniqueId: '3',
    name: 'g2',
    start: 300,
    end: 400,
    mate: {
      assemblyName: 'peach',
      refName: 'Pp1',
      start: 1200,
      end: 1300,
      name: 'p2',
    },
  }),
  pairFeature({
    uniqueId: '4',
    name: 'g3',
    start: 500,
    end: 600,
    mate: {
      assemblyName: 'cacao',
      refName: 'Cc1',
      start: 8000,
      end: 8100,
      name: 'c3',
    },
  }),
  // repeated mate placement, as a reference-anchored table produces
  pairFeature({
    uniqueId: '5',
    name: 'g1',
    start: 100,
    end: 200,
    mate: {
      assemblyName: 'peach',
      refName: 'Pp1',
      start: 1000,
      end: 1100,
      name: 'p1',
    },
  }),
]

test('groups by anchor gene, dedupes repeated mates, sorts by anchor position', () => {
  const groups = groupFeatures(features)
  expect(groups.map(g => g.key)).toEqual(['g1', 'g2', 'g3'])
  expect(groups[0]!.mates.get('peach')).toHaveLength(1)
  expect(groups[0]!.mates.get('cacao')).toHaveLength(1)
  expect(groups[1]!.mates.has('cacao')).toBe(false)
})

test('row assemblies come out densest lane first, domain pinning over that', () => {
  expect(rowAssembliesOf(groupFeatures(features), [])).toEqual([
    'peach',
    'cacao',
  ])
  expect(rowAssembliesOf(groupFeatures(features), ['cacao'])).toEqual([
    'cacao',
    'peach',
  ])
})

test('domain pins a lane it names through an alias', () => {
  const canonical = (name: string) =>
    name === 'Theobroma_cacao' ? 'cacao' : name
  expect(
    rowAssembliesOf(groupFeatures(features), ['Theobroma_cacao'], canonical),
  ).toEqual(['cacao', 'peach'])
})

test('a sparse lane sorts below a denser one that appears after it', () => {
  const sparseFirst = [
    pairFeature({
      uniqueId: 's1',
      name: 'g1',
      start: 100,
      end: 200,
      mate: {
        assemblyName: 'sparse',
        refName: 'S1',
        start: 10,
        end: 20,
        name: 's1',
      },
    }),
    ...['a', 'b', 'c'].map((suffix, i) =>
      pairFeature({
        uniqueId: `d${suffix}`,
        name: `g${i + 1}`,
        start: 100 * (i + 1),
        end: 100 * (i + 1) + 50,
        mate: {
          assemblyName: 'dense',
          refName: 'D1',
          start: 1000 * (i + 1),
          end: 1000 * (i + 1) + 50,
          name: `d${suffix}`,
        },
      }),
    ),
  ]
  expect(rowAssembliesOf(groupFeatures(sparseFirst), [])).toEqual([
    'dense',
    'sparse',
  ])
})

test('a lane placing two short alignment records sorts below one placing a single record over more anchor bp', () => {
  const brokenAboveWhole = [
    pairFeature({
      uniqueId: 'broken-left',
      start: 100,
      end: 300,
      mate: { assemblyName: 'broken', refName: 'B1', start: 100, end: 300 },
    }),
    pairFeature({
      uniqueId: 'broken-right',
      start: 600,
      end: 800,
      mate: { assemblyName: 'broken', refName: 'B1', start: 5000, end: 5200 },
    }),
    pairFeature({
      uniqueId: 'whole',
      start: 100,
      end: 800,
      mate: { assemblyName: 'whole', refName: 'W1', start: 100, end: 800 },
    }),
  ]
  const groups = groupFeatures(brokenAboveWhole)
  expect(groups.map(g => g.mates.get('broken')?.length ?? 0)).toEqual([1, 0, 1])
  expect(rowAssembliesOf(groups, [])).toEqual(['whole', 'broken'])
})

test('a lane scattered over many contigs sorts by the one it draws', () => {
  const record = (
    uniqueId: string,
    start: number,
    mate: { assemblyName: string; refName: string; start: number },
  ) =>
    pairFeature({
      uniqueId,
      start,
      end: start + 100,
      mate: { ...mate, end: mate.start + 100 },
    })
  const scattered = Array.from({ length: 10 }, (_, contig) =>
    Array.from({ length: 3 }, (_, i) =>
      record(`platypus-${contig}-${i}`, 3000 * contig + 1000 * i, {
        assemblyName: 'platypus',
        refName: `scaffold_${contig}`,
        start: 1000 * i,
      }),
    ),
  ).flat()
  const dense = Array.from({ length: 8 }, (_, i) =>
    record(`baboon-${i}`, 500 + 3000 * i, {
      assemblyName: 'baboon',
      refName: 'chr14',
      start: 500 + 3000 * i,
    }),
  )
  const groups = groupFeatures([...scattered, ...dense])
  expect(rowAssembliesOf(groups, [])).toEqual(['baboon', 'platypus'])
  expect(rowAssembliesOf(groups, ['platypus'])).toEqual(['platypus', 'baboon'])
})

test('the runs of one clipped record are sibling groups, weighed by the anchor bp they cover', () => {
  const run = (i: number, anchor: [number, number], mate: [number, number]) =>
    new SimpleFeature({
      uniqueId: `r1:0-100000/${i}`,
      syntenyId: `7:0-100000/${i}`,
      refName: 'chr1',
      start: anchor[0],
      end: anchor[1],
      strand: 1,
      assemblyName: 'anchor',
      mate: {
        assemblyName: 'mouse',
        refName: 'M1',
        start: mate[0],
        end: mate[1],
      },
    })
  const groups = groupFeatures([
    run(0, [1000, 2000], [5000, 6000]),
    run(1, [27_000, 28_000], [6000, 7000]),
  ])
  expect(groups.map(g => g.key)).toEqual(['7:0-100000/0', '7:0-100000/1'])
  expect(groups.map(g => [g.anchor.start, g.anchor.end])).toEqual([
    [1000, 2000],
    [27_000, 28_000],
  ])
  expect(groups.map(g => g.mates.get('mouse')![0]!.start)).toEqual([5000, 6000])
  expect(groups.reduce((sum, g) => sum + g.weight, 0)).toBe(2000)
})

test('a run names its gene only while its placements name one', () => {
  const pair = (uniqueId: string, mateStart: number, mateName: string) =>
    pairFeature({
      uniqueId,
      name: 'g1',
      start: 100,
      end: 200,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: mateStart,
        end: mateStart + 100,
        name: mateName,
      },
    })
  const groups = groupFeatures([
    pair('a', 1000, 'Pp.A'),
    pair('b', 1050, 'Pp.B'),
    pair('c', 5000, 'Pp.C'),
  ])
  const frame = computeRowFrame(groups, 'peach', 10_000)!
  expect(
    groupRunSpansOnRow(groups[0]!, 'peach', frame, 1000).map(
      r => r.interval.name,
    ),
  ).toEqual([undefined, 'Pp.C'])
  expect(groups[0]!.anchor.name).toBe('g1')
})

test('a lane frame snaps to a multiple of the anchor span', () => {
  const groups = groupFeatures(features)
  const frame = computeRowFrame(groups, 'peach', 1000)!
  expect((frame.max - frame.min) / 1000).toBeCloseTo(1)
})

test('a small change in the placements leaves a settled lane alone', () => {
  const peachPair = (uniqueId: string, name: string, mateStart: number) =>
    pairFeature({
      uniqueId,
      name,
      start: 100,
      end: 200,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: mateStart,
        end: mateStart + 100,
        name: 'p1',
      },
    })
  const before = groupFeatures([
    peachPair('1', 'g1', 1000),
    peachPair('2', 'g2', 1200),
  ])
  const after = groupFeatures([
    peachPair('1', 'g1', 1007),
    peachPair('2', 'g2', 1207),
  ])
  const first = settleLanes(
    before,
    ['peach'],
    anchorSeed(before, 800),
    1000,
    800,
  )
  const second = settleLanes(
    after,
    ['peach'],
    anchorSeed(after, 800),
    1000,
    800,
    first,
  )
  const held = second.get('peach')!
  const was = first.get('peach')!
  expect(held.rung).toBe(was.rung)
  expect(held.pivotLaneBp).toBe(was.pivotLaneBp)
  expect(held.pivotAnchor).toEqual(was.pivotAnchor)
  const frames = framesOf(second, 1000, 800)
  const previous = framesOf(first, 1000, 800)
  expect(frames.get('peach')!.min).toBe(previous.get('peach')!.min)
  expect(frames.get('peach')!.max).toBe(previous.get('peach')!.max)
})

test('the shared tick interval is a 1/2/5 step landing a few ticks per span', () => {
  expect(tickIntervalFor(88000)).toBe(20000)
  expect(tickIntervalFor(200000)).toBe(50000)
  expect(tickIntervalFor(1000)).toBe(200)
})

test('tick spacing across lanes reports the ratio of their scales', () => {
  const tight = frameTickXs(
    {
      refName: 'a',
      min: 0,
      max: 100000,
      flipped: false,
      alsoOn: [],
      alsoOnMore: 0,
      fitMin: 0,
      fitMax: 100000,
    },
    20000,
    800,
  )
  const wide = frameTickXs(
    {
      refName: 'a',
      min: 0,
      max: 200000,
      flipped: false,
      alsoOn: [],
      alsoOnMore: 0,
      fitMin: 0,
      fitMax: 200000,
    },
    20000,
    800,
  )
  expect(tight[1]! - tight[0]!).toBeCloseTo(2 * (wide[1]! - wide[0]!))
})

test('a lane far enough out that its ticks would hatch draws none', () => {
  expect(
    frameTickXs(
      {
        refName: 'a',
        min: 0,
        max: 100000000,
        flipped: false,
        alsoOn: [],
        alsoOnMore: 0,
        fitMin: 0,
        fitMax: 100000000,
      },
      20000,
      800,
    ),
  ).toEqual([])
})

test('a forward row frame spans its placements unflipped', () => {
  const groups = groupFeatures(features)
  const frame = computeRowFrame(groups, 'peach')!
  expect(frame.refName).toBe('Pp1')
  expect(frame.flipped).toBe(false)
  expect(frame.min).toBeLessThanOrEqual(1000)
  expect(frame.max).toBeGreaterThanOrEqual(1300)
})

test('a row whose placements run against the anchor order flips', () => {
  const frame = computeRowFrame(groupFeatures(features), 'cacao')!
  expect(frame.flipped).toBe(true)
  const width = 800
  const g1x = rowFrameX(frame, 9050, width)
  const g3x = rowFrameX(frame, 8050, width)
  expect(g1x).toBeLessThan(g3x)
})

test('features carrying syntenyId group on it even with no names', () => {
  const groups = groupFeatures([
    new SimpleFeature({
      uniqueId: '0-1-0-7',
      refName: 'chr1',
      start: 100,
      end: 200,
      syntenyId: 7,
      assemblyName: 'anchor',
      mate: { assemblyName: 'peach', refName: 'Pp1', start: 1000, end: 1100 },
    }),
    new SimpleFeature({
      uniqueId: '0-2-0-7',
      refName: 'chr1',
      start: 100,
      end: 200,
      syntenyId: 7,
      assemblyName: 'anchor',
      mate: { assemblyName: 'cacao', refName: 'Cc1', start: 9000, end: 9100 },
    }),
  ])
  expect(groups).toHaveLength(1)
  expect([...groups[0]!.mates.keys()]).toEqual(['peach', 'cacao'])
})

test('the clipped pieces of one record are one group each, weighed by the clipped anchor bp', () => {
  const piece = (window: string, start: number, end: number) =>
    new SimpleFeature({
      uniqueId: `0-3000:${window}`,
      refName: 'chr1',
      start,
      end,
      syntenyId: `0:3000:${window}`,
      assemblyName: 'anchor',
      mate: { assemblyName: 'peach', refName: 'Pp1', start, end },
    })
  const groups = groupFeatures([
    piece('0-1000', 700, 1000),
    piece('1000-2000', 1000, 1400),
  ])
  expect(groups.map(g => [g.key, g.weight])).toEqual([
    ['0:3000:0-1000', 300],
    ['0:3000:1000-2000', 400],
  ])
})

test('contiguous blocks on one refName merge into one whole-base region', () => {
  const block = (
    refName: string,
    start: number,
    end: number,
    assemblyName = 'anchor',
  ) => ({ assemblyName, refName, start, end })
  expect(
    mergeContiguousRegions([
      block('chr1', 0.5, 1000),
      block('chr1', 1000, 2000),
      block('chr1', 2000, 2999.5),
      block('chr1', 5000, 6000),
      block('chr2', 6000, 7000),
      block('chr2', 7000, 8000, 'other'),
    ]),
  ).toEqual([
    block('chr1', 0, 3000),
    block('chr1', 5000, 6000),
    block('chr2', 6000, 7000),
    block('chr2', 7000, 8000, 'other'),
  ])
  // a reversed region's blocks run the other way along the refName
  expect(
    mergeContiguousRegions([
      block('chr1', 2000, 3000),
      block('chr1', 1000, 2000),
    ]),
  ).toEqual([block('chr1', 1000, 3000)])
  expect(mergeContiguousRegions([])).toEqual([])
})

test('a group with nothing on the dominant refName gets no span on that row', () => {
  const groups = groupFeatures([
    ...features,
    pairFeature({
      uniqueId: '6',
      name: 'g4',
      start: 700,
      end: 800,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp2',
        start: 50,
        end: 60,
        name: 'px',
      },
    }),
  ])
  const frame = computeRowFrame(groups, 'peach')!
  expect(frame.refName).toBe('Pp1')
  const g4 = groups.find(g => g.key === 'g4')!
  expect(groupSpansOnRow(g4, 'peach', frame, 800)).toEqual([])
  const g1 = groups.find(g => g.key === 'g1')!
  const span = groupSpansOnRow(g1, 'peach', frame, 800)[0]!
  expect(span[0]).toBeLessThan(span[1])
})

test('a far-flung repeat placement does not stretch the frame', () => {
  const groups = groupFeatures([
    ...features,
    pairFeature({
      uniqueId: '7',
      name: 'g5',
      start: 700,
      end: 800,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 900000,
        end: 900050,
        name: 'repeat-hit',
      },
    }),
  ])
  const frame = computeRowFrame(groups, 'peach', 1000)!
  expect(frame.max).toBeLessThan(10000)
})

test('a placement outside the frame does not reach the drawn span', () => {
  const groups = groupFeatures([
    pairFeature({
      uniqueId: '1',
      name: 'g1',
      start: 100,
      end: 200,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 1000,
        end: 1100,
        name: 'p1',
      },
    }),
    pairFeature({
      uniqueId: '2',
      name: 'g1',
      start: 100,
      end: 200,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 900000,
        end: 900100,
        name: 'repeat-hit',
      },
    }),
    pairFeature({
      uniqueId: '3',
      name: 'g2',
      start: 300,
      end: 400,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 1200,
        end: 1300,
        name: 'p2',
      },
    }),
  ])
  const frame = computeRowFrame(groups, 'peach', 1000)!
  const spans = groupSpansOnRow(groups[0]!, 'peach', frame, 800)
  expect(spans).toHaveLength(1)
  expect(spans[0]![1] - spans[0]![0]).toBeLessThan(800)
})

test('a lane slides to line its orthologs up with the lane above', () => {
  const groups = groupFeatures(
    [100, 300, 500, 700].map((start, i) =>
      pairFeature({
        uniqueId: `${i}`,
        name: `g${i}`,
        start,
        end: start + 60,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: start + 500000,
          end: start + 500060,
          name: `p${i}`,
        },
      }),
    ),
  )
  const frames = alignRowFrames(
    groups,
    ['peach'],
    anchorSeed(groups, 800),
    1000,
    800,
  )
  const frame = frames.get('peach')!
  const offsets = groups.map(group => {
    const anchorX = anchorSeedX(group.anchor.start + 30, 800)
    const laneX = rowFrameX(
      frame,
      group.mates.get('peach')![0]!.start + 30,
      800,
    )
    return Math.abs(anchorX - laneX)
  })
  expect(Math.max(...offsets)).toBeLessThanOrEqual(8)
})

test('the aligned frame lines up the median placement even past its fit', () => {
  const groups = groupFeatures(
    [
      [100, 500_000],
      [500, 500_400],
      [900, 500_900],
    ].map(([start, mateStart], i) =>
      pairFeature({
        uniqueId: `${i}`,
        name: `g${i}`,
        start: start!,
        end: start! + 60,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: mateStart!,
          end: mateStart! + 60,
          name: `p${i}`,
        },
      }),
    ),
  )
  const frame = alignRowFrames(
    groups,
    ['peach'],
    anchorSeed(groups, 800),
    1000,
    800,
  ).get('peach')!
  expect(rowFrameX(frame, 500_030, 800)).toBeCloseTo(anchorSeedX(130, 800))
  expect(rowFrameX(frame, 500_430, 800)).toBeCloseTo(anchorSeedX(530, 800))
  expect(frame.max).toBeLessThan(frame.fitMax)
})

// a centre snap moves a frame up to half a grid step, more than this rung leaves
test('a fit that nearly fills its rung is still covered by the snapped frame', () => {
  const mateLane = (mateStart: number, mateEnd: number) =>
    groupFeatures([
      pairFeature({
        uniqueId: '1',
        name: 'g1',
        start: 100,
        end: 160,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: mateStart,
          end: mateStart + 60,
          name: 'p1',
        },
      }),
      pairFeature({
        uniqueId: '2',
        name: 'g2',
        start: 900,
        end: 960,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: mateEnd - 60,
          end: mateEnd,
          name: 'p2',
        },
      }),
    ])

  const frame = computeRowFrame(mateLane(500000, 500913), 'peach', 1000)!
  expect(frame.max - frame.min).toBe(1000)
  expect(frame.min).toBeLessThanOrEqual(frame.fitMin)
  expect(frame.max).toBeGreaterThanOrEqual(frame.fitMax)

  for (const width of [913, 950, 990, 1450, 1950, 2900, 4900, 7900]) {
    for (const offset of [0, 37, 62, 88, 121]) {
      const start = 500000 + offset
      const lane = computeRowFrame(
        mateLane(start, start + width),
        'peach',
        1000,
      )!
      expect(lane.min).toBeLessThanOrEqual(lane.fitMin)
      expect(lane.max).toBeGreaterThanOrEqual(lane.fitMax)
      const window = laneFetchWindow(lane)
      expect(window.min).toBeLessThanOrEqual(lane.min)
      expect(window.max).toBeGreaterThanOrEqual(lane.max)
    }
  }
})

test('a lane running against the lane above comes out flipped', () => {
  const groups = groupFeatures(
    [100, 300, 500, 700].map((start, i) =>
      pairFeature({
        uniqueId: `${i}`,
        name: `g${i}`,
        start,
        end: start + 60,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: 500000 - start,
          end: 500060 - start,
          name: `p${i}`,
        },
      }),
    ),
  )
  expect(
    alignRowFrames(groups, ['peach'], anchorSeed(groups, 800), 1000, 800).get(
      'peach',
    )!.flipped,
  ).toBe(true)
})

test('the lane fetch window covers every position the frame can slide to', () => {
  const groups = groupFeatures(
    [100, 300, 500].map((start, i) =>
      pairFeature({
        uniqueId: `${i}`,
        name: `g${i}`,
        start,
        end: start + 60,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: start + 500000,
          end: start + 500060,
          name: `p${i}`,
        },
      }),
    ),
  )
  const windows = [400, 800, 1600].map(width => {
    const frame = alignRowFrames(
      groups,
      ['peach'],
      anchorSeed(groups, width),
      1000,
      width,
    ).get('peach')!
    return { frame, reach: laneFetchWindow(frame) }
  })
  for (const { reach } of windows) {
    expect(reach).toEqual(windows[0]!.reach)
  }
  for (const { frame } of windows) {
    expect(frame.min).toBeGreaterThanOrEqual(windows[0]!.reach.min)
    expect(frame.max).toBeLessThanOrEqual(windows[0]!.reach.max)
  }
})

describe('a lane frame near a contig start', () => {
  function nearZeroGroups(start: number) {
    return groupFeatures([
      pairFeature({
        uniqueId: '1',
        name: 'g1',
        start: 100,
        end: 200,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start,
          end: start + 100,
          name: 'p1',
        },
      }),
      pairFeature({
        uniqueId: '2',
        name: 'g2',
        start: 300,
        end: 400,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: start + 500,
          end: start + 600,
          name: 'p2',
        },
      }),
    ])
  }

  test.each([0, 60, 100, 500, 5000])(
    'centres on its placements from %ibp and states no negative coordinate',
    start => {
      const frame = computeRowFrame(nearZeroGroups(start), 'peach', 1000)!
      expect((frame.min + frame.max) / 2).toBeCloseTo(start + 300)
      expect(frame.fitMin).toBeGreaterThanOrEqual(0)
      expect(laneRegion({ frame, canon: ref => ref })!.start).toBe(
        Math.max(0, Math.round(frame.min)),
      )
      expect(laneFetchRegion(frame).start).toBeGreaterThanOrEqual(0)
      for (const x of frameTickXs(frame, 200, 800)) {
        expect(x).toBeGreaterThanOrEqual(rowFrameX(frame, 0, 800))
      }
    },
  )

  test('keeps its ladder rung rather than being squashed against zero', () => {
    const away = computeRowFrame(nearZeroGroups(50_000), 'peach', 1000)!
    const atZero = computeRowFrame(nearZeroGroups(0), 'peach', 1000)!
    expect(atZero.max - atZero.min).toBeCloseTo(away.max - away.min, 6)
  })
})

test('a placement takes its orientation from the feature, not from the mate', () => {
  const groups = groupFeatures([
    pairFeature({
      uniqueId: '1',
      name: 'g1',
      start: 100,
      end: 200,
      strand: -1,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 1000,
        end: 1100,
        name: 'p1',
      },
    }),
    pairFeature({
      uniqueId: '2',
      name: 'g2',
      start: 300,
      end: 400,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 1200,
        end: 1300,
        name: 'p2',
      },
    }),
  ])
  expect(groups.map(g => g.mates.get('peach')![0]!.orientation)).toEqual([
    -1, 1,
  ])
})

describe('a reverse-strand block', () => {
  function orientedGroups(strand: number) {
    return groupFeatures([
      pairFeature({
        uniqueId: '1',
        name: 'g1',
        start: 100,
        end: 200,
        strand,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: 1000,
          end: 1100,
          name: 'p1',
        },
      }),
      pairFeature({
        uniqueId: '2',
        name: 'g2',
        start: 300,
        end: 400,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: 1200,
          end: 1300,
          name: 'p2',
        },
      }),
    ])
  }

  test('hands the ribbon its ends the other way round', () => {
    const forward = orientedGroups(1)
    const reverse = orientedGroups(-1)
    const frame = computeRowFrame(forward, 'peach', 1000)!
    const fwd = groupSpansOnRow(forward[0]!, 'peach', frame, 800)[0]!
    const rev = groupSpansOnRow(reverse[0]!, 'peach', frame, 800)[0]!
    expect(fwd[0]).toBeLessThan(fwd[1])
    expect(rev[0]).toBeGreaterThan(rev[1])
    expect(rev).toEqual([fwd[1], fwd[0]])
  })

  test('leaves the forward block beside it untwisted', () => {
    const groups = orientedGroups(-1)
    const frame = computeRowFrame(groups, 'peach', 1000)!
    const g2 = groupSpansOnRow(groups[1]!, 'peach', frame, 800)[0]!
    expect(g2[0]).toBeLessThan(g2[1])
  })
})

test('a flipped lane reverses the ends of a forward block', () => {
  const groups = groupFeatures([
    pairFeature({
      uniqueId: '1',
      name: 'g1',
      start: 100,
      end: 200,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 1000,
        end: 1100,
        name: 'p1',
      },
    }),
  ])
  const frame = computeRowFrame(groups, 'peach', 1000)!
  const upright = groupSpansOnRow(groups[0]!, 'peach', frame, 800)[0]!
  const mirrored = groupSpansOnRow(
    groups[0]!,
    'peach',
    { ...frame, flipped: true },
    800,
  )[0]!
  expect(upright[0]).toBeLessThan(upright[1])
  expect(mirrored[0]).toBeGreaterThan(mirrored[1])
})

describe('a group placed twice on one lane', () => {
  function twiceGroups(secondStart: number, secondStrand = 1) {
    return groupFeatures([
      pairFeature({
        uniqueId: '1',
        name: 'g1',
        start: 100,
        end: 200,
        strand: -1,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: 1000,
          end: 1600,
          name: 'p1',
        },
      }),
      pairFeature({
        uniqueId: '2',
        name: 'g1',
        start: 100,
        end: 200,
        strand: secondStrand,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: secondStart,
          end: secondStart + 70,
          name: 'p1b',
        },
      }),
      pairFeature({
        uniqueId: '3',
        name: 'g2',
        start: 300,
        end: 400,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: 1800,
          end: 1900,
          name: 'p2',
        },
      }),
    ])
  }

  test('draws its two disjoint hits as two spans, not one over the gap', () => {
    const groups = twiceGroups(1700)
    const frame = computeRowFrame(groups, 'peach', 1000)!
    const spans = groupSpansOnRow(groups[0]!, 'peach', frame, 800)
    expect(spans).toHaveLength(2)
    const [first, second] = spans as [
      readonly [number, number],
      readonly [number, number],
    ]
    const drawn = [first, second].reduce(
      (sum, [a, b]) => sum + Math.abs(b - a),
      0,
    )
    const ends = [...first, ...second]
    const merged = Math.max(...ends) - Math.min(...ends)
    // the 100 bp between the two hits, at the frame's 0.8 px/bp
    expect(merged - drawn).toBeCloseTo(80, 6)
  })

  test('merges the hits that touch, under the length-weighted sign', () => {
    const groups = twiceGroups(1550)
    const frame = computeRowFrame(groups, 'peach', 1000)!
    const spans = groupSpansOnRow(groups[0]!, 'peach', frame, 800)
    expect(spans).toHaveLength(1)
    expect(spans[0]![0]).toBeGreaterThan(spans[0]![1])
  })
})

test('the alignment shift slides a lane below zero to line it up', () => {
  const groups = groupFeatures([
    pairFeature({
      uniqueId: '1',
      name: 'g1',
      start: 700,
      end: 800,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 0,
        end: 100,
        name: 'p1',
      },
    }),
    pairFeature({
      uniqueId: '2',
      name: 'g2',
      start: 900,
      end: 1000,
      mate: {
        assemblyName: 'peach',
        refName: 'Pp1',
        start: 500,
        end: 600,
        name: 'p2',
      },
    }),
  ])
  const width = 800
  const frame = alignRowFrames(
    groups,
    ['peach'],
    anchorSeed(groups, width),
    1000,
    width,
  ).get('peach')!
  expect(frame.min).toBeLessThan(0)
  expect(rowFrameX(frame, 550, width)).toBeCloseTo(anchorSeedX(950, width))
  expect(laneFetchRegion(frame).start).toBe(0)
})

// `rowFrameX` extrapolates, so an unclipped endpoint sweeps a ribbon across the page
test('a span outside the lane reach has no px pair to draw from', () => {
  const frame = computeRowFrame(groupFeatures(features), 'peach', 1000)!
  const reach = frameReach(frame)
  const region = laneFetchRegion(frame)
  expect(region.end).toBeGreaterThan(reach.max)

  expect(frameSpan(frame, frame.min + 10, frame.min + 20, 800)).toBeDefined()
  expect(frameSpan(frame, reach.max - 10, reach.max + 10, 800)).toEqual([
    1192, 1200,
  ])
  expect(frameSpan(frame, reach.max + 10, reach.max - 10, 800)).toEqual([
    1200, 1192,
  ])
  expect(frameSpan(frame, reach.max + 10, region.end, 800)).toBeUndefined()
  expect(frameSpan(frame, region.end, reach.max + 10, 800)).toBeUndefined()
})

test('a lane sits on the contig explaining the most anchor bp, not the most hits', () => {
  const groups = groupFeatures([
    // three short repeat hits...
    ...['a', 'b', 'c'].map((suffix, i) =>
      pairFeature({
        uniqueId: `repeat${suffix}`,
        start: 100 * (i + 1),
        end: 100 * (i + 1) + 20,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp_repeats',
          start: 1000 * (i + 1),
          end: 1000 * (i + 1) + 20,
        },
      }),
    ),
    // ...against two syntenic blocks, which are fewer and far longer
    ...['d', 'e'].map((suffix, i) =>
      pairFeature({
        uniqueId: `block${suffix}`,
        start: 1000 * (i + 1),
        end: 1000 * (i + 1) + 400,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: 5000 * (i + 1),
          end: 5000 * (i + 1) + 400,
        },
      }),
    ),
  ])
  expect(computeRowFrame(groups, 'peach')!.refName).toBe('Pp1')
})

// built so the anchor and mate axes disagree on which contig weighs more
test('the lane and the panel launched off it pick the same contig', () => {
  const mixed = [
    ...['a', 'b', 'c'].map((suffix, i) =>
      pairFeature({
        uniqueId: `long-anchor-${suffix}`,
        name: `la${suffix}`,
        start: 1000 * (i + 1),
        end: 1000 * (i + 1) + 400,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp2',
          start: 2000 * (i + 1),
          end: 2000 * (i + 1) + 20,
          name: `la${suffix}`,
        },
      }),
    ),
    ...['d', 'e'].map((suffix, i) =>
      pairFeature({
        uniqueId: `long-mate-${suffix}`,
        name: `lm${suffix}`,
        start: 100 * (i + 1),
        end: 100 * (i + 1) + 20,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          start: 5000 * (i + 1),
          end: 5000 * (i + 1) + 400,
          name: `lm${suffix}`,
        },
      }),
    ),
  ]
  expect(computeRowFrame(groupFeatures(mixed), 'peach')!.refName).toBe(
    resolvePanel(mixed, undefined)!.refName,
  )
})

test('a lane fetches the same region as its fitted extent wobbles', () => {
  const frame = (fitMax: number) => ({
    refName: 'Pp1',
    min: 0,
    max: 100000,
    flipped: false,
    alsoOn: [],
    alsoOnMore: 0,
    fitMin: 0,
    fitMax,
  })
  // 131,072 sits between the two window widths these produce
  expect(laneFetchRegion(frame(68900))).toEqual(laneFetchRegion(frame(69000)))
})

test('the fetch region bound is a fact of the span alone', () => {
  const span = 1_100_000
  const widths = new Set<number>()
  for (let at = 4_000_000; at < 24_000_000; at += 50_000) {
    const { start, end } = laneFetchRegion({
      refName: 'chr1',
      min: at,
      max: at + span,
      fitMin: at,
      fitMax: at + span,
      flipped: false,
      alsoOn: [],
      alsoOnMore: 0,
    })
    widths.add(end - start)
    expect(end - start).toBeLessThanOrEqual(laneFetchRegionMaxBp(span))
  }
  expect(widths.size).toBe(2)
})

test('a lane whose shared order votes both ways keeps the anchor-order flip', () => {
  // the anchor-order vote counts steps; this one weights each by the shorter of the pair
  const mates = [
    { start: 970, end: 1030 },
    { start: 770, end: 830 },
    { start: 540, end: 660 },
    { start: 840, end: 960 },
  ]
  const groups = groupFeatures(
    [100, 300, 500, 700].map((start, i) =>
      pairFeature({
        uniqueId: `${i}`,
        name: `g${i}`,
        start,
        end: start + 60,
        mate: {
          assemblyName: 'peach',
          refName: 'Pp1',
          ...mates[i]!,
          name: `p${i}`,
        },
      }),
    ),
  )
  expect(computeRowFrame(groups, 'peach', 1000)!.flipped).toBe(true)
  expect(
    alignRowFrames(groups, ['peach'], anchorSeed(groups, 800), 1000, 800).get(
      'peach',
    )!.flipped,
  ).toBe(true)
})

describe('a grouped feature groups as its pairwise expansion', () => {
  const groupedMates = [
    {
      assemblyName: 'peach',
      refName: 'Pp1',
      start: 1000,
      end: 1100,
      strand: 1,
      orientation: 1,
      name: 'p1',
    },
    {
      assemblyName: 'cacao',
      refName: 'Cc1',
      start: 9000,
      end: 9100,
      strand: -1,
      orientation: -1,
      name: 'c1',
    },
    {
      assemblyName: 'peach',
      refName: 'Pp1',
      start: 1000,
      end: 1100,
      strand: 1,
      orientation: 1,
      name: 'p1',
    },
    {
      assemblyName: 'peach',
      refName: 'Pp2',
      start: 5000,
      end: 5100,
      strand: 1,
      orientation: -1,
      name: 'p1b',
    },
  ]
  const groupedFeature = new SimpleFeature({
    uniqueId: '0-0',
    refName: 'chr1',
    start: 100,
    end: 200,
    strand: -1,
    name: 'g1',
    assemblyName: 'anchor',
    mates: groupedMates,
  })
  const expansion = groupedMates.map(({ orientation, ...mate }, i) =>
    pairFeature({
      uniqueId: `0-${i}-0-0`,
      name: 'g1',
      start: 100,
      end: 200,
      strand: orientation,
      mate,
    }),
  )
  const other = pairFeature({
    uniqueId: '9',
    name: 'g0',
    start: 10,
    end: 20,
    mate: { assemblyName: 'peach', refName: 'Pp1', start: 900, end: 950 },
  })
  const comparable = (groups: MultiWayGroup[]) =>
    groups.map(({ key, anchor, mates, weight }) => ({
      key,
      anchor,
      mates: [...mates].map(([assemblyName, placements]) => [
        assemblyName,
        placements.map(({ feature: _, ...placement }) => placement),
      ]),
      weight,
    }))

  test('same groups, same placements, orientation per mate', () => {
    const fromGrouped = groupFeatures([groupedFeature, other])
    const fromPairwise = groupFeatures([...expansion, other])
    expect(comparable(fromGrouped)).toEqual(comparable(fromPairwise))
    expect(fromGrouped.map(g => g.key)).toEqual(['g0', 'g1'])
    const g1 = fromGrouped[1]!
    const feature = groupedFeature
    expect(g1.mates.get('peach')).toEqual([
      {
        refName: 'Pp1',
        start: 1000,
        end: 1100,
        name: 'p1',
        orientation: 1,
        feature,
      },
      {
        refName: 'Pp2',
        start: 5000,
        end: 5100,
        name: 'p1b',
        orientation: -1,
        feature,
      },
    ])
    expect(g1.mates.get('cacao')).toEqual([
      {
        refName: 'Cc1',
        start: 9000,
        end: 9100,
        name: 'c1',
        orientation: -1,
        feature,
      },
    ])
  })

  test('each pairwise placement keeps its own row, the grouped ones the one feature', () => {
    const records = (groups: MultiWayGroup[]) =>
      groups
        .find(g => g.key === 'g1')!
        .mates.get('peach')!
        .map(p => p.feature)
    expect(records(groupFeatures(expansion))).toEqual([
      expansion[0],
      expansion[3],
    ])
    expect(records(groupFeatures([groupedFeature]))).toEqual([
      groupedFeature,
      groupedFeature,
    ])
  })

  // on the grouped shape the group strand is the anchor gene's transcription strand
  test('the group strand does not stand in for a mate orientation', () => {
    const [g1] = groupFeatures([groupedFeature])
    expect(g1!.feature.get('strand')).toBe(-1)
    expect(g1!.mates.get('peach')![0]!.orientation).toBe(1)
  })

  test('the group keeps the grouped feature, whose json lists every mate', () => {
    const [g1] = groupFeatures([groupedFeature])
    expect(g1!.feature).toBe(groupedFeature)
    expect(g1!.feature.toJSON().mates).toHaveLength(4)
  })

  test('the two shapes mixed in one fetch still fold per anchor', () => {
    const groups = groupFeatures([expansion[0]!, groupedFeature])
    expect(comparable(groups)).toEqual(
      comparable(groupFeatures([groupedFeature])),
    )
  })
})

// the fetch asks for the view's static blocks, so a clipped record reaches past the window
describe('a lane fitted to one record clipped to the padded fetch region', () => {
  const WINDOW = { start: 196_640_000, end: 196_900_066 }
  const FETCHED = { start: 196_540_734, end: 196_956_840 }
  const SPAN_BP = WINDOW.end - WINDOW.start
  const FETCHED_BP = FETCHED.end - FETCHED.start
  // the CFHR3-CFHR1 deletion, the one thing a carrier's record is short by
  const DELETION = 84_552

  // lengthDelta: the haplotype's own sequence over the reference's across FETCHED
  const haplotype = (lane: string, lengthDelta: number, strand = 1) =>
    groupFeatures([
      pairFeature({
        uniqueId: lane,
        start: FETCHED.start,
        end: FETCHED.end,
        strand,
        mate: {
          assemblyName: lane,
          refName: 'chr1',
          start: 1_000_000,
          end: 1_000_000 + FETCHED_BP + lengthDelta,
        },
      }),
    ])

  const laneSpan = (groups: ReturnType<typeof groupFeatures>, lane: string) => {
    const frame = computeRowFrame(
      groups.map(g => clipGroupToAnchor(g, WINDOW.start, WINDOW.end)),
      lane,
      SPAN_BP,
    )!
    return frame.max - frame.min
  }

  test('a haplotype matching the reference draws the window, not the fetch', () => {
    expect(laneSpan(haplotype('hg002', 0), 'hg002')).toBe(SPAN_BP)
  })

  test('a haplotype short by a deletion still draws no more than the window', () => {
    expect(laneSpan(haplotype('hg005', -DELETION), 'hg005')).toBe(SPAN_BP)
  })

  // RUNG_TOLERANCE keeps a fraction of a percent over the window off the rung above
  test('a haplotype longer than the window by an insertion draws the window', () => {
    const insertion = 541
    const groups = haplotype(
      'hg00133',
      Math.round((insertion * FETCHED_BP) / SPAN_BP),
    )
    const [mate] = clipGroupToAnchor(
      groups[0]!,
      WINDOW.start,
      WINDOW.end,
    ).mates.get('hg00133')!
    expect(mate!.end - mate!.start).toBe(SPAN_BP + insertion)
    expect(laneSpan(groups, 'hg00133')).toBe(SPAN_BP)
  })

  test('the cuts swap ends on a reverse-strand mate', () => {
    const head = WINDOW.start - FETCHED.start
    const tail = FETCHED.end - WINDOW.end
    const mateOf = (strand: number) => {
      const [group] = haplotype('hg002', 0, strand)
      return clipGroupToAnchor(group!, WINDOW.start, WINDOW.end)
        .mates.get('hg002')!
        .map(({ feature: _, ...placement }) => placement)
    }
    expect(mateOf(1)).toEqual([
      {
        refName: 'chr1',
        start: 1_000_000 + head,
        end: 1_000_000 + FETCHED_BP - tail,
        orientation: 1,
      },
    ])
    expect(mateOf(-1)).toEqual([
      {
        refName: 'chr1',
        start: 1_000_000 + tail,
        end: 1_000_000 + FETCHED_BP - head,
        orientation: -1,
      },
    ])
  })

  test('a group the window already contains is left alone', () => {
    const [group] = haplotype('hg002', 0)
    expect(clipGroupToAnchor(group!, FETCHED.start, FETCHED.end)).toBe(group)
  })
})
