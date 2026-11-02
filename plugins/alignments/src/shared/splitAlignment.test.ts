import { READ_MATE_UNPLACED } from '@jbrowse/alignments-core'
import { SAM_FLAG_PAIRED } from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

import {
  readCategoryBitsOf,
  splitAlignmentSegments,
  splitReadLaunch,
} from './splitAlignment.ts'

import type { Feature } from '@jbrowse/core/util'

test.each([
  [0, true],
  [60, false],
  [undefined, false],
])(
  'a pair whose mate is on another chromosome at MQ %s is marked mate-unplaced: %s',
  (mq, unplaced) => {
    const feature = new SimpleFeature({
      uniqueId: 'pair',
      refName: 'chr1',
      start: 100,
      end: 200,
      flags: SAM_FLAG_PAIRED,
      score: 60,
      CIGAR: '100M',
      tags: mq === undefined ? {} : { MQ: mq },
    })
    expect((readCategoryBitsOf(feature) & READ_MATE_UNPLACED) !== 0).toBe(
      unplaced,
    )
  },
)

function makeFeature(fields: Record<string, unknown>): Feature {
  return {
    id: () => 'read1',
    get: (key: string) => fields[key],
  } as unknown as Feature
}

// A BCR-ABL1-shaped read: 500 bp on chr22 clipped at its tail, whose tail is
// 300 bp on chr9. The SA record's clip (500S) places it after the primary.
const fusion = makeFeature({
  refName: 'chr22',
  start: 10_000,
  end: 10_500,
  strand: 1,
  CIGAR: '500M300S',
  tags: { SA: 'chr9,20001,-,300M500S,60,0;' },
})

test('a read with no SA tag has no split segments', () => {
  expect(
    splitAlignmentSegments(
      makeFeature({ refName: 'chr22', start: 1, end: 2, CIGAR: '1M' }),
    ),
  ).toEqual([])
})

test('segments list the read then its SA loci, in read order, with their strands', () => {
  expect(splitAlignmentSegments(fusion)).toEqual([
    { refName: 'chr22', start: 10_000, end: 10_500, strand: 1, clip: 0 },
    { refName: 'chr9', start: 20_000, end: 20_300, strand: -1, clip: 500 },
  ])
})

// Read order, not tag order: a reverse-strand primary clips 300 bp at the read's
// start (the CIGAR's tail), and the SA record covering those bases sorts first,
// since the fusion's donor is what a reader expects on the left.
test('a segment earlier in the read leads even when it is the SA record', () => {
  const rev = makeFeature({
    refName: 'chr22',
    start: 10_000,
    end: 10_500,
    strand: -1,
    CIGAR: '500M300S',
    tags: { SA: 'chr9,20001,+,300M500S,60,0;' },
  })
  expect(splitAlignmentSegments(rev).map(s => s.refName)).toEqual([
    'chr9',
    'chr22',
  ])
})

test('a truncated SA record is dropped rather than shown as a locus', () => {
  const junk = makeFeature({
    refName: 'chr22',
    start: 10_000,
    end: 10_500,
    strand: 1,
    CIGAR: '500M300S',
    tags: { SA: 'chr9,20001,+,500S,60,0;' },
  })
  expect(splitAlignmentSegments(junk)).toHaveLength(1)
})

test("a launch frames the first junction and stops on each junction's ends", () => {
  const { feature, stops } = splitReadLaunch(
    'read1',
    'long',
    splitAlignmentSegments(fusion),
  )
  expect(feature.toJSON()).toMatchObject({
    name: 'long',
    refName: 'chr22',
    start: 10_000,
    end: 10_500,
    strand: 1,
    mate: { refName: 'chr9', start: 20_000, end: 20_300, strand: -1 },
  })
  // the edge the read leaves chr22 by, and the edge it enters the reverse
  // chr9 segment by, which is that segment's high end
  expect(stops).toEqual([
    { refName: 'chr22', pos: 10_500 },
    { refName: 'chr9', pos: 20_300 },
  ])
})
