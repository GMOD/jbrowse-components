import { namesToBlock } from '@jbrowse/alignments-core'
import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

import { basePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { nextRefsToTable } from '../../shared/readNextRefs.ts'
import { computeArcsFromPileupData } from '../arcs/compute.ts'
import { splitClassCode } from './junctionClass.ts'
import {
  computeSplitJunctions,
  fetchedSplitSegments,
} from './splitJunctions.ts'

import type { FeatureData } from '../../shared/webglRpcTypes.ts'
import type { ArcSplitCategory } from '../arcs/arcSplitCategory.ts'

interface Rec {
  name: string
  start: number
  end: number
  strand: number
  clip: number
  sa: string
  flags?: number
}

function records(recs: Rec[]) {
  return {
    features: recs.map(
      (r, i) =>
        ({
          id: i,
          start: r.start,
          end: r.end,
          flags: r.flags ?? 0,
          mapq: 60,
          insertSize: 0,
          pairOrientation: 0,
          strand: r.strand,
        }) satisfies FeatureData,
    ),
    suppAlignments: recs.map(r => r.sa),
    clipAtStart: recs.map(r => r.clip),
    readNames: namesToBlock(recs.map(r => r.name)),
  }
}

// One group's junctions in a region whose whole fetch is `fetch`.
function count(refName: string, recs: Rec[], fetch = recs) {
  return computeSplitJunctions({
    refName,
    ...records(recs),
    fetched: fetchedSplitSegments([records(fetch)]),
  })
}

const junction = (
  start: number,
  end: number,
  split: ArcSplitCategory,
  n = 1,
) => ({ start, end, splitClass: splitClassCode(split), n })

// SRR1636985.796622 at circHIPK3: the read starts on the exon's last 43 bases
// (the SA segment) and carries on into its first 58 (the primary record).
const HIPK3_PRIMARY: Rec = {
  name: 'SRR1636985.796622',
  start: 33286412,
  end: 33286470,
  strand: 1,
  clip: 43,
  sa: 'chr11,33287469,+,43M58S,255,0;',
}
const HIPK3_SUPPLEMENTARY: Rec = {
  name: 'SRR1636985.796622',
  start: 33287468,
  end: 33287511,
  strand: 1,
  clip: 0,
  sa: 'chr11,33286413,+,43S58M,255,0;',
  flags: SAM_FLAG_SUPPLEMENTARY,
}

test('a read crossing the circle joint counts one duplication-type junction', () => {
  expect(count('chr11', [HIPK3_PRIMARY])).toEqual([
    junction(33286412, 33287511, 'splitBack'),
  ])
})

test('a minus-strand read crosses its joint from the other side', () => {
  expect(
    count('chr11', [
      {
        name: 'r',
        start: 5000,
        end: 5043,
        strand: -1,
        clip: 58,
        sa: 'chr11,1001,-,43S58M,255,0;',
      },
    ]),
  ).toEqual([junction(1000, 5043, 'splitBack')])
})

test('segments running forward make a deletion-type junction', () => {
  expect(
    count('chr11', [
      {
        name: 'r',
        start: 1000,
        end: 1058,
        strand: 1,
        clip: 0,
        sa: 'chr11,5001,+,58S43M,255,0;',
      },
    ]),
  ).toEqual([junction(1058, 5000, 'splitForward')])
})

test('a strand flip whose lower foot extends left is an LL inversion', () => {
  expect(
    count('chr1', [
      {
        name: 'r',
        start: 1000,
        end: 1100,
        strand: 1,
        clip: 0,
        sa: 'chr1,2001,-,100M100S,60,0;',
      },
    ]),
  ).toEqual([junction(1100, 2100, 'splitInvLL')])
})

test('a strand flip whose lower foot extends right is an RR inversion', () => {
  expect(
    count('chr1', [
      {
        name: 'r',
        start: 1000,
        end: 1100,
        strand: 1,
        clip: 100,
        sa: 'chr1,2001,-,100S100M,60,0;',
      },
    ]),
  ).toEqual([junction(1000, 2000, 'splitInvRR')])
})

test('a rolling-circle read counts every crossing of its joint, as the arcs do', () => {
  const middle: Rec = {
    name: 'circle',
    start: 1000,
    end: 1500,
    strand: 1,
    clip: 500,
    sa: 'chr1,1001,+,500M1000S,60,0;chr1,1001,+,1000S500M,60,0;',
  }
  const first: Rec = {
    ...middle,
    clip: 0,
    sa: 'chr1,1001,+,500S500M500S,60,0;chr1,1001,+,1000S500M,60,0;',
  }
  const last: Rec = {
    ...middle,
    clip: 1000,
    sa: 'chr1,1001,+,500M1000S,60,0;chr1,1001,+,500S500M500S,60,0;',
  }
  const twice = [junction(1000, 1500, 'splitBack', 2)]
  expect(count('chr1', [middle])).toEqual(twice)
  expect(count('chr1', [first, middle])).toEqual(twice)
  expect(count('chr1', [first, middle, last])).toEqual(twice)
})

test('a piece on another chromosome breaks the adjacency it sits between', () => {
  expect(
    count('chr1', [
      {
        name: 'r',
        start: 5000,
        end: 5050,
        strand: 1,
        clip: 0,
        sa: 'chr5,101,+,50S50M50S,60,0;chr1,1001,+,100S50M,60,0;',
      },
    ]),
  ).toEqual([])
})

test('a primary and its supplementary count the read once, together or apart', () => {
  const expected = [junction(33286412, 33287511, 'splitBack')]
  expect(count('chr11', [HIPK3_PRIMARY, HIPK3_SUPPLEMENTARY])).toEqual(expected)
  expect(count('chr11', [HIPK3_SUPPLEMENTARY])).toEqual(expected)
  expect(count('chr11', [HIPK3_PRIMARY])).toEqual(expected)
})

test('a junction lands in the group holding its earlier segment', () => {
  const fetch = [HIPK3_PRIMARY, HIPK3_SUPPLEMENTARY]
  expect(count('chr11', [HIPK3_SUPPLEMENTARY], fetch)).toEqual([
    junction(33286412, 33287511, 'splitBack'),
  ])
  expect(count('chr11', [HIPK3_PRIMARY], fetch)).toEqual([])
})

// A deletion-type junction whose two feet sit in two displayed regions: a
// plus-strand read's earlier segment holds the lower foot, a minus-strand
// read's the upper one, so each region fetches the earlier segment of one read
// and the later segment of the other.
test('every region holding a junction foot counts all its reads', () => {
  const seg =
    (name: string, strand: number) =>
    (start: number, clip: number, sa: string): Rec => ({
      name,
      start,
      end: start + 100,
      strand,
      clip,
      sa,
    })
  const plus = seg('plus', 1)
  const minus = seg('minus', -1)
  const lower = [
    plus(900, 0, 'chr1,5001,+,100S100M,60,0;'),
    minus(900, 100, 'chr1,5001,-,100S100M,60,0;'),
  ]
  const upper = [
    plus(5000, 100, 'chr1,901,+,100M100S,60,0;'),
    minus(5000, 0, 'chr1,901,-,100M100S,60,0;'),
  ]
  const expected = [junction(1000, 5000, 'splitForward', 2)]
  expect(count('chr1', lower)).toEqual(expected)
  expect(count('chr1', upper)).toEqual(expected)
})

test('each mate crossing a junction counts, as N gaps do', () => {
  const mate = (flags: number, strand: number) => ({
    name: 'pair',
    strand,
    flags: SAM_FLAG_PAIRED | flags,
  })
  expect(
    count('chr1', [
      {
        ...mate(SAM_FLAG_FIRST_IN_PAIR, 1),
        start: 1000,
        end: 1060,
        clip: 50,
        sa: 'chr1,1951,+,50M60S,60,0;',
      },
      {
        ...mate(SAM_FLAG_FIRST_IN_PAIR | SAM_FLAG_SUPPLEMENTARY, 1),
        start: 1950,
        end: 2000,
        clip: 0,
        sa: 'chr1,1001,+,50H60M,60,0;',
      },
      {
        ...mate(SAM_FLAG_SECOND_IN_PAIR, -1),
        start: 1000,
        end: 1070,
        clip: 0,
        sa: 'chr1,1941,-,60M70S,60,0;',
      },
      {
        ...mate(SAM_FLAG_SECOND_IN_PAIR | SAM_FLAG_SUPPLEMENTARY, -1),
        start: 1940,
        end: 2000,
        clip: 70,
        sa: 'chr1,1001,-,60S70M,60,0;',
      },
    ]),
  ).toEqual([junction(1000, 2000, 'splitBack', 2)])
})

test('two reads over one joint count two', () => {
  expect(
    count('chr11', [HIPK3_PRIMARY, { ...HIPK3_PRIMARY, name: 'other' }]),
  ).toEqual([junction(33286412, 33287511, 'splitBack', 2)])
})

test('a secondary alignment counts nothing', () => {
  expect(count('chr11', [{ ...HIPK3_PRIMARY, flags: 0x100 }])).toEqual([])
})

test('a junction spanning megabases counts like any other', () => {
  expect(
    count('chr11', [
      { ...HIPK3_PRIMARY, sa: 'chr11,43287469,+,43M58S,255,0;' },
    ]),
  ).toEqual([junction(33286412, 43287511, 'splitBack')])
})

test('an SA entry without a CIGAR, span or position joins nothing', () => {
  const seg = { name: 'r', start: 1000, end: 1100, strand: 1, clip: 50 }
  expect(count('chr1', [{ ...seg, sa: 'chr1,501,+,*,60,0;' }])).toEqual([])
  expect(count('chr1', [{ ...seg, sa: 'chr1,x,+,10M,60,0;' }])).toEqual([])
  expect(count('chr1', [{ ...seg, sa: 'chr1,501,+,40S,60,0;' }])).toEqual([])
  expect(
    count('chr1', [{ ...seg, sa: 'chr1,501,+;chr1,2001,+,60S40M,60,0;' }]),
  ).toEqual([junction(1100, 2000, 'splitForward')])
})

// The read arcs chain the same records (`collectPendingArcs`) and coalesce a
// junction's connections into `support`; the sashimi count must be that number.
test('the sashimi count is the read arcs support for the same junction', () => {
  const recs: Rec[] = [
    HIPK3_PRIMARY,
    HIPK3_SUPPLEMENTARY,
    { ...HIPK3_PRIMARY, name: 'primaryOnly' },
    { ...HIPK3_SUPPLEMENTARY, name: 'supplementaryOnly' },
    {
      name: 'circle',
      start: 33286412,
      end: 33287511,
      strand: 1,
      clip: 1099,
      sa: 'chr11,33286413,+,1099M1099S,60,0;',
    },
    {
      name: 'circle',
      start: 33286412,
      end: 33287511,
      strand: 1,
      clip: 0,
      sa: 'chr11,33286413,+,1099S1099M,60,0;',
    },
  ]
  const [sashimi, ...rest] = count('chr11', recs)
  const { arcs } = computeArcsFromPileupData(
    new Map([
      [
        0,
        {
          ...basePileupDataResult(recs.length),
          readPositions: new Uint32Array(recs.flatMap(r => [r.start, r.end])),
          readFlags: new Uint16Array(recs.map(r => r.flags ?? 0)),
          readStrands: new Int8Array(recs.map(r => r.strand)),
          readClipAtStart: new Uint32Array(recs.map(r => r.clip)),
          readSuppAlignments: recs.map(r => r.sa),
          ...namesToBlock(recs.map(r => r.name)),
          ...nextRefsToTable(recs.map(() => '')),
        },
      ],
    ]),
    [
      {
        refName: 'chr11',
        start: 33280000,
        end: 33290000,
        displayedRegionIndex: 0,
      },
    ],
    { colorField: 'insertSizeAndOrientation' },
  )
  expect(rest).toEqual([])
  expect(sashimi).toEqual(junction(33286412, 33287511, 'splitBack', 4))
  expect(
    arcs.map(a => [
      Math.min(a.p1.bp, a.p2.bp),
      Math.max(a.p1.bp, a.p2.bp),
      a.support,
    ]),
  ).toEqual([[sashimi!.start, sashimi!.end, sashimi!.n]])
})
