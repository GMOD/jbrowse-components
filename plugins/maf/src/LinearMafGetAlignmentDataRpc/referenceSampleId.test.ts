import { referenceSampleId } from './executeMafAlignmentData.ts'

import type { AlignmentRecord } from '../types.ts'

function aln(seq: string): AlignmentRecord {
  return { chr: 'chr1', start: 0, seq }
}

test('names the row whose sequence is the block reference', () => {
  const refSeq = 'AC-GT'
  const alignments = {
    hg38: aln(refSeq),
    panTro6: aln('ACGGT'),
    mm39: aln('AT-GT'),
  }
  expect(referenceSampleId(alignments, refSeq)).toBe('hg38')
})

// The whole point: the reference row is found by what it carries, not by what
// the view calls the assembly. A MAF-tabix track sets `refAssemblyName` exactly
// when those differ, and matching on the view's name excluded nothing — so the
// reference's guaranteed self-match inflated every conservation position.
test('works when the reference row is not named after the view assembly', () => {
  const refSeq = 'ACGT'
  const alignments = {
    // the MAF calls its reference this; the JBrowse assembly may be
    // "hg38_analysisSet" or anything else
    hg38: aln(refSeq),
  }
  expect(referenceSampleId(alignments, refSeq)).toBe('hg38')
})

// `refAssemblyName` can point the reference at a row that is not the first.
test('picks a non-first row when that is the one carrying the reference', () => {
  const refSeq = 'GGGG'
  const alignments = {
    panTro6: aln('AAAA'),
    hg38: aln(refSeq),
  }
  expect(referenceSampleId(alignments, refSeq)).toBe('hg38')
})

test('a byte-identical later row cannot beat the reference', () => {
  const refSeq = 'ACGT'
  const alignments = {
    // insertion order is stanza order, reference first
    hg38: aln(refSeq),
    // a species identical across this short block
    panTro6: aln('ACGT'),
  }
  expect(referenceSampleId(alignments, refSeq)).toBe('hg38')
})

test('undefined when no row carries the reference sequence', () => {
  expect(referenceSampleId({ mm39: aln('ACGT') }, 'TTTT')).toBeUndefined()
})

test('undefined for a block with no resolvable reference sequence', () => {
  expect(referenceSampleId({ mm39: aln('') }, '')).toBeUndefined()
})
