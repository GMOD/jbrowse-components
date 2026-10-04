import { SimpleFeature } from '@jbrowse/core/util'

import { NO_OPS } from './alignmentOps.ts'
import { decideLaneFrames, frameFromDecision } from './laneDecision.ts'
import { laneRegion } from './laneHeader.ts'
import { buildLanes } from './laneStack.ts'
import {
  frameSpan,
  groupFeatures,
  laneOpeningsOf,
  rowFrameX,
} from './layoutMultiWay.ts'
import { buildRibbonGeometry } from './multiwayGeometry.ts'

import type { LaneDecision } from './laneDecision.ts'
import type { MultiWayGroup, RowFrame, Span } from './layoutMultiWay.ts'
import type { MultiWayCell } from './multiwayRenderTypes.ts'

// HPRC v2.1 at CFH: four haplotypes share one alignment record carrying the
// 84,684 bp CFHR3-CFHR1 deletion, which the fetch splits into two pieces.
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
) {
  return new SimpleFeature({
    uniqueId: id,
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
    piece('cfh/0', WINDOW_START, DEL_START, carriers),
    piece(
      'cfh/1',
      DEL_END,
      WINDOW_END,
      carriers.map(c => ({ ...c, start: c.start + BEFORE })),
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
  const openingsOf = laneOpeningsOf(groups)
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
          openingsOf(assemblyName, d.refName),
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
    laneGeneAdapters: new Map(),
    axisSpanOf: (_ref, start, end) => anchorSpan(start, end),
    anchorRegionSpans: [anchorSpan(WINDOW_START, WINDOW_END)],
    anchorBpPerPx: UNIT_BP / WIDTH,
    contigOf: () => ({ start: 0, end: 300_000_000 }),
    refNameAliasOf: () => undefined,
    width: WIDTH,
    height: 400,
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

describe('a deletion the lane carries against the anchor', () => {
  test('opens one hole per carrier, at its breakpoint, the deletion’s length', () => {
    const openingsOf = laneOpeningsOf(groupFeatures(cfhFeatures()))
    for (const [assemblyName, [ref, at]] of Object.entries(CARRIERS)) {
      expect(openingsOf(assemblyName, ref)).toEqual([
        { at: at + BEFORE, bp: DEL_END - DEL_START },
      ])
    }
    for (const [assemblyName, [ref]] of Object.entries(NON_CARRIERS)) {
      expect(openingsOf(assemblyName, ref)).toEqual([])
    }
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
      bridgeSkippedLanes: false,
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
    expect(laneOpeningsOf(groups)('HG01123.1', ref)).toEqual([
      { at: at + AFTER, bp: DEL_END - DEL_START },
    ])
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
    expect(laneOpeningsOf(insertion)('HG01123.1', ref)).toEqual([])
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
    expect(laneOpeningsOf(genes)('HG01123.1', ref)).toEqual([])
  })

  test('keeps a frame the same under a pan that moves its pivot past the hole', () => {
    const groups = groupFeatures(cfhFeatures())
    const d = decide(groups).get('HG01123.1')!
    const [ref, at] = CARRIERS['HG01123.1']
    const openings = laneOpeningsOf(groups)('HG01123.1', ref)
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
