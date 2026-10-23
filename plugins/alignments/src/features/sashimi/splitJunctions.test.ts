import { namesToBlock } from '@jbrowse/alignments-core'

import { splitClassCode } from './junctionClass.ts'
import { computeSplitJunctions } from './splitJunctions.ts'

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

function count(refName: string, recs: Rec[]) {
  const junctions = computeSplitJunctions({
    refName,
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
  })
  return [...junctions.values()]
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
  flags: 0x800,
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

test('a rolling-circle read counts its joint once however many passes cross it', () => {
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
  expect(count('chr1', [middle])).toEqual([junction(1000, 1500, 'splitBack')])
  expect(count('chr1', [first, middle])).toEqual([
    junction(1000, 1500, 'splitBack'),
  ])
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
})

test('two reads over one joint count two', () => {
  expect(
    count('chr11', [HIPK3_PRIMARY, { ...HIPK3_PRIMARY, name: 'other' }]),
  ).toEqual([junction(33286412, 33287511, 'splitBack', 2)])
})

test('a secondary alignment, or a join past the span cap, counts nothing', () => {
  expect(count('chr11', [{ ...HIPK3_PRIMARY, flags: 0x100 }])).toEqual([])
  expect(
    count('chr11', [
      { ...HIPK3_PRIMARY, sa: 'chr11,43287469,+,43M58S,255,0;' },
    ]),
  ).toEqual([])
})
