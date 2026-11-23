import { SimpleFeature } from '@jbrowse/core/util'

import { NO_OPS } from './alignmentOps.ts'
import { LaneGene } from './geneGlyph.ts'
import {
  decideLaneFrames,
  frameFromDecision,
  nudgeDecision,
} from './laneDecision.ts'
import { changeLabel, laneRegion, shownLaneChanges } from './laneHeader.ts'
import { buildLanes, laneGeometry } from './laneStack.ts'
import {
  SPLIT_AT_GAP_BP,
  frameSegments,
  frameSpan,
  groupFeatures,
  laneIndelsOf,
  rowFrameX,
} from './layoutMultiWay.ts'
import {
  buildLaneCells,
  buildRibbonGeometry,
  glyphHitAt,
} from './multiwayGeometry.ts'
import { PX_ORIGIN } from './multiwayRenderTypes.ts'
import { laneProfiles } from './structureOrder.ts'

import type { LaneDecision } from './laneDecision.ts'
import type {
  LaneChange,
  MultiWayGroup,
  RowFrame,
  Span,
} from './layoutMultiWay.ts'
import type { MultiWayCell } from './multiwayRenderTypes.ts'

// HPRC v2.1 at CFH: four haplotypes carry the 84,684 bp CFHR3-CFHR1 deletion
// as two records that abut in the haplotype, as hprc_multiway_gfa.pif.gz does.
const WINDOW_START = 196_739_994
const WINDOW_END = 196_849_994
const DEL_START = 196_759_449
const DEL_END = 196_844_133
const BEFORE = DEL_START - WINDOW_START
const AFTER = WINDOW_END - DEL_END
const WIDTH = 1100
const UNIT_BP = WINDOW_END - WINDOW_START

const px = (bp: number) => ((bp - WINDOW_START) / UNIT_BP) * WIDTH

const CARRIERS = {
  'HG01123.1': ['CM089081.1', 191_900_000],
  'HG01109.1': ['JAHEPA020000055.1', 49_410_000],
  'HG02055.1': ['CM092205.1', 202_000_000],
  'HG01960.1': ['CM088644.1', 196_590_000],
} as const
const NON_CARRIERS = {
  'HG00097.1': ['CM094060.1', 199_230_000],
  'HG00099.1': ['JBHDWO010000059.1', 61_670_000],
} as const
const LANES = [...Object.keys(NON_CARRIERS), ...Object.keys(CARRIERS)]

function piece(
  id: string,
  start: number,
  end: number,
  mates: { assemblyName: string; refName: string; start: number }[],
  orientation = 1,
  recordId?: string,
) {
  return new SimpleFeature({
    uniqueId: id,
    recordId,
    refName: 'chr1',
    start,
    end,
    assemblyName: 'hg38',
    mates: mates.map(m => ({
      ...m,
      end: m.start + end - start,
      orientation,
    })),
  })
}

function cfhFeatures() {
  const carriers = Object.entries(CARRIERS).map(
    ([assemblyName, [ref, at]]) => ({
      assemblyName,
      refName: ref,
      start: at,
    }),
  )
  return [
    piece('cfh/0', WINDOW_START, DEL_START, carriers, 1, 'cfh-before'),
    piece(
      'cfh/1',
      DEL_END,
      WINDOW_END,
      carriers.map(c => ({ ...c, start: c.start + BEFORE })),
      1,
      'cfh-after',
    ),
    ...Object.entries(NON_CARRIERS).map(([assemblyName, [ref, at]]) =>
      piece(`whole-${assemblyName}`, WINDOW_START, WINDOW_END, [
        { assemblyName, refName: ref, start: at },
      ]),
    ),
  ]
}

const anchorCenter = (g: MultiWayGroup) => (g.anchor.start + g.anchor.end) / 2

function decide(groups: MultiWayGroup[], assemblyNames = LANES) {
  return decideLaneFrames({
    groups,
    openingsOf: laneIndelsOf(groups).openings,
    assemblyNames,
    anchorX: new Map(groups.map(g => [g.key, px(anchorCenter(g))])),
    anchorCoordOf: g => ({ refName: 'chr1', coord: anchorCenter(g) }),
    pxOfAnchor: c => px(c.coord),
    unitBp: UNIT_BP,
    width: WIDTH,
    previous: new Map(),
  })
}

function framesOf(
  groups: MultiWayGroup[],
  decisions: Map<string, LaneDecision | undefined>,
) {
  const openingsOf = laneIndelsOf(groups).openings
  return new Map(
    [...decisions].map(([assemblyName, d]) => [
      assemblyName,
      d &&
        frameFromDecision(
          d,
          px(d.pivotAnchor.coord),
          UNIT_BP,
          WIDTH,
          false,
          openingsOf(assemblyName, d.refName, d.flipped),
        ),
    ]),
  )
}

function stackOf(
  groups: MultiWayGroup[],
  rowFrames: Map<string, RowFrame | undefined>,
) {
  const anchorSpan = (start: number, end: number): Span => [px(start), px(end)]
  return buildLanes({
    assemblyNames: ['hg38', ...LANES],
    groups,
    anchorSpans: new Map(
      groups.map(g => [g.key, anchorSpan(g.anchor.start, g.anchor.end)]),
    ),
    rowFrames,
    axisSpanOf: (_ref, start, end) => anchorSpan(start, end),
    axisSpansOf: (_ref, start, end) => [anchorSpan(start, end)],
    anchorRegionSpans: [anchorSpan(WINDOW_START, WINDOW_END)],
    anchorBpPerPx: UNIT_BP / WIDTH,
    contigOf: () => ({ start: 0, end: 300_000_000 }),
    refNameAliasOf: () => undefined,
    width: WIDTH,
    geometry: laneGeometry(400, 1 + LANES.length),
  })
}

function ribbonSpans(cells: Map<string, MultiWayCell>, key: string) {
  const cell = cells.get(key)!
  if (cell.kind !== 'ribbons') {
    throw new Error(`${key} is not a ribbon cell`)
  }
  const { bp1, bp2, bp3, bp4, instanceCount } = cell.data
  return Array.from({ length: instanceCount }, (_, i) => ({
    upper: [bp1[i]!, bp2[i]!],
    lower: [bp4[i]!, bp3[i]!],
  }))
}

function sizeOf({ anchor: _, laneEnd: _end, ...change }: LaneChange) {
  return change
}

describe('a deletion the lane carries against the anchor', () => {
  test('a short piece nested in a long one opens nothing past the long one', () => {
    const lane = (start: number) => [
      { assemblyName: 'HG00097.1', refName: 'c', start },
    ]
    const openingsOf = laneIndelsOf(
      groupFeatures([
        piece('long', 1_000_000, 1_100_000, lane(0)),
        piece('dup', 900_000, 900_500, lane(20_000)),
        piece('next', 1_100_000, 1_150_000, lane(100_000)),
      ]),
    ).openings
    expect(openingsOf('HG00097.1', 'c')).toEqual([])
  })

  test('opens one hole per carrier, at its breakpoint, the deletion’s length', () => {
    const openingsOf = laneIndelsOf(groupFeatures(cfhFeatures())).openings
    for (const [assemblyName, [ref, at]] of Object.entries(CARRIERS)) {
      expect(openingsOf(assemblyName, ref)).toEqual([
        { at: at + BEFORE, bp: DEL_END - DEL_START },
      ])
    }
    for (const [assemblyName, [ref]] of Object.entries(NON_CARRIERS)) {
      expect(openingsOf(assemblyName, ref)).toEqual([])
    }
  })

  describe('two pieces whose anchors sit apart', () => {
    const [ref, at] = CARRIERS['HG01123.1']
    const lane = (refName: string, start: number) => [
      { assemblyName: 'HG01123.1', refName, start },
    ]
    const between = piece('moved', 12_000_000, 12_050_000, lane('other', 0))
    const meeting = (left: string, right: string) => [
      piece('a/0', 10_000_000, 10_050_000, lane(ref, at), 1, left),
      piece('b/0', 14_000_000, 14_050_000, lane(ref, at + 50_000), 1, right),
    ]

    test('open nothing as two records whose gap the lane places elsewhere', () => {
      const groups = groupFeatures([...meeting('a', 'b'), between])
      expect(laneIndelsOf(groups).openings('HG01123.1', ref)).toEqual([])
    })

    test('open the gap as one record, wherever the lane places it', () => {
      const groups = groupFeatures([...meeting('a', 'a'), between])
      expect(laneIndelsOf(groups).openings('HG01123.1', ref)).toEqual([
        { at: at + 50_000, bp: 3_950_000 },
      ])
    })

    test('open the gap as two records when the lane places it nowhere', () => {
      const groups = groupFeatures(meeting('a', 'b'))
      expect(laneIndelsOf(groups).openings('HG01123.1', ref)).toEqual([
        { at: at + 50_000, bp: 3_950_000 },
      ])
    })
  })

  test('puts both pieces of every carrier under their own anchor stretch', () => {
    const groups = groupFeatures(cfhFeatures())
    const frames = framesOf(groups, decide(groups))
    for (const [assemblyName, [ref, at]] of Object.entries(CARRIERS)) {
      const frame = frames.get(assemblyName)!
      const before = frameSpan(frame, at, at + BEFORE, WIDTH)!
      const after = frameSpan(frame, at + BEFORE, at + BEFORE + AFTER, WIDTH)!
      expect(frame.refName).toBe(ref)
      expect(before[0]).toBeCloseTo(px(WINDOW_START), 0)
      expect(before[1]).toBeCloseTo(px(DEL_START), 0)
      expect(after[0]).toBeCloseTo(px(DEL_END), 0)
      expect(after[1]).toBeCloseTo(px(WINDOW_END), 0)
    }
  })

  test('draws the same hole on every carrier, whoever its neighbour is', () => {
    const groups = groupFeatures(cfhFeatures())
    const lanes = stackOf(groups, framesOf(groups, decide(groups))).lanes
    const carrierBaselines = lanes
      .filter(lane => lane.assemblyName in CARRIERS)
      .map(lane =>
        lane.baseline.map(([a, b]) => [Math.round(a), Math.round(b)]),
      )
    expect(carrierBaselines).toHaveLength(4)
    for (const baseline of carrierBaselines) {
      expect(baseline).toEqual(carrierBaselines[0])
      expect(baseline).toHaveLength(2)
      expect(baseline[0]![1]).toBe(Math.round(px(DEL_START)))
      expect(baseline[1]![0]).toBe(Math.round(px(DEL_END)))
    }
    for (const lane of lanes.filter(
      lane => lane.assemblyName in NON_CARRIERS,
    )) {
      expect(lane.baseline).toHaveLength(1)
    }
  })

  test('names the haplotype’s own span in the lane header, the hole left out', () => {
    const groups = groupFeatures(cfhFeatures())
    const lanes = stackOf(groups, framesOf(groups, decide(groups))).lanes
    const lane = lanes.find(l => l.assemblyName === 'HG01123.1')!
    const [, at] = CARRIERS['HG01123.1']
    expect(laneRegion(lane)).toEqual({
      refName: 'CM089081.1',
      start: at,
      end: at + BEFORE + AFTER,
    })
  })

  test('cuts a carrier–carrier ribbon at the hole and straightens the one under a non-carrier', () => {
    const groups = groupFeatures(cfhFeatures())
    const stack = stackOf(groups, framesOf(groups, decide(groups)))
    const [, upperAt] = NON_CARRIERS['HG00099.1']
    const [ref1123, at1123] = CARRIERS['HG01123.1']
    const [ref1109, at1109] = CARRIERS['HG01109.1']
    const link = (
      id: string,
      upper: [string, string, number, number],
      lower: [string, string, number, number],
    ) =>
      new SimpleFeature({
        uniqueId: id,
        assemblyName: upper[0],
        refName: upper[1],
        start: upper[2],
        end: upper[3],
        strand: 1,
        mate: {
          assemblyName: lower[0],
          refName: lower[1],
          start: lower[2],
          end: lower[3],
        },
      })
    const { cells } = buildRibbonGeometry({
      stack,
      laneLinks: new Map([
        [
          'HG00099.1|HG01123.1',
          {
            links: [
              link(
                'before',
                [
                  'HG00099.1',
                  NON_CARRIERS['HG00099.1'][0],
                  upperAt,
                  upperAt + BEFORE,
                ],
                ['HG01123.1', ref1123, at1123, at1123 + BEFORE],
              ),
              link(
                'after',
                [
                  'HG00099.1',
                  NON_CARRIERS['HG00099.1'][0],
                  upperAt + DEL_END - WINDOW_START,
                  upperAt + UNIT_BP,
                ],
                [
                  'HG01123.1',
                  ref1123,
                  at1123 + BEFORE,
                  at1123 + BEFORE + AFTER,
                ],
              ),
            ],
            ops: NO_OPS,
          },
        ],
        [
          'HG01123.1|HG01109.1',
          {
            links: [
              link(
                'carriers',
                ['HG01123.1', ref1123, at1123, at1123 + BEFORE + AFTER],
                ['HG01109.1', ref1109, at1109, at1109 + BEFORE + AFTER],
              ),
            ],
            ops: NO_OPS,
          },
        ],
      ]),
      ribbonColor: 'grey',
      drawCurves: false,
    })
    const rowOf = (name: string) => LANES.indexOf(name) + 1
    const underNonCarrier = ribbonSpans(cells, `ribbons:${rowOf('HG00099.1')}`)
    expect(underNonCarrier).toHaveLength(2)
    for (const { upper, lower } of underNonCarrier) {
      expect(lower[0]).toBeCloseTo(upper[0]!, 0)
      expect(lower[1]).toBeCloseTo(upper[1]!, 0)
    }
    const betweenCarriers = ribbonSpans(cells, `ribbons:${rowOf('HG01123.1')}`)
    const holeLeft = px(DEL_START) + 0.5
    const holeRight = px(DEL_END) - 0.5
    expect(betweenCarriers.length).toBeGreaterThan(0)
    for (const { upper, lower } of betweenCarriers) {
      for (const [a, b] of [upper, lower]) {
        const lo = Math.min(a!, b!)
        const hi = Math.max(a!, b!)
        expect(hi <= holeLeft || lo >= holeRight).toBe(true)
        expect(hi - lo).toBeGreaterThan(1)
      }
    }
  })

  test('opens on a carrier aligned to the reverse strand too', () => {
    const [ref, at] = CARRIERS['HG01123.1']
    const groups = groupFeatures([
      piece(
        'rev/0',
        WINDOW_START,
        DEL_START,
        [{ assemblyName: 'HG01123.1', refName: ref, start: at + AFTER }],
        -1,
      ),
      piece(
        'rev/1',
        DEL_END,
        WINDOW_END,
        [{ assemblyName: 'HG01123.1', refName: ref, start: at }],
        -1,
      ),
    ])
    expect(laneIndelsOf(groups).openings('HG01123.1', ref, true)).toEqual([
      { at: at + AFTER, bp: DEL_END - DEL_START },
    ])
    expect(laneIndelsOf(groups).openings('HG01123.1', ref)).toEqual([])
    const frame = framesOf(groups, decide(groups, ['HG01123.1'])).get(
      'HG01123.1',
    )!
    expect(frame.flipped).toBe(true)
    const before = frameSpan(frame, at + AFTER, at + AFTER + BEFORE, WIDTH)!
    const after = frameSpan(frame, at, at + AFTER, WIDTH)!
    expect(Math.min(...before)).toBeCloseTo(px(WINDOW_START), 0)
    expect(Math.max(...before)).toBeCloseTo(px(DEL_START), 0)
    expect(Math.min(...after)).toBeCloseTo(px(DEL_END), 0)
    expect(Math.max(...after)).toBeCloseTo(px(WINDOW_END), 0)
  })

  test('opens nothing for an insertion, nor between genes', () => {
    const [ref, at] = CARRIERS['HG01123.1']
    const insertion = groupFeatures([
      piece('ins/0', WINDOW_START, WINDOW_START + 40_000, [
        { assemblyName: 'HG01123.1', refName: ref, start: at },
      ]),
      piece('ins/1', WINDOW_START + 40_000, WINDOW_END, [
        { assemblyName: 'HG01123.1', refName: ref, start: at + 70_000 },
      ]),
    ])
    expect(laneIndelsOf(insertion).openings('HG01123.1', ref)).toEqual([])
    const gene = (name: string, start: number, mateStart: number) =>
      new SimpleFeature({
        uniqueId: name,
        name,
        refName: 'chr1',
        start,
        end: start + 1000,
        strand: 1,
        assemblyName: 'hg38',
        mate: {
          assemblyName: 'HG01123.1',
          refName: ref,
          start: mateStart,
          end: mateStart + 1000,
        },
      })
    const genes = groupFeatures([
      gene('a', WINDOW_START, at),
      gene('b', WINDOW_START + 90_000, at + 2000),
    ])
    expect(laneIndelsOf(genes).openings('HG01123.1', ref)).toEqual([])
  })

  test('fits a lane pinned to face the other way with the holes of the strand it is drawn on', () => {
    const [ref, at] = CARRIERS['HG01123.1']
    const groups = groupFeatures([
      piece('fwd/0', WINDOW_START, WINDOW_START + 40_000, [
        { assemblyName: 'HG01123.1', refName: ref, start: at },
      ]),
      piece('fwd/1', WINDOW_START + 90_000, WINDOW_START + 130_000, [
        { assemblyName: 'HG01123.1', refName: ref, start: at + 40_000 },
      ]),
    ])
    const rungFacing = (flipped?: boolean) =>
      decideLaneFrames({
        groups,
        openingsOf: laneIndelsOf(groups).openings,
        assemblyNames: ['HG01123.1'],
        anchorX: new Map(groups.map(g => [g.key, px(anchorCenter(g))])),
        anchorCoordOf: g => ({ refName: 'chr1', coord: anchorCenter(g) }),
        pxOfAnchor: c => px(c.coord),
        unitBp: UNIT_BP,
        width: WIDTH,
        previous: new Map(),
        pins:
          flipped === undefined
            ? []
            : [{ lane: 'HG01123.1', refName: ref, flipped }],
      }).get('HG01123.1')!.rung
    expect(rungFacing()).toBe(1.5)
    expect(laneIndelsOf(groups).openings('HG01123.1', ref)).toEqual([
      { at: at + 40_000, bp: 50_000 },
    ])
    expect(rungFacing(true)).toBe(1)
  })

  test('keeps a frame the same under a pan that moves its pivot past the hole', () => {
    const groups = groupFeatures(cfhFeatures())
    const d = decide(groups).get('HG01123.1')!
    const [ref, at] = CARRIERS['HG01123.1']
    const openings = laneIndelsOf(groups).openings('HG01123.1', ref)
    const frame = frameFromDecision(
      d,
      px(d.pivotAnchor.coord),
      UNIT_BP,
      WIDTH,
      false,
      openings,
    )
    const moved = frameFromDecision(
      { ...d, pivotLaneBp: at + BEFORE + 1000 },
      rowFrameX(frame, at + BEFORE + 1000, WIDTH),
      UNIT_BP,
      WIDTH,
      false,
      openings,
    )
    expect(moved.min).toBeCloseTo(frame.min, 6)
    expect(moved.max).toBeCloseTo(frame.max, 6)
  })
})

describe('what a lane states across a gap against the anchor', () => {
  const [ref, at] = CARRIERS['HG01123.1']
  const gapped = (
    anchorGap: number,
    laneGap: number,
    records: [string, string],
  ) => {
    const right = WINDOW_START + 40_000 + anchorGap
    return groupFeatures([
      piece(
        'gap/0',
        WINDOW_START,
        WINDOW_START + 40_000,
        [{ assemblyName: 'HG01123.1', refName: ref, start: at }],
        1,
        records[0],
      ),
      piece(
        'gap/1',
        right,
        right + 40_000,
        [
          {
            assemblyName: 'HG01123.1',
            refName: ref,
            start: at + 40_000 + laneGap,
          },
        ],
        1,
        records[1],
      ),
    ])
  }
  const read = (groups: MultiWayGroup[]) => {
    const { openings, changes } = laneIndelsOf(groups)
    return {
      openings: openings('HG01123.1', ref),
      changes: changes('HG01123.1', ref).map(sizeOf),
    }
  }

  test('a change names the anchor stretch it sits on', () => {
    const anchorOf = (groups: MultiWayGroup[]) =>
      laneIndelsOf(groups)
        .changes('HG01123.1', ref)
        .map(c => [
          c.kind,
          c.anchor.start - WINDOW_START,
          c.anchor.end - WINDOW_START,
        ])
    expect(anchorOf(gapped(935_000, 900_000, ['r', 'r']))).toEqual([
      ['replacement', 40_000, 975_000],
    ])
    expect(anchorOf(gapped(0, 30_000, ['r', 'r']))).toEqual([
      ['insertion', 40_000, 40_000],
    ])
  })

  test('an insertion between two runs of one record, at its breakpoint, its length', () => {
    expect(read(gapped(0, 30_000, ['r', 'r']))).toEqual({
      openings: [],
      changes: [
        { at: at + 40_000, laneBp: 30_000, anchorBp: 0, kind: 'insertion' },
      ],
    })
  })

  test('nothing under SPLIT_AT_GAP_BP; an insertion between two records is one too', () => {
    expect(read(gapped(0, 9_999, ['r', 'r']))).toEqual({
      openings: [],
      changes: [],
    })
    expect(read(gapped(0, 30_000, ['r', 's']))).toEqual({
      openings: [],
      changes: [
        { at: at + 40_000, laneBp: 30_000, anchorBp: 0, kind: 'insertion' },
      ],
    })
  })

  test('one record replacing 935 kb with 900 kb states one change of both sides and opens the net', () => {
    expect(read(gapped(935_000, 900_000, ['r', 'r']))).toEqual({
      openings: [{ at: at + 40_000, bp: 35_000 }],
      changes: [
        {
          at: at + 40_000,
          laneBp: 900_000,
          anchorBp: 935_000,
          kind: 'replacement',
        },
      ],
    })
  })

  test('one record replacing 905 kb with 900 kb states one change of both sides, though the net opens nothing', () => {
    expect(read(gapped(905_000, 900_000, ['r', 'r']))).toEqual({
      openings: [],
      changes: [
        {
          at: at + 40_000,
          laneBp: 900_000,
          anchorBp: 905_000,
          kind: 'replacement',
        },
      ],
    })
  })

  test('a side of a few bp is still a side, at any ratio', () => {
    expect(read(gapped(17, 94_146, ['r', 's'])).changes).toEqual([
      { at: at + 40_000, laneBp: 94_146, anchorBp: 17, kind: 'replacement' },
    ])
    expect(read(gapped(94_204, 1, ['r', 'r'])).changes).toEqual([
      { at: at + 40_000, laneBp: 1, anchorBp: 94_204, kind: 'replacement' },
    ])
  })

  test('two records state the gap between them and open the net, as one record does', () => {
    expect(read(gapped(935_000, 900_000, ['r', 's']))).toEqual(
      read(gapped(935_000, 900_000, ['r', 'r'])),
    )
    // MAPT's LRRC37A duplicon in HG00133#1: 416 kb of GRCh38 against 233 kb
    // of its own sequence, which the PIF writes as two records
    expect(read(gapped(416_324, 233_466, ['r', 's']))).toEqual({
      openings: [{ at: at + 40_000, bp: 182_858 }],
      changes: [
        {
          at: at + 40_000,
          laneBp: 233_466,
          anchorBp: 416_324,
          kind: 'replacement',
        },
      ],
    })
  })

  test('a piece nested inside another record states no deletion between their anchor stretches', () => {
    const groups = groupFeatures([
      piece('outer', 1_000_000, 1_100_000, [
        { assemblyName: 'HG01123.1', refName: ref, start: 0 },
      ]),
      piece(
        'nested',
        2_000_000,
        2_000_500,
        [{ assemblyName: 'HG01123.1', refName: ref, start: 20_000 }],
        1,
        'other',
      ),
    ])
    expect(read(groups)).toEqual({ openings: [], changes: [] })
  })

  test('one record cut in two fetch windows states nothing about the anchor between them', () => {
    const inWindow = (window: string) => (f: SimpleFeature) =>
      new SimpleFeature({ ...f.toJSON(), clipWindow: window })
    const [left, right] = gapped(400_000, 400_000, ['r', 'r']).map(
      g => g.feature as SimpleFeature,
    )
    expect(
      read(
        groupFeatures([
          inWindow('0-100000')(left!),
          inWindow('500000-600000')(right!),
        ]),
      ),
    ).toEqual({ openings: [], changes: [] })
  })
})

describe('an inversion the lane carries against the anchor', () => {
  const [ref, at] = CARRIERS['HG01123.1']
  const run = (
    id: string,
    lane: number,
    anchor: number,
    length: number,
    orientation: number,
  ) =>
    piece(
      id,
      WINDOW_START + anchor,
      WINDOW_START + anchor + length,
      [{ assemblyName: 'HG01123.1', refName: ref, start: at + lane }],
      orientation,
    )
  const stated = (features: SimpleFeature[]) => {
    const { openings, changes } = laneIndelsOf(groupFeatures(features))
    return {
      openings: openings('HG01123.1', ref),
      changes: changes('HG01123.1', ref)
        .filter(c => c.kind !== 'inversion')
        .map(sizeOf),
    }
  }
  const named = (features: SimpleFeature[]) =>
    laneIndelsOf(groupFeatures(features))
      .changes('HG01123.1', ref)
      .filter(c => c.kind === 'inversion')
      .map(sizeOf)

  test('an inversion names the anchor stretch inverted', () => {
    const [inversion] = laneIndelsOf(
      groupFeatures([
        run('l', 0, 0, 40_000, 1),
        run('m', 40_000, 40_000, 900_000, -1),
        run('r', 940_000, 940_000, 40_000, 1),
      ]),
    ).changes('HG01123.1', ref)
    expect(inversion?.anchor).toEqual({
      refName: 'chr1',
      start: WINDOW_START + 40_000,
      end: WINDOW_START + 940_000,
    })
  })

  test('names a run of the other strand set in place between two collinear runs', () => {
    expect(
      named([
        run('l', 0, 0, 40_000, 1),
        run('m', 40_000, 40_000, 900_000, -1),
        run('r', 940_000, 940_000, 40_000, 1),
      ]),
    ).toEqual([
      {
        at: at + 40_000,
        laneBp: 900_000,
        anchorBp: 900_000,
        kind: 'inversion',
      },
    ])
  })

  test('names a forward run inside a lane reversed whole', () => {
    expect(
      named([
        run('l', 0, 940_000, 40_000, -1),
        run('m', 40_000, 40_000, 900_000, 1),
        run('r', 940_000, 0, 40_000, -1),
      ]),
    ).toEqual([
      {
        at: at + 40_000,
        laneBp: 900_000,
        anchorBp: 900_000,
        kind: 'inversion',
      },
    ])
  })

  test('names nothing for a reverse hit elsewhere on the anchor between collinear runs', () => {
    expect(
      named([
        run('l', 0, 0, 40_000, 1),
        run('m', 40_000, 5_000_000, 900_000, -1),
        run('r', 940_000, 40_000, 40_000, 1),
      ]),
    ).toEqual([])
  })

  test('a paralog hit nested inside a flank splits no run', () => {
    expect(
      named([
        run('l', 0, 0, 40_000, 1),
        run('p', 10_000, 3_000_000, 15_000, -1),
        run('m', 40_000, 40_000, 900_000, -1),
        run('r', 940_000, 940_000, 40_000, 1),
      ]),
    ).toEqual([
      {
        at: at + 40_000,
        laneBp: 900_000,
        anchorBp: 900_000,
        kind: 'inversion',
      },
    ])
  })

  // HG01960#1 at 8p23.1: each flank's inner end is a hit on the paralogous
  // REPD/REPP copy at the other breakpoint, out of anchor order
  test('names an inversion whose segdup-flanked breakpoints put paralog hits at the flanks inner ends', () => {
    expect(
      named([
        run('l1', 0, 0, 500_000, 1),
        run('l2', 500_000, 760_000, 230_000, 1),
        run('m', 730_000, 800_000, 4_000_000, -1),
        run('r1', 4_730_000, 600_000, 150_000, 1),
        run('r2', 4_880_000, 4_900_000, 1_000_000, 1),
      ]),
    ).toEqual([
      {
        at: at + 730_000,
        laneBp: 4_000_000,
        anchorBp: 4_000_000,
        kind: 'inversion',
      },
    ])
  })

  test('names no inversion for an inverted copy of a flank, and reads it as the lane’s own', () => {
    const copy = [
      run('l', 0, 0, 500_000, 1),
      run('m', 500_000, 100_000, 300_000, -1),
      run('r', 800_000, 500_000, 400_000, 1),
    ]
    expect(named(copy)).toEqual([])
    expect(stated(copy)).toEqual({
      openings: [],
      changes: [
        { at: at + 500_000, laneBp: 300_000, anchorBp: 0, kind: 'insertion' },
      ],
    })
  })

  test('states nothing but the inversion between its flanks, as one record each or as two', () => {
    const flanked = [
      run('l', 0, 0, 40_000, 1),
      run('m', 40_000, 40_000, 900_000, -1),
      run('r', 940_000, 940_000, 40_000, 1),
    ]
    expect(stated(flanked)).toEqual({ openings: [], changes: [] })
    expect(
      stated([
        run('l', 0, 0, 40_000, 1),
        run('m1', 40_000, 490_000, 450_000, -1),
        run('m2', 490_000, 40_000, 450_000, -1),
        run('r', 940_000, 940_000, 40_000, 1),
      ]),
    ).toEqual({ openings: [], changes: [] })
  })

  test('states nothing but the inversion for an unaligned stretch under SPLIT_AT_GAP_BP at each breakpoint', () => {
    expect(
      laneIndelsOf(
        groupFeatures([
          run('l', 0, 0, 40_000, 1),
          run('m', 48_000, 48_000, 400_000, -1),
          run('r', 456_000, 456_000, 40_000, 1),
        ]),
      )
        .changes('HG01123.1', ref)
        .map(changeLabel),
    ).toEqual(['400 kb inversion'])
  })

  test('states the one breakpoint stretch reaching SPLIT_AT_GAP_BP, its own size where it sits', () => {
    expect(
      laneIndelsOf(
        groupFeatures([
          run('l', 0, 0, 40_000, 1),
          run('m', 55_000, 55_000, 400_000, -1),
          run('r', 463_000, 463_000, 40_000, 1),
        ]),
      )
        .changes('HG01123.1', ref)
        .filter(c => c.kind !== 'inversion'),
    ).toEqual([
      {
        at: at + 40_000,
        laneEnd: at + 55_000,
        laneBp: 15_000,
        anchorBp: 15_000,
        kind: 'replacement',
        anchor: {
          refName: 'chr1',
          start: WINDOW_START + 40_000,
          end: WINDOW_START + 55_000,
        },
      },
    ])
  })

  const gapChanges = (features: SimpleFeature[], reversed = false) =>
    laneIndelsOf(groupFeatures(features))
      .changes('HG01123.1', ref, reversed)
      .filter(c => c.kind !== 'inversion')
  const change = (
    lane: [number, number],
    anchor: [number, number],
    anchorBp: number,
    laneBp: number,
  ) => ({
    at: at + lane[0],
    laneEnd: at + lane[1],
    laneBp,
    anchorBp,
    kind:
      laneBp === 0 ? 'deletion' : anchorBp === 0 ? 'insertion' : 'replacement',
    anchor: {
      refName: 'chr1',
      start: WINDOW_START + anchor[0],
      end: WINDOW_START + anchor[1],
    },
  })

  test('states each breakpoint stretch reaching SPLIT_AT_GAP_BP where it lies', () => {
    expect(
      gapChanges([
        run('l', 0, 0, 40_000, 1),
        run('m', 55_000, 55_000, 400_000, -1),
        run('r', 470_000, 470_000, 40_000, 1),
      ]),
    ).toEqual([
      change([40_000, 55_000], [40_000, 55_000], 15_000, 15_000),
      change([455_000, 470_000], [455_000, 470_000], 15_000, 15_000),
    ])
  })

  test('pairs the anchor lacking beside a flank with the lane at that flank, with 3 bp of lane overlap or none', () => {
    const clean = gapChanges([
      run('l', 0, 0, 40_000, 1),
      run('m', 40_000, 55_000, 400_000, -1),
      run('r', 448_000, 455_000, 40_000, 1),
    ])
    expect(clean).toEqual([
      change([40_000, 40_000], [40_000, 55_000], 15_000, 0),
    ])
    expect(
      gapChanges([
        run('l', 0, 0, 40_000, 1),
        run('m', 39_997, 55_000, 400_003, -1),
        run('r', 448_000, 455_003, 40_000, 1),
      ]),
    ).toEqual(clean)
  })

  test('states the same change of two inverted pieces whichever way the lane is drawn', () => {
    const pieces = [
      run('l', 0, 0, 100_000, 1),
      run('m1', 100_000, 315_000, 200_000, -1),
      run('m2', 308_000, 100_000, 200_000, -1),
      run('r', 508_000, 515_003, 100_000, 1),
    ]
    expect(gapChanges(pieces)).toEqual([
      change([300_000, 308_000], [300_000, 315_000], 15_000, 8_000),
    ])
    expect(gapChanges(pieces, true)).toEqual(gapChanges(pieces))
  })

  test('states a breakpoint by its own two stretches, leaving out the other breakpoint’s short one', () => {
    expect(
      gapChanges([
        run('l', 0, 0, 40_000, 1),
        run('m', 40_000, 48_000, 400_000, -1),
        run('r', 452_000, 456_000, 40_000, 1),
      ]),
    ).toEqual([change([440_000, 452_000], [448_000, 456_000], 8_000, 12_000)])
  })

  test('states an insertion at one flank and the stretch between two inverted pieces alike on either strand', () => {
    const pieces = [
      run('l', 0, 0, 100_000, 1),
      run('m1', 112_000, 315_000, 200_000, -1),
      run('m2', 320_000, 100_000, 200_000, -1),
      run('r', 520_000, 515_000, 100_000, 1),
    ]
    expect(gapChanges(pieces)).toEqual([
      change([312_000, 320_000], [300_000, 315_000], 15_000, 8_000),
      change([100_000, 112_000], [100_000, 100_000], 0, 12_000),
    ])
    expect(gapChanges(pieces, true)).toEqual(gapChanges(pieces))
  })

  test('states every lane stretch reaching SPLIT_AT_GAP_BP around two inverted pieces on either strand', () => {
    const pieces = [
      run('l', 0, 0, 40_000, 1),
      run('t0', 55_000, 51_003, 200_000, -1),
      run('t1', 270_000, 40_000, 11_000, -1),
      run('r', 296_000, 251_006, 40_000, 1),
    ]
    expect(gapChanges(pieces)).toEqual([
      change([255_000, 270_000], [51_000, 51_003], 3, 15_000),
      change([40_000, 55_000], [40_000, 40_000], 0, 15_000),
      change([281_000, 296_000], [251_003, 251_006], 3, 15_000),
    ])
    expect(gapChanges(pieces, true)).toEqual(gapChanges(pieces))
  })

  test('states the lane’s own bases between two inverted pieces that follow the anchor’s order', () => {
    expect(
      gapChanges([
        run('l', 0, 0, 40_000, 1),
        run('m1', 40_000, 40_000, 200_000, -1),
        run('m2', 252_000, 240_000, 200_000, -1),
        run('r', 452_000, 440_000, 40_000, 1),
      ]),
    ).toEqual([change([240_000, 252_000], [40_000, 440_000], 0, 12_000)])
  })

  test('keeps each stretch between two parting pieces beside a change of the other strand it shares no held base with', () => {
    const pieces = [
      run('l', 0, 0, 100_000, 1),
      run('m1', 100_000, 215_000, 100_000, -1),
      run('m2', 208_000, 100_000, 100_000, -1),
      run('m3', 320_000, 327_000, 100_000, -1),
      run('r', 420_000, 427_000, 100_000, 1),
    ]
    for (const reversed of [false, true]) {
      expect(gapChanges(pieces, reversed)).toEqual([
        change([200_000, 208_000], [200_000, 215_000], 15_000, 8_000),
        change([308_000, 320_000], [100_000, 427_000], 0, 12_000),
        change([100_000, 420_000], [315_000, 327_000], 12_000, 0),
      ])
    }
  })

  test('parts a gap at an inverted piece holding SPLIT_AT_GAP_BP, and at none holding less', () => {
    expect(
      stated([
        run('l', 0, 0, 40_000, 1),
        run('p', 40_000, 46_000, 9_000, -1),
        run('r', 49_000, 61_000, 40_000, 1),
      ]),
    ).toEqual({
      openings: [{ at: at + 40_000, bp: 12_000 }],
      changes: [
        { at: at + 40_000, laneBp: 0, anchorBp: 12_000, kind: 'deletion' },
      ],
    })
    expect(
      stated([
        run('l', 0, 0, 40_000, 1),
        run('p', 40_000, 46_000, 11_000, -1),
        run('r', 51_000, 63_000, 40_000, 1),
      ]),
    ).toEqual({ openings: [{ at: at + 40_000, bp: 12_000 }], changes: [] })
  })

  test('parts a gap at an inversion aligned as pieces each under SPLIT_AT_GAP_BP, which follow one another as one run', () => {
    expect(
      gapChanges([
        run('l', 0, 0, 40_000, 1),
        run('m1', 48_000, 60_000, 6_000, -1),
        run('m2', 54_000, 54_000, 6_000, -1),
        run('m3', 60_000, 48_000, 6_000, -1),
        run('r', 74_000, 74_000, 40_000, 1),
      ]),
    ).toEqual([])
  })

  test('a piece nested in an inverted piece’s lane bp joins no run, holding only its own anchor', () => {
    expect(
      gapChanges([
        run('l', 0, 0, 40_000, 1),
        run('m1', 48_000, 256_000, 200_000, -1),
        run('n', 100_000, 50_000, 3_000, -1),
        run('m2', 248_000, 250_000, 6_000, -1),
        run('r', 262_000, 464_000, 40_000, 1),
      ]),
    ).toEqual([change([40_000, 48_000], [40_000, 250_000], 207_000, 8_000)])
  })

  test('reads an inverted piece aligned outside the gap’s anchor as the lane’s own, parting nothing', () => {
    expect(
      gapChanges([
        run('l', 0, 0, 40_000, 1),
        run('t', 42_000, 60_000, 2_000, -1),
        run('p', 60_000, 20_000, 10_000, -1),
        run('r', 72_000, 70_000, 40_000, 1),
      ]),
    ).toEqual([change([40_000, 72_000], [40_000, 70_000], 28_000, 30_000)])
  })

  test('counts a lane base two small inverted pieces both hold once', () => {
    expect(
      gapChanges([
        run('l', 0, 0, 40_000, 1),
        run('p1', 42_000, 50_000, 2_000, -1),
        run('p2', 43_000, 47_000, 2_000, -1),
        run('r', 60_000, 60_000, 40_000, 1),
      ]),
    ).toEqual([change([40_000, 60_000], [40_000, 60_000], 16_000, 17_000)])
  })

  test('reads a breakpoint alike 1 bp or 3 bp either side of a bound, and weighs its lane bp at one anchor bin', () => {
    type Run = typeof run
    const on =
      (assemblyName: string, refName: string) =>
      (
        id: string,
        lane: number,
        anchor: number,
        length: number,
        orientation: number,
      ) =>
        new SimpleFeature({
          uniqueId: `${assemblyName}-${id}`,
          refName: 'chr1',
          start: anchor,
          end: anchor + length,
          strand: orientation,
          assemblyName: 'hg38',
          mate: {
            assemblyName,
            refName,
            start: lane,
            end: lane + length,
          },
        })
    const pairs: [
      string,
      (r: Run) => SimpleFeature[],
      (r: Run) => SimpleFeature[],
    ][] = [
      [
        '10 kb replaced by 12 kb',
        r => [
          r('l', 0, 0, 40_000, 1),
          r('m', 40_000, 48_000, 400_000, -1),
          r('r', 452_000, 458_000, 40_000, 1),
        ],
        r => [
          r('l', 0, 0, 40_000, 1),
          r('m', 40_000, 48_000, 400_000, -1),
          r('r', 452_000, 457_999, 40_000, 1),
        ],
      ],
      [
        '12 kb insertion',
        r => [
          r('l', 0, 0, 40_000, 1),
          r('m', 52_000, 40_000, 400_000, -1),
          r('r', 452_000, 440_000, 40_000, 1),
        ],
        r => [
          r('l', 0, 0, 40_000, 1),
          r('m', 52_000, 40_000, 400_000, -1),
          r('r', 452_000, 440_003, 40_000, 1),
        ],
      ],
      [
        '15 kb deletion',
        r => [
          r('l', 0, 0, 40_000, 1),
          r('m', 40_000, 55_000, 400_000, -1),
          r('r', 448_000, 455_000, 40_000, 1),
        ],
        r => [
          r('l', 0, 0, 40_000, 1),
          r('m', 40_003, 55_000, 400_000, -1),
          r('r', 448_003, 455_000, 40_000, 1),
        ],
      ],
    ]
    for (const [label, exact, shifted] of pairs) {
      const features = [...exact(on('A', 'a')), ...shifted(on('B', 'b'))]
      const { changes } = laneIndelsOf(groupFeatures(features))
      const [first, second] = [changes('A', 'a'), changes('B', 'b')].map(list =>
        list
          .filter(c => c.kind !== 'inversion')
          .map(c => [
            c.at,
            c.laneEnd,
            c.laneBp,
            c.anchorBp,
            c.anchor.start,
            c.anchor.end,
          ]),
      )
      expect(changes('A', 'a').map(changeLabel)).toContain(label)
      expect(first).toHaveLength(1)
      expect(second).toHaveLength(1)
      expect(
        Math.max(...first![0]!.map((v, i) => Math.abs(v - second![0]![i]!))),
      ).toBeLessThanOrEqual(3)
      const profiles = laneProfiles(features, NO_OPS)
      const insertBand = (lane: string) => {
        const profile = profiles.get(lane)!
        return [...profile.slice((profile.length / 3) * 2)]
      }
      const [a, b] = [insertBand('A'), insertBand('B')]
      expect(Math.max(...a.map((v, i) => Math.abs(v - b[i]!)))).toBeLessThan(
        0.01,
      )
    }
  })

  test('opens the net of short deletions at both breakpoints of an inversion, stating none', () => {
    expect(
      stated([
        run('l', 0, 0, 40_000, 1),
        run('m', 40_000, 48_000, 400_000, -1),
        run('r', 440_000, 456_000, 40_000, 1),
      ]),
    ).toEqual({ openings: [{ at: at + 40_000, bp: 16_000 }], changes: [] })
  })

  test('states a deletion that a piece clipped to no lane bp would part', () => {
    expect(
      stated([
        run('l', 0, 0, 40_000, 1),
        run('p', 39_000, 48_000, 2_000, -1),
        run('r', 40_000, 58_000, 40_000, 1),
      ]),
    ).toEqual({
      openings: [{ at: at + 40_000, bp: 18_000 }],
      changes: [
        { at: at + 40_000, laneBp: 0, anchorBp: 18_000, kind: 'deletion' },
      ],
    })
  })

  test('states a deletion whole across a small inverted piece inside it', () => {
    expect(
      stated([
        run('l', 0, 0, 40_000, 1),
        run('p', 40_000, 49_000, 500, -1),
        run('r', 40_500, 58_500, 40_000, 1),
      ]),
    ).toEqual({
      openings: [{ at: at + 40_000, bp: 18_000 }],
      changes: [
        { at: at + 40_000, laneBp: 0, anchorBp: 18_000, kind: 'deletion' },
      ],
    })
  })

  test('holds the lane bp of an inverted piece aligned inside the gap’s anchor, its part outside the lane’s own', () => {
    expect(
      gapChanges([
        run('l', 0, 0, 40_000, 1),
        run('m', 40_000, 20_000, 100_000, -1),
        run('r', 140_000, 135_000, 40_000, 1),
      ]),
    ).toEqual([change([120_000, 140_000], [120_000, 135_000], 15_000, 20_000)])
    expect(
      gapChanges(
        [
          run('l', 0, 160_000, 40_000, -1),
          run('m', 40_000, 80_000, 100_000, 1),
          run('r', 140_000, 25_000, 40_000, -1),
        ],
        true,
      ),
    ).toEqual([change([120_000, 140_000], [65_000, 80_000], 15_000, 20_000)])
  })

  test('counts a stretch by the bp it labels as, so 9,999.6 bp reaches SPLIT_AT_GAP_BP', () => {
    const m = new SimpleFeature({
      uniqueId: 'm',
      refName: 'chr1',
      start: WINDOW_START + 45_000,
      end: WINDOW_START + 345_000,
      assemblyName: 'hg38',
      mates: [
        {
          assemblyName: 'HG01123.1',
          refName: ref,
          start: at + 39_997,
          end: at + 289_997,
          orientation: -1,
        },
      ],
    })
    expect(
      gapChanges([
        run('l', 0, 0, 40_000, 1),
        m,
        run('r', 294_997, 354_996, 40_000, 1),
      ]),
    ).toEqual([change([289_997, 294_997], [344_996, 354_996], 10_000, 5_000)])
  })

  test('opens and names the anchor an inverted stretch lacks inside it, beside the inversion', () => {
    const lacking = [
      run('l', 0, 0, 40_000, 1),
      run('m1', 40_000, 540_000, 400_000, -1),
      run('m2', 440_000, 40_000, 400_000, -1),
      run('r', 840_000, 940_000, 40_000, 1),
    ]
    expect(stated(lacking)).toEqual({
      openings: [{ at: at + 40_000, bp: 100_000 }],
      changes: [
        { at: at + 440_000, laneBp: 0, anchorBp: 100_000, kind: 'deletion' },
      ],
    })
    expect(named(lacking)).toEqual([
      {
        at: at + 40_000,
        laneBp: 800_000,
        anchorBp: 800_000,
        kind: 'inversion',
      },
    ])
  })

  test('opens the anchor an inverted stretch lacks when its first piece overlaps the flank in the lane', () => {
    const overlapping = [
      run('l', 0, 0, 40_000, 1),
      run('m1', 39_997, 539_997, 400_003, -1),
      run('m2', 440_000, 40_000, 400_000, -1),
      run('r', 840_000, 940_000, 40_000, 1),
    ]
    expect(stated(overlapping)).toEqual({
      openings: [{ at: at + 40_000, bp: 100_000 }],
      changes: [
        { at: at + 440_000, laneBp: 0, anchorBp: 99_997, kind: 'deletion' },
      ],
    })
  })

  test('names a gap to a frame meeting only the lane’s own bases past its inverted piece', () => {
    const changes = laneIndelsOf(
      groupFeatures([
        run('l', 0, 0, 40_000, 1),
        run('m', 40_000, 40_000, 400_000, -1),
        run('r', 540_000, 540_000, 40_000, 1),
      ]),
    ).changes('HG01123.1', ref)
    const frame: RowFrame = {
      refName: ref,
      min: at + 300_000,
      max: at + 700_000,
      flipped: false,
      fitMin: at + 300_000,
      fitMax: at + 700_000,
      alsoOn: [],
      alsoOnMore: 0,
      alsoAt: [],
    }
    expect(
      shownLaneChanges({ frame, canon: r => r }, changes).map(changeLabel),
    ).toEqual(['400 kb inversion', '100 kb replaced by 100 kb'])
  })

  test('states the lane’s own bases between two inverted pieces once, read on either strand', () => {
    const changes = laneIndelsOf(
      groupFeatures([
        run('l', 0, 0, 100_000, 1),
        run('b1', 100_000, 150_000, 50_000, -1),
        run('b2', 180_000, 100_000, 50_000, -1),
        run('r', 230_000, 200_000, 100_000, 1),
      ]),
    ).changes
    for (const reversed of [false, true]) {
      expect(
        changes('HG01123.1', ref, reversed).map(changeLabel).toSorted(),
      ).toEqual(['100 kb inversion', '30 kb insertion'])
    }
  })

  test('names nothing with one flank', () => {
    expect(
      named([run('l', 0, 0, 40_000, 1), run('m', 40_000, 40_000, 900_000, -1)]),
    ).toEqual([])
  })
})

describe('a lane with pieces on both strands', () => {
  const rows = (
    assemblyName: string,
    refName: string,
    anchorRef: string,
    list: [number, number, number, number, number][],
  ) =>
    groupFeatures(
      list.map(
        ([start, end, mateStart, mateEnd, strand], i) =>
          new SimpleFeature({
            uniqueId: `${assemblyName}-${i}`,
            refName: anchorRef,
            start,
            end,
            strand,
            assemblyName: 'hg38',
            mate: { assemblyName, refName, start: mateStart, end: mateEnd },
          }),
      ),
    )
  const labelsOf = (
    groups: MultiWayGroup[],
    assemblyName: string,
    refName: string,
    reversed: boolean,
  ) => laneIndelsOf(groups).changes(assemblyName, refName, reversed)

  // HG02055#1 at SMN, as hprc_multiway_gfa.pif.gz states it
  const smn = rows('HG02055.1', 'CM092207.1', 'chr5', [
    [70_781_567, 71_093_996, 72_789_865, 73_098_254, -1],
    [70_664_312, 70_781_567, 73_138_329, 73_257_316, -1],
    [70_640_778, 70_776_477, 73_257_316, 73_394_181, 1],
    [70_776_477, 70_791_365, 73_414_643, 73_429_536, 1],
    [69_988_503, 70_115_221, 73_501_729, 73_628_825, 1],
    [70_115_221, 70_129_603, 73_753_740, 73_768_079, 1],
  ])

  test('states the insertions of both strands whichever way it is drawn, and opens nothing', () => {
    for (const reversed of [false, true]) {
      expect(
        labelsOf(smn, 'HG02055.1', 'CM092207.1', reversed)
          .filter(c => c.kind === 'insertion')
          .map(c => c.laneBp)
          .toSorted((a, b) => a - b),
      ).toEqual([20_462, 40_075, 124_915])
      expect(
        laneIndelsOf(smn).openings('HG02055.1', 'CM092207.1', reversed),
      ).toEqual([])
    }
  })

  // HG00128#1 at TBC1D3: the forward gap holds the reversed pieces, and the
  // reversed gap between them is the same stretch read the other way
  const sameStretch = rows('HG00128.1', 'JBHIKS010000051.1', 'chr17', [
    [38_044_769, 38_070_363, 13_612_391, 13_637_971, 1],
    [38_088_871, 38_126_163, 13_638_005, 13_675_312, -1],
    [38_070_382, 38_075_454, 13_707_213, 13_712_303, -1],
    [38_126_166, 38_141_006, 13_712_306, 13_727_115, 1],
  ])

  test('states a change read on both strands once, beside the inversion', () => {
    for (const reversed of [false, true]) {
      expect(
        labelsOf(sameStretch, 'HG00128.1', 'JBHIKS010000051.1', reversed)
          .map(changeLabel)
          .toSorted(),
      ).toEqual(['13 kb replaced by 32 kb', '42 kb inversion'])
    }
  })

  // HG01960#1 at TBC1D3: the forward pieces' anchor runs backwards, so only
  // the reversed pieces state a gap
  const otherStrand = rows('HG01960.1', 'JBHIHM010000033.1', 'chr17', [
    [38_088_871, 38_126_163, 12_822_791, 12_860_061, 1],
    [38_044_769, 38_070_363, 12_860_095, 12_885_663, -1],
    [37_944_212, 37_990_833, 12_922_903, 12_969_514, -1],
    [38_054_281, 38_141_006, 12_974_424, 13_061_695, 1],
  ])

  test('states a change of the strand it is not drawn on without opening a hole for it', () => {
    expect(
      labelsOf(otherStrand, 'HG01960.1', 'JBHIHM010000033.1', false).map(
        changeLabel,
      ),
    ).toContain('54 kb replaced by 37 kb')
    expect(
      laneIndelsOf(otherStrand).openings(
        'HG01960.1',
        'JBHIHM010000033.1',
        false,
      ),
    ).toEqual([])
  })

  test('names tandem inverted copies of one stretch as one inversion', () => {
    const [ref, at] = CARRIERS['HG01123.1']
    const run = (
      id: string,
      lane: number,
      anchor: number,
      length: number,
      orientation: number,
    ) =>
      piece(
        id,
        WINDOW_START + anchor,
        WINDOW_START + anchor + length,
        [{ assemblyName: 'HG01123.1', refName: ref, start: at + lane }],
        orientation,
      )
    const inversions = laneIndelsOf(
      groupFeatures([
        run('l', 0, 0, 40_000, 1),
        run('m1', 40_000, 40_000, 900_000, -1),
        run('c1', 940_000, 940_000, 40_000, 1),
        run('c2', 980_000, 0, 40_000, 1),
        run('m2', 1_020_000, 40_000, 900_000, -1),
        run('r', 1_920_000, 940_000, 40_000, 1),
      ]),
    )
      .changes('HG01123.1', ref)
      .filter(c => c.kind === 'inversion')
      .map(sizeOf)
    expect(inversions).toEqual([
      {
        at: at + 40_000,
        laneBp: 900_000,
        anchorBp: 900_000,
        kind: 'inversion',
      },
    ])
  })
})

describe('a gap of each strand holding a piece of the other', () => {
  const record = (
    id: string,
    lane: number,
    anchor: number,
    length: number,
    strand: number,
    recordId: string,
  ) =>
    new SimpleFeature({
      uniqueId: id,
      recordId,
      refName: 'chr1',
      start: anchor,
      end: anchor + length,
      strand,
      assemblyName: 'hg38',
      mate: {
        assemblyName: 'L',
        refName: 'ctg',
        start: lane,
        end: lane + length,
      },
    })
  const labels = (forward: string, forwardFar: string, reversed: boolean) =>
    laneIndelsOf(
      groupFeatures([
        record('a', 0, 0, 100_000, 1, forward),
        record('b', 112_000, 240_000, 200_000, -1, 'rev'),
        record('c', 327_000, 455_000, 100_000, 1, forwardFar),
        record('x', 432_000, 175_000, 50_000, 1, 'x'),
        record('d', 502_000, 110_000, 50_000, -1, 'rev'),
      ]),
    )
      .changes('L', 'ctg', reversed)
      .filter(c => c.kind !== 'inversion')
      .map(c => `${changeLabel(c)} at ${c.at}`)

  test('known strand dependence: the lane stretch two parted gaps share is paired by the drawn strand, so it is stated once', () => {
    expect(labels('fwd', 'fwd', false)).toEqual([
      '140 kb replaced by 12 kb at 100000',
      '15 kb replaced by 15 kb at 312000',
    ])
    expect(labels('fwd', 'fwd', true)).toEqual([
      '15 kb replaced by 120 kb at 312000',
      '15 kb replaced by 20 kb at 482000',
    ])
  })

  test('reads alike on either strand once one gap’s flanks are two records with its anchor placed elsewhere', () => {
    for (const reversed of [false, true]) {
      expect(labels('fwd', 'far', reversed)).toEqual([
        '15 kb replaced by 120 kb at 312000',
        '15 kb replaced by 20 kb at 482000',
      ])
    }
  })
})

describe('a gap that thousands of pieces part', () => {
  const hit = (
    id: string,
    lane: number,
    anchor: number,
    length: number,
    strand: number,
  ) =>
    new SimpleFeature({
      uniqueId: id,
      refName: 'chr1',
      start: anchor,
      end: anchor + length,
      strand,
      assemblyName: 'hg38',
      mate: {
        assemblyName: 'L',
        refName: 'ctg',
        start: lane,
        end: lane + length,
      },
    })

  // merging the held spans once per segment takes 29 s here, once per side 58 ms
  test('reads 20,000 collinear pieces between two reverse hits in time linear in the pieces', () => {
    const PIECES = 20_000
    const at = (i: number) => (i + 1) * 10_000
    const groups = groupFeatures([
      hit('first', 0, at(PIECES + 1), 5_000, -1),
      ...Array.from({ length: PIECES }, (_, i) =>
        hit(`f${i}`, at(i), at(i), 9_000, 1),
      ),
      hit('last', at(PIECES), 0, 5_000, -1),
    ])
    const start = performance.now()
    const { changes } = laneIndelsOf(groups)
    const elapsedMs = performance.now() - start
    expect(changes('L', 'ctg', true).map(changeLabel)).toEqual([
      '11 kb replaced by 5 kb',
      '180 Mb inversion',
    ])
    expect(elapsedMs).toBeLessThan(2_000)
  })
})

describe('one forward gap holding turned pieces, over seeded arrangements', () => {
  const FLANK_BP = 100_000
  const GAPS = [-3, 0, 3, 4_000, 8_000, 9_999, 10_000, 12_000, 15_000, 30_000]
  interface Placed {
    lane: number
    anchor: number
    length: number
    strand: number
  }
  const seeded = (seed: number) => {
    let state = seed
    return () => {
      state = (state + 0x6d2b79f5) | 0
      const mixed = Math.imul(state ^ (state >>> 15), 1 | state)
      const again =
        (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
      return ((again ^ (again >>> 14)) >>> 0) / 4_294_967_296
    }
  }
  const arrangementOf = (next: () => number) => {
    const gap = () => GAPS[Math.floor(next() * GAPS.length)]!
    const sizes = Array.from({ length: 1 + Math.floor(next() * 3) }, () =>
      Math.round(500 * 400 ** next()),
    )
    const inPlace = next() < 0.5
    const anchorOrder = sizes.map((_, i) => sizes.length - 1 - i)
    if (!inPlace) {
      for (let i = anchorOrder.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        const held = anchorOrder[i]!
        anchorOrder[i] = anchorOrder[j]!
        anchorOrder[j] = held
      }
    }
    let lane = FLANK_BP
    const lanes = sizes.map(size => {
      const start = lane + gap()
      lane = start + size
      return start
    })
    const laneEnd = lane + gap()
    let anchor = FLANK_BP
    const anchors = new Map<number, number>()
    for (const i of anchorOrder) {
      const start = anchor + gap()
      anchors.set(i, start)
      anchor = start + sizes[i]!
    }
    const turned = sizes.map((length, i) => ({
      lane: lanes[i]!,
      anchor: anchors.get(i)!,
      length,
      strand: -1,
    }))
    return [
      { lane: 0, anchor: 0, length: FLANK_BP, strand: 1 },
      ...turned,
      { lane: laneEnd, anchor: anchor + gap(), length: FLANK_BP, strand: 1 },
    ]
  }
  const groupsOf = (placed: readonly Placed[]) =>
    groupFeatures(
      placed.map(
        ({ lane, anchor, length, strand }, i) =>
          new SimpleFeature({
            uniqueId: `p${i}`,
            refName: 'chr1',
            start: anchor,
            end: anchor + length,
            strand,
            assemblyName: 'hg38',
            mate: {
              assemblyName: 'L',
              refName: 'ctg',
              start: lane,
              end: lane + length,
            },
          }),
      ),
    )
  const mirrored = (placed: readonly Placed[]) => {
    const total = Math.max(...placed.map(p => p.lane + p.length))
    return placed.map(p => ({
      ...p,
      lane: total - p.lane - p.length,
      strand: -p.strand,
    }))
  }
  const unheld = (placed: readonly Placed[], side: 'lane' | 'anchor') =>
    placed
      .toSorted((a, b) => a[side] - b[side])
      .flatMap((p, i, sorted) => {
        const next = sorted[i + 1]
        const start = p[side] + p.length
        return next && next[side] - start >= SPLIT_AT_GAP_BP
          ? [{ start, end: next[side] }]
          : []
      })
  const labelsOf = (placed: readonly Placed[], reversed: boolean) =>
    laneIndelsOf(groupsOf(placed))
      .changes('L', 'ctg', reversed)
      .map(changeLabel)
      .toSorted()

  test('labels do not depend on the strand the lane is drawn on, nor on which way its contig runs', () => {
    const next = seeded(1)
    const differing = Array.from({ length: 200 }, () => arrangementOf(next))
      .map(placed => ({
        placed,
        forward: labelsOf(placed, false),
        reversed: labelsOf(placed, true),
        mirror: labelsOf(mirrored(placed), true),
      }))
      .filter(
        ({ forward, reversed, mirror }) =>
          forward.join(',') !== reversed.join(',') ||
          forward.join(',') !== mirror.join(','),
      )
    expect(differing).toEqual([])
  })

  test('every stretch of SPLIT_AT_GAP_BP no piece holds lies in a stated change', () => {
    const next = seeded(2)
    const unstated = Array.from({ length: 200 }, () => arrangementOf(next))
      .flatMap(placed =>
        [false, true].map(reversed => {
          const changes = laneIndelsOf(groupsOf(placed)).changes(
            'L',
            'ctg',
            reversed,
          )
          return {
            placed,
            reversed,
            lane: unheld(placed, 'lane').filter(
              s =>
                !changes.some(
                  c => c.laneBp > 0 && c.at <= s.start && c.laneEnd >= s.end,
                ),
            ),
            anchor: unheld(placed, 'anchor').filter(
              s =>
                !changes.some(
                  c =>
                    c.anchorBp > 0 &&
                    c.anchor.start <= s.start &&
                    c.anchor.end >= s.end,
                ),
            ),
          }
        }),
      )
      .filter(({ lane, anchor }) => lane.length + anchor.length > 0)
    expect(unstated).toEqual([])
  })
})

describe('a pivot inside a hole', () => {
  // the lane's first piece carries a 4 kb insertion, then a 30 kb deletion
  const record = (id: string, start: number, end: number, mate: Span) =>
    new SimpleFeature({
      uniqueId: id,
      refName: 'chr1',
      start,
      end,
      strand: 1,
      mate: { assemblyName: 'L', refName: 'ctg', start: mate[0], end: mate[1] },
    })
  const groups = groupFeatures([
    record('a', 0, 20_000, [0, 24_000]),
    record('b', 50_000, 52_000, [24_000, 26_000]),
  ])
  const pxOf = (bp: number) => bp / 100
  const openings = laneIndelsOf(groups).openings('L', 'ctg')

  test('keeps the lane where the alignment put it', () => {
    expect(openings).toEqual([{ at: 24_000, bp: 30_000 }])
    const d = decideLaneFrames({
      groups,
      openingsOf: laneIndelsOf(groups).openings,
      assemblyNames: ['L'],
      anchorX: new Map(groups.map(g => [g.key, pxOf(anchorCenter(g))])),
      anchorCoordOf: g => ({ refName: 'chr1', coord: anchorCenter(g) }),
      pxOfAnchor: c => pxOf(c.coord),
      unitBp: 100_000,
      width: 1000,
      previous: new Map(),
    }).get('L')!
    expect(d.pivotAnchor.coord).toBe(51_000)
    const frame = frameFromDecision(
      d,
      pxOf(d.pivotAnchor.coord),
      100_000,
      1000,
      false,
      openings,
    )
    expect(rowFrameX(frame, 12_000, 1000)).toBeCloseTo(pxOf(10_000))
  })

  test('slides a frozen lane as far as the drag, across the hole too', () => {
    let d: LaneDecision = {
      refName: 'ctg',
      flipped: false,
      rung: 1,
      pivotAnchor: { refName: 'chr1', coord: 50_000 },
      pivotLaneBp: 900,
      pivotInHoleBp: 0,
      fitMin: 0,
      fitMax: 2000,
      alsoOn: [],
      alsoOnMore: 0,
      alsoAt: [],
      pinned: false,
      orientationPinned: false,
    }
    const hole = [{ at: 1000, bp: 5000 }]
    const minOf = (x: LaneDecision) =>
      frameFromDecision(x, 500, 10_000, 1000, false, hole).min
    for (const dxPx of [-50, -50, -400, 10, -100, 60]) {
      const next = nudgeDecision(d, dxPx, 10, false, hole)
      expect(minOf(next) - minOf(d)).toBeCloseTo(-dxPx * 10)
      d = next
    }
  })
})

describe('a gene on a lane with a hole', () => {
  const [ref, at] = CARRIERS['HG01123.1']
  const HOLE_AT = at + BEFORE
  const GLYPH_HEIGHT = 10
  const fills = {
    fill: () => ({ css: 'goldenrod', packed: 1 }),
    utr: () => 1,
  }
  const laneX = (bp: number) =>
    bp <= HOLE_AT ? px(WINDOW_START + bp - at) : px(DEL_END + bp - HOLE_AT)
  const gene = (id: string, start: number, end: number, exons: Span[]) =>
    new LaneGene(
      new SimpleFeature({
        uniqueId: id,
        name: id,
        refName: ref,
        start,
        end,
        strand: 1,
        type: 'gene',
        subfeatures: [
          {
            uniqueId: `${id}.t`,
            refName: ref,
            start,
            end,
            strand: 1,
            type: 'mRNA',
            subfeatures: exons.map(([s, e], i) => ({
              uniqueId: `${id}.e${i}`,
              refName: ref,
              start: s,
              end: e,
              type: 'exon',
            })),
          },
        ],
      }),
    )

  function drawn(genes: LaneGene[]) {
    const groups = groupFeatures(cfhFeatures())
    const lane = stackOf(groups, framesOf(groups, decide(groups))).lanes.find(
      l => l.assemblyName === 'HG01123.1',
    )!
    const { glyphs } = buildLaneCells({
      lane,
      genes,
      glyphHeight: GLYPH_HEIGHT,
      width: WIDTH,
      colors: { genes: fills, boxes: fills, stroke: '#222', divider: '#ccc' },
    })
    const pairs = (positions: Uint32Array, keep: (i: number) => boolean) =>
      Array.from({ length: positions.length / 2 }, (_, i) => i)
        .filter(keep)
        .map(i => [
          positions[2 * i]! - PX_ORIGIN,
          positions[2 * i + 1]! - PX_ORIGIN,
        ])
        .sort((a, b) => a[0]! - b[0]!)
    return {
      lane,
      glyphs,
      rects: pairs(glyphs.rectPositions, () => true),
      introns: pairs(glyphs.linePositions, i => glyphs.lineDirections[i] !== 0),
    }
  }

  const near = (actual: number[][], expected: number[][]) => {
    expect(actual).toHaveLength(expected.length)
    actual.forEach(([a, b], i) => {
      expect(Math.abs(a! - expected[i]![0]!)).toBeLessThanOrEqual(1)
      expect(Math.abs(b! - expected[i]![1]!)).toBeLessThanOrEqual(1)
    })
  }

  test('cuts an exon and an intron spanning the hole at its edges, and draws nothing across it', () => {
    const { rects, introns, glyphs, lane } = drawn([
      gene('spanning', HOLE_AT - 6000, HOLE_AT + 8000, [
        [HOLE_AT - 6000, HOLE_AT - 5000],
        [HOLE_AT - 2000, HOLE_AT + 2000],
        [HOLE_AT + 7000, HOLE_AT + 8000],
      ]),
    ])
    near(rects, [
      [laneX(HOLE_AT - 6000), laneX(HOLE_AT - 5000)],
      [laneX(HOLE_AT - 2000), px(DEL_START)],
      [px(DEL_END), laneX(HOLE_AT + 2000)],
      [laneX(HOLE_AT + 7000), laneX(HOLE_AT + 8000)],
    ])
    near(introns, [
      [laneX(HOLE_AT - 5000), laneX(HOLE_AT - 2000)],
      [laneX(HOLE_AT + 2000), laneX(HOLE_AT + 7000)],
    ])
    const midHole = (px(DEL_START) + px(DEL_END)) / 2
    expect(
      glyphHitAt(glyphs.hits, midHole, lane.glyphTop + GLYPH_HEIGHT / 2),
    ).toBeUndefined()
    expect(
      glyphHitAt(
        glyphs.hits,
        laneX(HOLE_AT + 7500),
        lane.glyphTop + GLYPH_HEIGHT / 2,
      )?.feature.id(),
    ).toBe('spanning')
  })

  test('cuts an intron line the hole falls in at its edges', () => {
    const { rects, introns } = drawn([
      gene('intronic', HOLE_AT - 6000, HOLE_AT + 8000, [
        [HOLE_AT - 6000, HOLE_AT - 5000],
        [HOLE_AT + 7000, HOLE_AT + 8000],
      ]),
    ])
    near(rects, [
      [laneX(HOLE_AT - 6000), laneX(HOLE_AT - 5000)],
      [laneX(HOLE_AT + 7000), laneX(HOLE_AT + 8000)],
    ])
    near(introns, [
      [laneX(HOLE_AT - 5000), px(DEL_START)],
      [px(DEL_END), laneX(HOLE_AT + 7000)],
    ])
  })

  test('draws a gene ending at the hole and one starting there flush to its edges', () => {
    const { rects, introns } = drawn([
      gene('before', HOLE_AT - 3000, HOLE_AT, [[HOLE_AT - 3000, HOLE_AT]]),
      gene('after', HOLE_AT, HOLE_AT + 3000, [[HOLE_AT, HOLE_AT + 3000]]),
    ])
    near(rects, [
      [laneX(HOLE_AT - 3000), px(DEL_START)],
      [px(DEL_END), laneX(HOLE_AT + 3000)],
    ])
    expect(introns).toEqual([])
  })
})

test('a lane layer region across a hole draws as one piece either side of it', () => {
  const [, at] = CARRIERS['HG01123.1']
  const groups = groupFeatures(cfhFeatures())
  const frame = framesOf(groups, decide(groups)).get('HG01123.1')!
  const pieces = frameSegments(frame, at, at + BEFORE + AFTER, WIDTH)
  expect(pieces.map(p => [p.start, p.end])).toEqual([
    [at, at + BEFORE],
    [at + BEFORE, at + BEFORE + AFTER],
  ])
  const [left, right] = pieces.map(p => p.px.map(x => Math.round(x)))
  expect(left).toEqual([px(WINDOW_START), px(DEL_START)].map(Math.round))
  expect(right).toEqual([px(DEL_END), px(WINDOW_END)].map(Math.round))
})
