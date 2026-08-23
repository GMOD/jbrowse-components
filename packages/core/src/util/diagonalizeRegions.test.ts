import { diagonalizeRegions } from './diagonalizeRegions.ts'

import type { AlignmentData } from './diagonalizeRegions.ts'
import type { Region } from './types/data.ts'

function region(refName: string, end: number, assemblyName: string): Region {
  return { refName, start: 0, end, assemblyName }
}

function aln({
  ref,
  query,
  refStart,
  queryStart,
  length,
  strand = 1,
}: {
  ref: string
  query: string
  refStart: number
  queryStart: number
  length: number
  strand?: number
}): AlignmentData {
  return {
    refRefName: ref,
    queryRefName: query,
    refStart,
    refEnd: refStart + length,
    queryStart,
    queryEnd: queryStart + length,
    strand,
  }
}

const names = (regions: Region[]) => regions.map(r => r.refName)

describe('reversal decision', () => {
  // Both query chromosomes have an exactly 50/50 length-weighted strand vote, so
  // the vote cannot decide. The arrangement of the blocks can: qRev's blocks run
  // antiparallel to the reference, qFwd's run with it.
  test('position covariance decides when the strand vote is split', async () => {
    const refRegions = [region('chr1', 1_000_000, 'ref')]
    const queryRegions = [
      region('qFwd', 1_000_000, 'asm'),
      region('qRev', 1_000_000, 'asm'),
    ]
    const strands = [1, 1, -1, -1]
    const alignments: AlignmentData[] = []
    for (let i = 0; i < 4; i++) {
      alignments.push(
        aln({
          ref: 'chr1',
          query: 'qFwd',
          refStart: i * 100_000,
          queryStart: i * 100_000,
          length: 100_000,
          strand: strands[i],
        }),
        aln({
          ref: 'chr1',
          query: 'qRev',
          refStart: 500_000 + i * 100_000,
          queryStart: 300_000 - i * 100_000,
          length: 100_000,
          strand: strands[i],
        }),
      )
    }

    const { newRegions } = await diagonalizeRegions(
      alignments,
      refRegions,
      queryRegions,
    )

    expect(newRegions.find(r => r.refName === 'qFwd')?.reversed).toBe(false)
    expect(newRegions.find(r => r.refName === 'qRev')?.reversed).toBe(true)
  })

  test('a decisive strand vote wins over the covariance', async () => {
    const refRegions = [region('chr1', 1_000_000, 'ref')]
    const queryRegions = [region('q1', 1_000_000, 'asm')]
    // every block is minus strand while the blocks themselves are laid out in
    // increasing order on both axes (positive covariance)
    const alignments = [0, 1, 2, 3].map(i =>
      aln({
        ref: 'chr1',
        query: 'q1',
        refStart: i * 100_000,
        queryStart: i * 100_000,
        length: 100_000,
        strand: -1,
      }),
    )

    const { newRegions, stats } = await diagonalizeRegions(
      alignments,
      refRegions,
      queryRegions,
    )

    expect(newRegions[0]!.reversed).toBe(true)
    expect(stats.regionsReversed).toBe(1)
  })

  test('a single alignment falls back to its strand', async () => {
    const refRegions = [region('chr1', 1_000_000, 'ref')]
    const queryRegions = [
      region('qFwd', 1_000_000, 'asm'),
      region('qRev', 1_000_000, 'asm'),
    ]
    const alignments = [
      aln({
        ref: 'chr1',
        query: 'qFwd',
        refStart: 0,
        queryStart: 0,
        length: 400_000,
      }),
      aln({
        ref: 'chr1',
        query: 'qRev',
        refStart: 500_000,
        queryStart: 0,
        length: 400_000,
        strand: -1,
      }),
    ]

    const { newRegions } = await diagonalizeRegions(
      alignments,
      refRegions,
      queryRegions,
    )

    expect(newRegions.find(r => r.refName === 'qFwd')?.reversed).toBe(false)
    expect(newRegions.find(r => r.refName === 'qRev')?.reversed).toBe(true)
  })
})

describe('reference axis handling', () => {
  // A chromosome displayed as two regions must order by where it first appears,
  // otherwise every query chromosome anchored to it sorts after whatever sits
  // between the two occurrences.
  test('a refName appearing twice orders by its first appearance', async () => {
    const refRegions: Region[] = [
      { refName: 'chrA', start: 0, end: 500_000, assemblyName: 'ref' },
      region('chrB', 1_000_000, 'ref'),
      { refName: 'chrA', start: 500_000, end: 1_000_000, assemblyName: 'ref' },
    ]
    const queryRegions = [
      region('qB', 1_000_000, 'asm'),
      region('qA', 1_000_000, 'asm'),
    ]
    const alignments = [
      aln({
        ref: 'chrA',
        query: 'qA',
        refStart: 600_000,
        queryStart: 0,
        length: 100_000,
      }),
      aln({
        ref: 'chrB',
        query: 'qB',
        refStart: 0,
        queryStart: 0,
        length: 100_000,
      }),
    ]

    const { newRegions } = await diagonalizeRegions(
      alignments,
      refRegions,
      queryRegions,
    )

    expect(names(newRegions)).toEqual(['qA', 'qB'])
  })

  // A multi-genome adapter can return alignments to sequences the reference axis
  // does not display. They must not win the anchor vote, or the query chromosome
  // gets ordered by a position on a chromosome nobody can see.
  test('alignments to an undisplayed reference chromosome are ignored', async () => {
    const refRegions = [region('chr1', 1_000_000, 'ref')]
    const queryRegions = [
      region('qX', 1_000_000, 'asm'),
      region('qY', 1_000_000, 'asm'),
    ]
    const alignments = [
      aln({
        ref: 'chr2',
        query: 'qX',
        refStart: 0,
        queryStart: 0,
        length: 500_000,
      }),
      aln({
        ref: 'chr1',
        query: 'qX',
        refStart: 0,
        queryStart: 0,
        length: 50_000,
      }),
      aln({
        ref: 'chr1',
        query: 'qY',
        refStart: 500_000,
        queryStart: 0,
        length: 100_000,
      }),
    ]

    const { newRegions } = await diagonalizeRegions(
      alignments,
      refRegions,
      queryRegions,
    )

    expect(names(newRegions)).toEqual(['qX', 'qY'])
  })

  test('a query chromosome with only zero-length alignments joins the tail', async () => {
    const refRegions = [region('chr1', 1_000_000, 'ref')]
    const queryRegions = [
      region('qZero', 1_000_000, 'asm'),
      region('qReal', 1_000_000, 'asm'),
    ]
    const alignments = [
      aln({
        ref: 'chr1',
        query: 'qZero',
        refStart: 10_000,
        queryStart: 0,
        length: 0,
      }),
      aln({
        ref: 'chr1',
        query: 'qReal',
        refStart: 500_000,
        queryStart: 0,
        length: 100_000,
      }),
    ]

    const { newRegions } = await diagonalizeRegions(
      alignments,
      refRegions,
      queryRegions,
    )

    expect(names(newRegions)).toEqual(['qReal', 'qZero'])
  })
})

// The worker concatenates features by arrival, so the result must not depend on
// input order. The accumulation is per (query, reference) pair and integer-exact
// for the base counts, and the remaining orderings (anchor choice on an exact
// base-count tie, equal-position query chromosomes) break explicitly by refName.
test('result is independent of input alignment order', async () => {
  const refRegions = [
    region('chrA', 1_000_000, 'ref'),
    region('chrB', 1_000_000, 'ref'),
  ]
  const queryRegions = [
    region('q1', 1_000_000, 'asm'),
    region('q2', 1_000_000, 'asm'),
    region('q3', 1_000_000, 'asm'),
  ]
  const alignments = [
    // q1 ties exactly between chrA and chrB
    aln({
      ref: 'chrA',
      query: 'q1',
      refStart: 0,
      queryStart: 0,
      length: 50_000,
    }),
    aln({
      ref: 'chrB',
      query: 'q1',
      refStart: 800_000,
      queryStart: 0,
      length: 50_000,
    }),
    // q2 and q3 sit at the same weighted position on chrA, so their order is a
    // refName tiebreak
    aln({
      ref: 'chrA',
      query: 'q2',
      refStart: 400_000,
      queryStart: 0,
      length: 100_000,
    }),
    aln({
      ref: 'chrA',
      query: 'q3',
      refStart: 400_000,
      queryStart: 0,
      length: 100_000,
    }),
  ]

  const order = async (a: AlignmentData[]) =>
    names((await diagonalizeRegions(a, refRegions, queryRegions)).newRegions)

  const forward = await order(alignments)
  expect(forward).toEqual(['q1', 'q2', 'q3'])
  expect(await order([...alignments].reverse())).toEqual(forward)
  expect(
    await order([
      alignments[2]!,
      alignments[0]!,
      alignments[3]!,
      alignments[1]!,
    ]),
  ).toEqual(forward)
})
