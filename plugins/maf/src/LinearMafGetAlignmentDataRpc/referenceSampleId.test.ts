import { addFeatureBlock } from '../util/mafBlockSink.ts'
import { MafRegionSink } from './mafRegionSink.ts'

import type { AlignmentRecord } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

function aln(seq: string): AlignmentRecord {
  return { chr: 'chr1', srcStart: 0, seq }
}

function referenceSampleId(
  ...blocks: [Record<string, AlignmentRecord>, string][]
) {
  const sink = new MafRegionSink(undefined)
  for (const [alignments, seq] of blocks) {
    const data: Record<string, unknown> = { start: 0, alignments, seq }
    addFeatureBlock(sink, {
      id: () => 'b',
      get: (field: string) => data[field],
    } as unknown as Feature)
  }
  return sink.refSampleId
}

test('names the row whose sequence is the block reference', () => {
  const refSeq = 'AC-GT'
  const alignments = {
    hg38: aln(refSeq),
    panTro6: aln('ACGGT'),
    mm39: aln('AT-GT'),
  }
  expect(referenceSampleId([alignments, refSeq])).toBe('hg38')
})

// The whole point: the reference row is found by what it carries, not by what
// the view calls the assembly. A MAF-tabix track sets `refAssemblyName` exactly
// when those differ, and matching on the view's name excluded nothing — so the
// reference's guaranteed self-match inflated every conservation position.
test('works when the reference row is not named after the view assembly', () => {
  const refSeq = 'ACGT'
  expect(referenceSampleId([{ hg38: aln(refSeq) }, refSeq])).toBe('hg38')
})

test('picks a non-first row when that is the one carrying the reference', () => {
  const refSeq = 'GGGG'
  const alignments = {
    panTro6: aln('AAAA'),
    hg38: aln(refSeq),
  }
  expect(referenceSampleId([alignments, refSeq])).toBe('hg38')
})

test('a byte-identical later row cannot beat the reference', () => {
  const refSeq = 'ACGT'
  const alignments = {
    hg38: aln(refSeq),
    panTro6: aln('ACGT'),
  }
  expect(referenceSampleId([alignments, refSeq])).toBe('hg38')
})

test('compares text, not string identity', () => {
  const seq = ['AC', 'GT'].join('')
  expect(referenceSampleId([{ hg38: aln(seq) }, 'ACGT'])).toBe('hg38')
})

test('undefined when no row carries the reference sequence', () => {
  expect(referenceSampleId([{ mm39: aln('ACGT') }, 'TTTT'])).toBeUndefined()
})

test('undefined for a block with no resolvable reference sequence', () => {
  expect(referenceSampleId([{ mm39: aln('') }, ''])).toBeUndefined()
})

test('the first block whose reference a row carries decides', () => {
  expect(
    referenceSampleId(
      [{ mm39: aln('ACGT') }, 'TTTT'],
      [{ hg38: aln('GG'), mm39: aln('CC') }, 'CC'],
      [{ hg38: aln('AA') }, 'AA'],
    ),
  ).toBe('mm39')
})
