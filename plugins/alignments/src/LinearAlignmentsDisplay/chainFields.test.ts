import { namesToBlock } from '@jbrowse/alignments-core'
import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_REVERSE,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

import { baseWorkerPileupData } from '../RenderAlignmentDataRPC/testPileupData.ts'
import {
  CHAIN_FRAME_REV,
  CHAIN_SPLIT_DELETION,
  CHAIN_SPLIT_INVERSION,
  CHAIN_SUPP_NONE,
  CHAIN_SUPP_PRESENT,
} from '../shared/types.ts'
import { attachChainFields, buildReadIdsByChainName } from './chainFields.ts'

import type {
  ChainPileupData,
  WorkerPileupData,
} from '../RenderAlignmentDataRPC/types.ts'

interface Read {
  id: string
  name: string
  start?: number
  end?: number
  flags?: number
  strand?: number
  pairOrientation?: number
  insertSize?: number
}

// One region's worth of the per-read arrays the pass reads, as the worker
// ships them: the QNAMEs as a block, ids as string keys.
function region(reads: Read[]): WorkerPileupData {
  return {
    ...baseWorkerPileupData(reads.length),
    readKeys: reads.map(r => r.id),
    ...namesToBlock(reads.map(r => r.name)),
    readPositions: Uint32Array.from(
      reads.flatMap(r => [r.start ?? 0, r.end ?? 100]),
    ),
    readFlags: Uint16Array.from(reads.map(r => r.flags ?? 0)),
    readStrands: Int8Array.from(reads.map(r => r.strand ?? 1)),
    readPairOrientations: Uint8Array.from(
      reads.map(r => r.pairOrientation ?? 0),
    ),
    readInsertSizes: Float32Array.from(reads.map(r => r.insertSize ?? 0)),
  }
}

// Ungrouped: the one lane, its regions indexed in order.
function ungrouped(...regions: WorkerPileupData[]) {
  return new Map([['', new Map(regions.map((r, i) => [i, r]))]])
}

function attached(...regions: WorkerPileupData[]) {
  const lane = attachChainFields(ungrouped(...regions)).get('')!
  return regions.map((_, i) => lane.get(i)!)
}

function fills(data: ChainPileupData) {
  return [...data.readChainHasSupp]
}

const PRIMARY_FWD = { flags: 0, strand: 1 }
const PRIMARY_REV = { flags: SAM_FLAG_REVERSE, strand: -1 }
const SUPP_FWD = { flags: SAM_FLAG_SUPPLEMENTARY, strand: 1 }
const SUPP_REV = {
  flags: SAM_FLAG_SUPPLEMENTARY | SAM_FLAG_REVERSE,
  strand: -1,
}
const READ1 = SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR
const READ2 = SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR

describe('one region', () => {
  test('mates sharing a QNAME form one chain, bounded by both', () => {
    const [r] = attached(
      region([
        { id: 'r1.2', name: 'r1', start: 400, end: 500 },
        { id: 'r1.1', name: 'r1', start: 0, end: 100 },
        { id: 'r2.1', name: 'r2', start: 900, end: 950 },
      ]),
    )
    expect(r!.chainNames).toEqual(['r1', 'r2'])
    expect([...r!.readChainIndices]).toEqual([0, 0, 1])
    expect([...r!.chainAbsMinStarts]).toEqual([0, 900])
    expect([...r!.chainAbsMaxEnds]).toEqual([500, 950])
    expect([...r!.chainFirstReadIndices]).toEqual([0, 2])
    expect(fills(r!)).toEqual([
      CHAIN_SUPP_NONE,
      CHAIN_SUPP_NONE,
      CHAIN_SUPP_NONE,
    ])
  })

  test('a supplementary alignment chains with its primary', () => {
    const [r] = attached(
      region([
        { id: 'p', name: 'r1', ...PRIMARY_FWD },
        { id: 's', name: 'r1', start: 900, end: 950, ...SUPP_FWD },
      ]),
    )
    expect(r!.chainNames).toEqual(['r1'])
    expect(fills(r!)).toEqual([CHAIN_SUPP_PRESENT, CHAIN_SUPP_PRESENT])
  })

  test('a reverse primary sets the frame bit alongside the present bit', () => {
    // Both, not one or the other: the frame is only meaningful for a chain that
    // HAS a supplementary, so CHAIN_FRAME_REV alone would say a chain points
    // backwards without saying it splits.
    const [r] = attached(
      region([
        { id: 'p', name: 'r1', ...PRIMARY_REV },
        { id: 's', name: 'r1', start: 900, end: 950, ...SUPP_FWD },
      ]),
    )
    const rev = CHAIN_SUPP_PRESENT | CHAIN_FRAME_REV
    expect(fills(r!)).toEqual([rev, rev])
  })

  test('a supplementary takes its primary’s pair orientation, copy-on-write', () => {
    // The primary pair is LL (abnormal); the split segment's own record
    // computes a divergent LR, which under the pair-orientation scheme would
    // paint it the normal grey.
    const raw = region([
      { id: 'p', name: 'r1', flags: READ1, pairOrientation: 4 },
      {
        id: 's',
        name: 'r1',
        flags: READ1 | SAM_FLAG_SUPPLEMENTARY,
        pairOrientation: 1,
      },
    ])
    const [r] = attached(raw)
    expect([...r!.readPairOrientations]).toEqual([4, 4])
    expect([...raw.readPairOrientations]).toEqual([4, 1])
  })

  test('a region with nothing to correct keeps the worker’s orientation array', () => {
    const raw = region([
      { id: 'p', name: 'r1', flags: READ1, pairOrientation: 1 },
      { id: 'm', name: 'r1', flags: READ2, pairOrientation: 1 },
    ])
    const [r] = attached(raw)
    expect(r!.readPairOrientations).toBe(raw.readPairOrientations)
  })

  test('read1’s inverted supplementary marks both read1 segments, not read2', () => {
    const [r] = attached(
      region([
        { id: 'p1', name: 'r1', flags: READ1, strand: 1 },
        {
          id: 's1',
          name: 'r1',
          start: 900,
          end: 950,
          flags: READ1 | SAM_FLAG_SUPPLEMENTARY | SAM_FLAG_REVERSE,
          strand: -1,
        },
        { id: 'p2', name: 'r1', flags: READ2 | SAM_FLAG_REVERSE, strand: -1 },
      ]),
    )
    const split = CHAIN_SUPP_PRESENT | CHAIN_SPLIT_INVERSION
    expect(fills(r!)).toEqual([split, split, CHAIN_SUPP_PRESENT])
  })

  test('a co-linear supplementary splits at a deletion', () => {
    const [r] = attached(
      region([
        { id: 'p1', name: 'r1', flags: READ1, strand: 1 },
        {
          id: 's1',
          name: 'r1',
          start: 900,
          end: 950,
          flags: READ1 | SAM_FLAG_SUPPLEMENTARY,
          strand: 1,
        },
      ]),
    )
    const split = CHAIN_SUPP_PRESENT | CHAIN_SPLIT_DELETION
    expect(fills(r!)).toEqual([split, split])
  })

  test('a second-in-pair inverted supplementary marks the read2 mate', () => {
    const [r] = attached(
      region([
        { id: 'p1', name: 'r1', flags: READ1, strand: 1 },
        { id: 'p2', name: 'r1', flags: READ2, strand: 1 },
        {
          id: 's2',
          name: 'r1',
          start: 900,
          end: 950,
          flags: READ2 | SAM_FLAG_SUPPLEMENTARY | SAM_FLAG_REVERSE,
          strand: -1,
        },
      ]),
    )
    const split = CHAIN_SUPP_PRESENT | CHAIN_SPLIT_INVERSION
    expect(fills(r!)).toEqual([CHAIN_SUPP_PRESENT, split, split])
  })

  test('an unpaired inverted split sets no mate kind', () => {
    // The unpaired split is the long-read strand framing's job
    const [r] = attached(
      region([
        { id: 'p', name: 'r1', ...PRIMARY_FWD },
        { id: 's', name: 'r1', start: 900, end: 950, ...SUPP_REV },
      ]),
    )
    expect(fills(r!)).toEqual([CHAIN_SUPP_PRESENT, CHAIN_SUPP_PRESENT])
  })

  test('a secondary alignment does not chain with its primary', () => {
    // A competing mapping of the same read to another locus renders standalone
    const [r] = attached(
      region([
        { id: 'p', name: 'r1' },
        {
          id: 'sec',
          name: 'r1',
          start: 5000,
          end: 5100,
          flags: SAM_FLAG_SECONDARY,
        },
      ]),
    )
    expect(r!.chainNames).toHaveLength(2)
    expect(r!.chainNames.filter(n => n === 'r1')).toHaveLength(1)
  })

  test('nameless features (PAF/synteny blocks) each stand alone', () => {
    const [r] = attached(
      region([
        { id: 'a', name: '', start: 0, end: 100 },
        { id: 'b', name: '', start: 5000, end: 5100 },
        { id: 'c', name: '', start: 900_000, end: 900_100 },
      ]),
    )
    expect(r!.chainNames).toHaveLength(3)
    expect([...r!.chainAbsMinStarts]).toEqual([0, 5000, 900_000])
    expect([...r!.chainAbsMaxEnds]).toEqual([100, 5100, 900_100])
  })

  test('a lone read packs by its |TLEN|, a multi-read chain by its span', () => {
    const [r] = attached(
      region([
        { id: 'lone', name: 'r1', start: 0, end: 100, insertSize: 350 },
        { id: 'a', name: 'r2', start: 200, end: 300, insertSize: 9000 },
        { id: 'b', name: 'r2', start: 600, end: 700, insertSize: 9000 },
        { id: 'unset', name: 'r3', start: 0, end: 100 },
      ]),
    )
    expect([...r!.chainDistances]).toEqual([350, 500, 100])
  })
})

// The interchromosomal fusion the mode exists for: one window holds each
// molecule's primary, the other its supplementary, and no worker call saw both.
describe('a chain split across two displayed regions', () => {
  const chr9 = region([
    { id: 's', name: 'mol', start: 100, end: 200, ...SUPP_REV },
  ])

  test('the primary side learns it is part of a split chain', () => {
    const chr22 = region([{ id: 'p', name: 'mol', ...PRIMARY_FWD }])
    const [a, b] = attached(chr22, chr9)
    expect(fills(a!)).toEqual([CHAIN_SUPP_PRESENT])
    // framed against the primary it actually has, not an invented one
    expect(fills(b!)).toEqual([CHAIN_SUPP_PRESENT])
  })

  test('a reverse primary frames the region that cannot see it', () => {
    const chr22 = region([{ id: 'p', name: 'mol', ...PRIMARY_REV }])
    const [a, b] = attached(chr22, chr9)
    const rev = CHAIN_SUPP_PRESENT | CHAIN_FRAME_REV
    expect(fills(a!)).toEqual([rev])
    expect(fills(b!)).toEqual([rev])
  })

  test('a mate’s split kind is classified against its primary in the other region', () => {
    const suppSide = region([
      {
        id: 's',
        name: 'pair',
        flags: READ1 | SAM_FLAG_SUPPLEMENTARY,
        strand: 1,
      },
    ])
    const primarySide = region([
      { id: 'p', name: 'pair', flags: READ1 | SAM_FLAG_REVERSE, strand: -1 },
    ])
    const [a, b] = attached(suppSide, primarySide)
    const split = CHAIN_SUPP_PRESENT | CHAIN_FRAME_REV | CHAIN_SPLIT_INVERSION
    expect(fills(a!)).toEqual([split])
    expect(fills(b!)).toEqual([split])
  })

  // "View split alignment regions" opens one window per segment, and with the
  // supplementary colouring off the pair-orientation scheme reads this array.
  test('a supplementary takes the orientation of a primary in another region', () => {
    const primarySide = region([
      { id: 'p', name: 'pair', flags: READ1, pairOrientation: 4 },
      { id: 'm', name: 'pair', flags: READ2, pairOrientation: 4 },
    ])
    const suppSide = region([
      {
        id: 's',
        name: 'pair',
        flags: READ1 | SAM_FLAG_SUPPLEMENTARY,
        pairOrientation: 1,
      },
    ])
    const [, b] = attached(primarySide, suppSide)
    expect([...b!.readPairOrientations]).toEqual([4])
  })

  test('a chain living in one region keeps that region’s answer', () => {
    const local = region([
      { id: 'p', name: 'local', ...PRIMARY_FWD },
      { id: 's', name: 'local', start: 900, end: 950, ...SUPP_REV },
      { id: 'o', name: 'other', ...PRIMARY_FWD },
    ])
    const far = region([{ id: 'f', name: 'far', ...PRIMARY_FWD }])
    const [a, b] = attached(local, far)
    expect(fills(a!)).toEqual([
      CHAIN_SUPP_PRESENT,
      CHAIN_SUPP_PRESENT,
      CHAIN_SUPP_NONE,
    ])
    expect(fills(b!)).toEqual([CHAIN_SUPP_NONE])
  })
})

// A facet on a fragment-level dimension files a region holding only a
// supplementary under the supplementary's OWN value (`chainRepresentative` falls
// back to it), so its primary sits in another lane. The union is by name
// across lanes, or the two halves of one molecule never meet.
test('the union reaches a primary filed in another lane', () => {
  const byGroup = new Map([
    [
      '4',
      new Map([
        [
          0,
          region([{ id: 'p', name: 'mol', flags: READ1, pairOrientation: 4 }]),
        ],
      ]),
    ],
    [
      '1',
      new Map([
        [
          1,
          region([
            {
              id: 's',
              name: 'mol',
              flags: READ1 | SAM_FLAG_SUPPLEMENTARY,
              pairOrientation: 1,
            },
          ]),
        ],
      ]),
    ],
  ])
  const out = attachChainFields(byGroup)
  const primary = out.get('4')!.get(0)!
  const supp = out.get('1')!.get(1)!
  expect(fills(primary)).toEqual([CHAIN_SUPP_PRESENT | CHAIN_SPLIT_DELETION])
  expect(fills(supp)).toEqual([CHAIN_SUPP_PRESENT | CHAIN_SPLIT_DELETION])
  expect([...supp.readPairOrientations]).toEqual([4])
})

test('the per-region pass is reused for a re-spread region', () => {
  // `buildRawDataByGroup` re-spreads a region when a band is pinned, so the
  // memo keys on the fetched `readKeys` rather than the wrapping object.
  const raw = region([
    { id: 'p', name: 'r1', ...PRIMARY_FWD },
    { id: 's', name: 'r1', start: 900, end: 950, ...SUPP_FWD },
  ])
  const [first] = attached(raw)
  const [again] = attached({ ...raw })
  expect(again!.readChainIndices).toBe(first!.readChainIndices)
  expect(again!.chainAbsMinStarts).toBe(first!.chainAbsMinStarts)

  const [other] = attached(region([{ id: 'p', name: 'r1', ...PRIMARY_FWD }]))
  expect(other!.readChainIndices).not.toBe(first!.readChainIndices)
})

describe('readIdsByChainName', () => {
  test('unions a chain by name across regions', () => {
    const out = attachChainFields(
      ungrouped(
        region([
          { id: 'a', name: 'c0' },
          { id: 'b', name: 'c1' },
        ]),
        region([{ id: 'c', name: 'c0' }]),
      ),
    )
    const m = buildReadIdsByChainName(out)
    expect(m.get('c0')).toEqual(['a', 'c'])
    expect(m.get('c1')).toEqual(['b'])
  })

  test('never collides across lanes numbering their chains from 0', () => {
    const out = attachChainFields(
      new Map([
        [
          '1',
          new Map([
            [
              0,
              region([
                { id: 'a', name: 'hp1' },
                { id: 'b', name: 'hp1' },
              ]),
            ],
          ]),
        ],
        [
          '2',
          new Map([
            [
              0,
              region([
                { id: 'c', name: 'hp2' },
                { id: 'd', name: 'hp2' },
              ]),
            ],
          ]),
        ],
      ]),
    )
    const m = buildReadIdsByChainName(out)
    expect(m.get('hp1')).toEqual(['a', 'b'])
    expect(m.get('hp2')).toEqual(['c', 'd'])
  })
})
