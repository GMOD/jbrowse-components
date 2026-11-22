import { SimpleFeature } from '@jbrowse/core/util'

import { decideLaneFrames, frameFromDecision } from './laneDecision.ts'
import { changeLabel, laneRegion } from './laneHeader.ts'
import { frameSpan, groupFeatures, laneIndelsOf } from './layoutMultiWay.ts'

import type { MultiWayGroup } from './layoutMultiWay.ts'

// HPRC v2.1 at the amylase locus, chr1:103,500,000-103,800,000, as
// hprc_multiway_gfa.pif.gz and the walk file state it
const WINDOW_START = 103_500_000
const WINDOW_END = 103_800_000
const UNIT_BP = WINDOW_END - WINDOW_START
const WIDTH = 1200
const px = (bp: number) => ((bp - WINDOW_START) / UNIT_BP) * WIDTH

interface Piece {
  id: string
  record?: string
  anchor: [number, number]
  lane: [number, number]
  strand?: number
}

function features(assemblyName: string, refName: string, pieces: Piece[]) {
  return pieces.map(
    ({ id, record = id, anchor, lane, strand = 1 }) =>
      new SimpleFeature({
        uniqueId: id,
        recordId: record,
        refName: 'chr1',
        start: anchor[0],
        end: anchor[1],
        strand,
        assemblyName: 'hg38',
        mate: { assemblyName, refName, start: lane[0], end: lane[1] },
      }),
  )
}

// HG00133#1's five PIF rows: the flank, GRCh38's next 17.5 kb, 75 kb of its
// own, that 17.5 kb and the flank's last 1.6 kb reversed, the far flank
const HG00133_ROWS: Piece[] = [
  {
    id: 'a',
    anchor: [WINDOW_START, 103_620_893],
    lane: [103_648_773, 103_769_666],
  },
  {
    id: 'b',
    anchor: [103_715_097, 103_732_624],
    lane: [103_769_666, 103_787_184],
  },
  {
    id: 'c',
    anchor: [103_715_097, 103_732_624],
    lane: [103_862_188, 103_879_705],
    strand: -1,
  },
  {
    id: 'd',
    anchor: [103_619_297, 103_620_893],
    lane: [103_879_705, 103_881_330],
    strand: -1,
  },
  {
    id: 'e',
    anchor: [103_732_641, WINDOW_END],
    lane: [103_881_330, 103_948_689],
  },
]
const HG00133_PIF = features('HG00133.1', 'CM090045.1', HG00133_ROWS)

// HG00133#1's walk record: the flank, a 94 kb deletion, GRCh38's next
// 17.5 kb, 17 bp against 94 kb of its own, the far flank, split at its gaps
const HG00133_WALK = features(
  'HG00133.1',
  'CM090045.1',
  HG00133_ROWS.filter(row => row.strand !== -1).map(row => ({
    ...row,
    id: `walk/${row.id}`,
    record: 'walk',
  })),
)

// HG00097#1's walk in two fragments of one contig, 49 kb of it between them
const HG00097_FRAGMENTS = features('HG00097.1', 'CM094060.1', [
  {
    id: 'a',
    anchor: [WINDOW_START, 103_611_082],
    lane: [104_006_618, 104_117_700],
  },
  {
    id: 'e',
    anchor: [103_732_637, WINDOW_END],
    lane: [104_166_751, 104_234_114],
  },
])

const anchorCenter = (g: MultiWayGroup) => (g.anchor.start + g.anchor.end) / 2

function frameOf(groups: MultiWayGroup[], assemblyName: string) {
  const { openings } = laneIndelsOf(groups)
  const d = decideLaneFrames({
    groups,
    openingsOf: openings,
    assemblyNames: [assemblyName],
    anchorX: new Map(groups.map(g => [g.key, px(anchorCenter(g))])),
    anchorCoordOf: g => ({ refName: 'chr1', coord: anchorCenter(g) }),
    pxOfAnchor: c => px(c.coord),
    unitBp: UNIT_BP,
    width: WIDTH,
    previous: new Map(),
  }).get(assemblyName)!
  return frameFromDecision(
    d,
    px(d.pivotAnchor.coord),
    UNIT_BP,
    WIDTH,
    false,
    openings(assemblyName, d.refName),
  )
}

describe('a lane holding a reversed copy of the anchor between its flanks', () => {
  const groups = groupFeatures(HG00133_PIF)

  test('opens the anchor stretch it lacks once', () => {
    expect(laneIndelsOf(groups).openings('HG00133.1', 'CM090045.1')).toEqual([
      { at: 103_769_666, bp: 94_204 },
    ])
  })

  test('draws its far flank inside the lane', () => {
    const frame = frameOf(groups, 'HG00133.1')
    const [x0, x1] = frameSpan(frame, 103_881_330, 103_948_689, WIDTH)!
    expect(Math.min(x0, x1)).toBeLessThan(WIDTH - 100)
    expect(laneRegion({ frame, canon: ref => ref })!.end).toBeGreaterThan(
      103_948_689,
    )
  })

  test('names no inversion for a reversed copy of its flanks', () => {
    expect(
      laneIndelsOf(groups)
        .changes('HG00133.1', 'CM090045.1')
        .filter(c => c.kind === 'inversion'),
    ).toEqual([])
  })
})

describe('a lane read from its PIF rows or its walk record alike', () => {
  const read = (records: SimpleFeature[]) => {
    const { openings, changes } = laneIndelsOf(groupFeatures(records))
    return {
      openings: openings('HG00133.1', 'CM090045.1'),
      changes: changes('HG00133.1', 'CM090045.1').map(changeLabel),
    }
  }

  test('states the same changes read on the reversed strand', () => {
    const { changes } = laneIndelsOf(groupFeatures(HG00133_PIF))
    expect(changes('HG00133.1', 'CM090045.1', true).map(changeLabel)).toEqual(
      changes('HG00133.1', 'CM090045.1').map(changeLabel),
    )
  })

  test('opens the same hole and states the same changes, a shared piece keeping them two', () => {
    expect(read(HG00133_PIF)).toEqual(read(HG00133_WALK))
    expect(read(HG00133_WALK)).toEqual({
      openings: [{ at: 103_769_666, bp: 94_204 }],
      changes: ['94 kb deletion', '17 bp replaced by 94 kb'],
    })
  })
})

describe('a lane whose walk is in two fragments of one contig', () => {
  test('names the stretch between them as the reference replaced by its own', () => {
    const groups = groupFeatures(HG00097_FRAGMENTS)
    expect(
      laneIndelsOf(groups).changes('HG00097.1', 'CM094060.1').map(changeLabel),
    ).toEqual(['120 kb replaced by 49 kb'])
  })
})
