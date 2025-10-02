import { cigarToMismatches } from './cigarToMismatches'
import { getMismatches, parseCigar } from './index'
import { mdToMismatches } from './mdToMismatches'

const seq =
  'AAAAAAAAAACAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTT'

function createRecord(sequence: string) {
  return {
    seq: sequence,
    seqAt: (idx: number) => sequence[idx],
  }
}

// examples come from
// https://github.com/vsbuffalo/devnotes/wiki/The-MD-Tag-in-BAM-Files and
// http://seqanswers.com/forums/showthread.php?t=8978

test('cigar to mismatches', () => {
  expect(cigarToMismatches(parseCigar('56M1D45M'), createRecord(seq))).toEqual([
    { start: 56, type: 'deletion', base: '*', length: 1 },
  ])
})

test('md to mismatches', () => {
  const record = createRecord(seq)
  const cigarMismatches = cigarToMismatches(parseCigar('56M1D45M'), record)
  expect(
    mdToMismatches(record, '10A80', parseCigar('56M1D45M'), cigarMismatches),
  ).toEqual([
    { start: 10, type: 'mismatch', base: 'C', altbase: 'A', length: 1 },
  ])
})

test('simple deletion', () => {
  // simple deletion
  expect(getMismatches(createRecord(seq), '56M1D45M', '56^A45')).toEqual([
    { start: 56, type: 'deletion', base: '*', length: 1 },
  ])
})

test('simple insertion', () => {
  // simple insertion
  expect(
    getMismatches(
      createRecord(
        'AAAAAAAAAACAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTTA',
      ),
      '89M1I11M',
      '100',
    ),
  ).toEqual([
    {
      start: 89,
      type: 'insertion',
      insertedBases: 'T',
      base: '1',
      length: 0,
    },
  ])
})

test('deletion and a SNP', () => {
  // contains a deletion and a SNP
  // read GGGGG--ATTTTTT
  //      |||||   ||||||
  //      GGGGGACCTTTTTT
  expect(
    getMismatches(createRecord('GGGGGATTTTTT'), '5M2D6M', '5^AC0C5'),
  ).toEqual([
    { start: 5, type: 'deletion', base: '*', length: 2 },
    { start: 7, type: 'mismatch', base: 'A', altbase: 'C', length: 1 },
  ])
})

test('0-length MD entries', () => {
  // 0-length MD entries, which indicates two SNPs right next to each other
  // "They generally occur between SNPs, or between a deletion then a SNP."
  // http://seqanswers.com/forums/showthread.php?t=8978
  //
  // read GGGGGCATTTTT
  //      |||||  |||||
  // ref  GGGGGACTTTTT
  expect(getMismatches(createRecord('GGGGGCATTTTT'), '12M', '5A0C5')).toEqual([
    { altbase: 'A', base: 'C', length: 1, start: 5, type: 'mismatch' },
    { altbase: 'C', base: 'A', length: 1, start: 6, type: 'mismatch' },
  ])
})

test('non-0-length-MD string', () => {
  // same as above but with the non-0-length MD string
  // not sure if it is entirely legal, but may appear in the wild
  expect(getMismatches(createRecord('GGGGGCATTTTT'), '12M', '5AC5')).toEqual([
    { altbase: 'A', base: 'C', length: 1, start: 5, type: 'mismatch' },
    { altbase: 'C', base: 'A', length: 1, start: 6, type: 'mismatch' },
  ])
})

test('basic skip', () => {
  expect(
    getMismatches(createRecord('GGGGGCATTTTT'), '6M200N6M', '5AC5'),
  ).toEqual([
    { base: 'N', length: 200, start: 6, type: 'skip' },
    { altbase: 'A', base: 'C', length: 1, start: 5, type: 'mismatch' },
    { altbase: 'C', base: 'A', length: 1, start: 206, type: 'mismatch' },
  ])
})

test('vsbuffalo', () => {
  // https://github.com/vsbuffalo/devnotes/wiki/The-MD-Tag-in-BAM-Files
  // example 1
  expect(
    getMismatches(
      createRecord(
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      ),
      '89M1I11M',
      '100',
    ),
  ).toEqual([
    {
      base: '1',
      length: 0,
      start: 89,
      type: 'insertion',
      insertedBases: 'A',
    },
  ])

  // https://github.com/vsbuffalo/devnotes/wiki/The-MD-Tag-in-BAM-Files
  // example 2
  expect(
    getMismatches(
      createRecord(
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      ),
      '9M1I91M',
      '48T42G8',
    ),
  ).toEqual([
    {
      base: '1',
      length: 0,
      start: 9,
      type: 'insertion',
      insertedBases: 'A',
    },
    {
      altbase: 'T',
      base: 'A',
      length: 1,
      qual: undefined,
      start: 48,
      type: 'mismatch',
    },
    {
      altbase: 'G',
      base: 'A',
      length: 1,
      qual: undefined,
      start: 91,
      type: 'mismatch',
    },
  ])
})

test('more skip', () => {
  expect(
    getMismatches(createRecord('GGGGGCATTTTT'), '3M200N3M200N3M', '8A'),
  ).toEqual([
    { base: 'N', length: 200, start: 3, type: 'skip' },
    { base: 'N', length: 200, start: 206, type: 'skip' },
    { altbase: 'A', base: 'T', length: 1, start: 408, type: 'mismatch' },
  ])
  expect(
    getMismatches(
      createRecord(seq),
      '31M1I17M1D37M',
      '6G4C20G1A5C5A1^C3A15G1G15',
    ).sort((a, b) => a.start - b.start),
  ).toMatchSnapshot()
})

test('clipping', () => {
  expect(
    getMismatches(createRecord('AAAAAAAAAC'), '200H10M200H', '9A'),
  ).toEqual([
    { cliplen: 200, base: 'H200', length: 1, start: 0, type: 'hardclip' },
    { cliplen: 200, base: 'H200', length: 1, start: 10, type: 'hardclip' },
    { altbase: 'A', base: 'C', length: 1, start: 9, type: 'mismatch' },
  ])

  expect(
    getMismatches(createRecord('AAAAAAAAAAGGGGGGGGGC'), '10S10M10S', '9A'),
  ).toEqual([
    { cliplen: 10, base: 'S10', length: 1, start: 0, type: 'softclip' },
    { cliplen: 10, base: 'S10', length: 1, start: 10, type: 'softclip' },
    { altbase: 'A', base: 'C', length: 1, start: 9, type: 'mismatch' },
  ])
})
