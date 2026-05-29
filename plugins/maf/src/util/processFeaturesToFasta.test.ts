import { SimpleFeature } from '@jbrowse/core/util'

import { processFeaturesToFasta } from './processFeaturesToFasta.ts'

import type { Feature } from '@jbrowse/core/util'

function makeMap(features: Feature[]) {
  return new Map(features.map(f => [f.id(), f]))
}
const mockFeature = new SimpleFeature({
  uniqueId: '123',
  refName: 'abc',
  start: 100,
  end: 110,
  seq: 'ACGTACGTAC',
  alignments: {
    assembly1: {
      chr: 'chr1',
      start: 100,
      seq: 'ACGTACGTAC',
      strand: 1,
    },
    assembly2: {
      chr: 'chr2',
      start: 200,
      seq: 'AC-TTCGTAC',
      strand: 1,
    },
  },
})
test('no showAllLetters', () => {
  const result = processFeaturesToFasta({
    features: makeMap([mockFeature]),
    samples: [
      { id: 'assembly1', label: 'assembly1' },
      { id: 'assembly2', label: 'assembly2' },
    ],
    regions: [
      {
        refName: 'chr1',
        start: 100,
        end: 105,
        assemblyName: 'assembly1',
      },
    ],
  })
  // No insertions: every display column is a reference position, regardless of
  // which sample is the reference.
  expect(result.colToGenomePos).toEqual([100, 101, 102, 103, 104])
  expect(result).toMatchSnapshot()
})

test('showAllLetters', () => {
  const result = processFeaturesToFasta({
    features: makeMap([mockFeature]),
    samples: [
      { id: 'assembly1', label: 'assembly1' },
      { id: 'assembly2', label: 'assembly2' },
    ],
    showAllLetters: true,
    regions: [
      {
        refName: 'chr1',
        start: 100,
        end: 105,
        assemblyName: 'assembly1',
      },
    ],
  })
  expect(result).toMatchSnapshot()
})

test('gap in assembly1', () => {
  const mockFeature = new SimpleFeature({
    uniqueId: '123',
    refName: 'abc',
    start: 100,
    end: 110,
    seq: 'AC-TACGTAC',
    alignments: {
      assembly1: {
        chr: 'chr1',
        start: 100,
        seq: 'AC-TACGTAC',
        strand: 1,
      },
      assembly2: {
        chr: 'chr2',
        start: 200,
        seq: 'ACGTTCGTAC',
        strand: 1,
      },
    },
  })

  const result = processFeaturesToFasta({
    features: makeMap([mockFeature]),
    samples: [
      { id: 'assembly1', label: 'assembly1' },
      { id: 'assembly2', label: 'assembly2' },
    ],
    regions: [
      {
        refName: 'chr1',
        start: 100,
        end: 105,
        assemblyName: 'assembly1',
      },
    ],
  })
  expect(result).toMatchSnapshot()
})

test('includeInsertions - single insertion in one sample', () => {
  // Reference seq has a gap (insertion in assembly2)
  // seq:       AC--GTAC (reference with gap = insertion in aligned seq)
  // assembly1: AC--GTAC (no insertion, matches reference gap)
  // assembly2: ACTTGTAC (has TT insertion)
  const mockFeature = new SimpleFeature({
    uniqueId: '123',
    refName: 'abc',
    start: 100,
    end: 106, // 6 bp reference (AC GTAC without the gap)
    seq: 'AC--GTAC',
    alignments: {
      assembly1: {
        chr: 'chr1',
        start: 100,
        seq: 'AC--GTAC',
        strand: 1,
      },
      assembly2: {
        chr: 'chr2',
        start: 200,
        seq: 'ACTTGTAC',
        strand: 1,
      },
    },
  })

  const result = processFeaturesToFasta({
    features: makeMap([mockFeature]),
    samples: [
      { id: 'assembly1', label: 'assembly1' },
      { id: 'assembly2', label: 'assembly2' },
    ],
    includeInsertions: true,
    showAllLetters: true,
    regions: [
      {
        refName: 'chr1',
        start: 100,
        end: 106,
        assemblyName: 'assembly1',
      },
    ],
  })
  // assembly1 should have gaps where the insertion is
  // assembly2 should have the TT insertion
  expect(result).toMatchSnapshot()
})

test('includeInsertions - insertions in multiple samples with different lengths', () => {
  // Reference has gap, different samples have different insertion lengths
  // seq:       AC---GTAC (reference with 3-bp gap)
  // assembly1: AC-T-GTAC (has T insertion, 1 bp)
  // assembly2: ACTTTGTAC (has TTT insertion, 3 bp)
  const mockFeature = new SimpleFeature({
    uniqueId: '123',
    refName: 'abc',
    start: 100,
    end: 106,
    seq: 'AC---GTAC',
    alignments: {
      assembly1: {
        chr: 'chr1',
        start: 100,
        seq: 'AC-T-GTAC',
        strand: 1,
      },
      assembly2: {
        chr: 'chr2',
        start: 200,
        seq: 'ACTTTGTAC',
        strand: 1,
      },
    },
  })

  const result = processFeaturesToFasta({
    features: makeMap([mockFeature]),
    samples: [
      { id: 'assembly1', label: 'assembly1' },
      { id: 'assembly2', label: 'assembly2' },
    ],
    includeInsertions: true,
    showAllLetters: true,
    regions: [
      {
        refName: 'chr1',
        start: 100,
        end: 106,
        assemblyName: 'assembly1',
      },
    ],
  })
  // assembly1 should have T-- (padded to max insertion length 3)
  // assembly2 should have TTT
  expect(result).toMatchSnapshot()
})

test('includeInsertions - insertions at multiple positions', () => {
  // Reference has gaps at two positions
  // seq:       A-CG-TAC
  // assembly1: ATCGGTAC (T insertion at pos 1, G insertion at pos 4)
  // assembly2: A-CG-TAC (no insertions)
  const mockFeature = new SimpleFeature({
    uniqueId: '123',
    refName: 'abc',
    start: 100,
    end: 106,
    seq: 'A-CG-TAC',
    alignments: {
      assembly1: {
        chr: 'chr1',
        start: 100,
        seq: 'ATCGGTAC',
        strand: 1,
      },
      assembly2: {
        chr: 'chr2',
        start: 200,
        seq: 'A-CG-TAC',
        strand: 1,
      },
    },
  })

  const result = processFeaturesToFasta({
    features: makeMap([mockFeature]),
    samples: [
      { id: 'assembly1', label: 'assembly1' },
      { id: 'assembly2', label: 'assembly2' },
    ],
    includeInsertions: true,
    showAllLetters: true,
    regions: [
      {
        refName: 'chr1',
        start: 100,
        end: 106,
        assemblyName: 'assembly1',
      },
    ],
  })
  expect(result).toMatchSnapshot()
})

test('includeInsertions=false ignores insertions', () => {
  const mockFeature = new SimpleFeature({
    uniqueId: '123',
    refName: 'abc',
    start: 100,
    end: 106,
    seq: 'AC--GTAC',
    alignments: {
      assembly1: {
        chr: 'chr1',
        start: 100,
        seq: 'AC--GTAC',
        strand: 1,
      },
      assembly2: {
        chr: 'chr2',
        start: 200,
        seq: 'ACTTGTAC',
        strand: 1,
      },
    },
  })

  const result = processFeaturesToFasta({
    features: makeMap([mockFeature]),
    samples: [
      { id: 'assembly1', label: 'assembly1' },
      { id: 'assembly2', label: 'assembly2' },
    ],
    includeInsertions: false,
    showAllLetters: true,
    regions: [
      {
        refName: 'chr1',
        start: 100,
        end: 106,
        assemblyName: 'assembly1',
      },
    ],
  })
  // Without insertions, both should be 6 characters (no expansion)
  expect(result.rows[0]).toHaveLength(6)
  expect(result.rows[1]).toHaveLength(6)
  expect(result).toMatchSnapshot()
})

test('includeInsertions with no insertions present', () => {
  // No gaps in reference = no insertions
  const result = processFeaturesToFasta({
    features: makeMap([mockFeature]),
    samples: [
      { id: 'assembly1', label: 'assembly1' },
      { id: 'assembly2', label: 'assembly2' },
    ],
    includeInsertions: true,
    showAllLetters: true,
    regions: [
      {
        refName: 'chr1',
        start: 100,
        end: 105,
        assemblyName: 'assembly1',
      },
    ],
  })
  // Should behave same as without includeInsertions since there are none
  expect(result).toMatchSnapshot()
})

test('includeInsertions - insertion only in non-visible sample should not add gaps', () => {
  // This tests the bug fix where insertions from non-visible samples were
  // causing gaps to be added to visible samples.
  //
  // Scenario: 3 samples exist, but only 2 are selected for display.
  // The 3rd (non-visible) sample has an insertion, which creates a gap in the
  // reference sequence. The visible samples should NOT have extra gaps added.
  //
  // seq:       AC--GTAC (reference has gap due to assembly3's insertion)
  // assembly1: AC--GTAC (no insertion, just gaps where assembly3 has insertion)
  // assembly2: AC--GTAC (no insertion, just gaps where assembly3 has insertion)
  // assembly3: ACTTGTAC (has TT insertion) - NOT in samples list
  const mockFeature = new SimpleFeature({
    uniqueId: '123',
    refName: 'abc',
    start: 100,
    end: 106,
    seq: 'AC--GTAC',
    alignments: {
      assembly1: {
        chr: 'chr1',
        start: 100,
        seq: 'AC--GTAC',
        strand: 1,
      },
      assembly2: {
        chr: 'chr2',
        start: 200,
        seq: 'AC--GTAC',
        strand: 1,
      },
      assembly3: {
        chr: 'chr3',
        start: 300,
        seq: 'ACTTGTAC',
        strand: 1,
      },
    },
  })

  // Only include assembly1 and assembly2, NOT assembly3
  const result = processFeaturesToFasta({
    features: makeMap([mockFeature]),
    samples: [
      { id: 'assembly1', label: 'assembly1' },
      { id: 'assembly2', label: 'assembly2' },
    ],
    includeInsertions: true,
    showAllLetters: true,
    regions: [
      {
        refName: 'chr1',
        start: 100,
        end: 106,
        assemblyName: 'assembly1',
      },
    ],
  })

  // Since neither visible sample has an actual insertion (both have only gaps
  // at the insertion position), no insertion columns should be added.
  // The output should be 6 characters (the reference length), not 8.
  expect(result.rows[0]).toBe('acgtac')
  expect(result.rows[1]).toBe('acgtac')
  expect(result.rows[0]).toHaveLength(6)
  expect(result.rows[1]).toHaveLength(6)
})

test('includeInsertions - mixed visible/non-visible insertions', () => {
  // Scenario: Reference has a gap. One visible sample has an insertion,
  // another visible sample doesn't, and a non-visible sample also has an
  // insertion. Only the visible sample's insertion should be included.
  //
  // seq:       AC---GTAC (reference has 3-bp gap)
  // assembly1: AC-T-GTAC (has T insertion, 1 bp) - visible
  // assembly2: AC---GTAC (no insertion) - visible
  // assembly3: ACTTTGTAC (has TTT insertion, 3 bp) - NOT visible
  const mockFeature = new SimpleFeature({
    uniqueId: '123',
    refName: 'abc',
    start: 100,
    end: 106,
    seq: 'AC---GTAC',
    alignments: {
      assembly1: {
        chr: 'chr1',
        start: 100,
        seq: 'AC-T-GTAC',
        strand: 1,
      },
      assembly2: {
        chr: 'chr2',
        start: 200,
        seq: 'AC---GTAC',
        strand: 1,
      },
      assembly3: {
        chr: 'chr3',
        start: 300,
        seq: 'ACTTTGTAC',
        strand: 1,
      },
    },
  })

  // Only include assembly1 and assembly2, NOT assembly3
  const result = processFeaturesToFasta({
    features: makeMap([mockFeature]),
    samples: [
      { id: 'assembly1', label: 'assembly1' },
      { id: 'assembly2', label: 'assembly2' },
    ],
    includeInsertions: true,
    showAllLetters: true,
    regions: [
      {
        refName: 'chr1',
        start: 100,
        end: 106,
        assemblyName: 'assembly1',
      },
    ],
  })

  // assembly1 has a 1-bp insertion (t), so the max insertion length is 1
  // (not 3, because assembly3's insertion should be ignored)
  // assembly1: act-gtac -> with insertion expanded: actgtac (7 chars)
  // assembly2: ac--gtac -> with insertion expanded: ac-gtac (7 chars)
  expect(result.rows[0]).toBe('actgtac')
  expect(result.rows[1]).toBe('ac-gtac')
  expect(result.rows[0]).toHaveLength(7)
  expect(result.rows[1]).toHaveLength(7)
  // The inserted column (display col 2, the `t`) has no reference base → -1;
  // every other column maps to its reference position.
  expect(result.colToGenomePos).toEqual([100, 101, -1, 102, 103, 104, 105])
})
