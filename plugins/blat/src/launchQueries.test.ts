import { softClippedQueries, toFasta } from './launchQueries.ts'

const bases = (n: number, base = 'A') => base.repeat(n)

test('both soft clips, named for the side of the pileup they are drawn on', () => {
  const seq = bases(25, 'C') + bases(50) + bases(30, 'G')
  expect(softClippedQueries({ name: 'r1', cigar: '25S50M30S', seq })).toEqual([
    { name: 'r1_left_clip', seq: bases(25, 'C') },
    { name: 'r1_right_clip', seq: bases(30, 'G') },
  ])
})

// a hard clip's bases are not in SEQ, so the soft clip inside it is what starts
// SEQ, and a hard clip alone leaves nothing to search
test('a hard clip outside the soft clip is stepped over', () => {
  const seq = bases(25, 'C') + bases(50)
  expect(softClippedQueries({ name: 'r1', cigar: '100H25S50M', seq })).toEqual([
    { name: 'r1_left_clip', seq: bases(25, 'C') },
  ])
  expect(
    softClippedQueries({ name: 'r1', cigar: '100H50M', seq: bases(50) }),
  ).toEqual([])
})

test('a clip shorter than BLAT will take is left out', () => {
  const seq = bases(19, 'C') + bases(50) + bases(20, 'G')
  expect(softClippedQueries({ name: 'r1', cigar: '19S50M20S', seq })).toEqual([
    { name: 'r1_right_clip', seq: bases(20, 'G') },
  ])
})

// one S op matches as both the leading and the trailing clip; it is the whole
// read, which "BLAT read" already offers
test('a CIGAR that is all clip is not offered as two clips', () => {
  expect(
    softClippedQueries({ name: 'r1', cigar: '40S', seq: bases(40) }),
  ).toEqual([])
})

test('the dialog gets one FASTA record per sequence', () => {
  expect(
    toFasta([
      { name: 'a', seq: 'ACGT' },
      { name: 'b', seq: 'TTTT' },
    ]),
  ).toBe('>a\nACGT\n>b\nTTTT')
})
