import {
  getMismatches,
  cigarToMismatches,
  parseCigar,
  mdToMismatches,
} from './MismatchParser'

const seq =
  'AAAAAAAAAACAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTT'

// examples come from https://github.com/vsbuffalo/devnotes/wiki/The-MD-Tag-in-BAM-Files
// and http://seqanswers.com/forums/showthread.php?t=8978

test('cigar to mismatches', () => {
  expect(cigarToMismatches(parseCigar('56M1D45M'), seq)).toEqual([
    { start: 56, type: 'deletion', base: '*', length: 1 },
  ])
})

test('md to mismatches', () => {
  const cigarMismatches = cigarToMismatches(parseCigar('56M1D45M'), seq)
  expect(
    mdToMismatches('10A80', parseCigar('56M1D45M'), cigarMismatches, seq),
  ).toEqual([
    { start: 10, type: 'mismatch', base: 'C', altbase: 'A', length: 1 },
  ])
})

test('get mismatches', () => {
  // simple deletion
  expect(getMismatches('56M1D45M', '56^A45', seq)).toEqual([
    { start: 56, type: 'deletion', base: '*', length: 1 },
  ])

  // simple insertion
  expect(
    getMismatches(
      '89M1I11M',
      '100',
      'AAAAAAAAAACAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTTA',
    ),
  ).toEqual([{ start: 89, type: 'insertion', base: '1', length: 1 }])

  // contains a deletion and a SNP
  // read GGGGG--ATTTTTT
  //      |||||   ||||||
  //      GGGGGACCTTTTTT
  expect(getMismatches('5M2D6M', '5^AC0C5', 'GGGGGATTTTTT')).toEqual([
    { start: 5, type: 'deletion', base: '*', length: 2 },
    { start: 7, type: 'mismatch', base: 'A', altbase: 'C', length: 1 },
  ])

  // 0-length MD entries, which indicates two SNPs right next to each other
  // "They generally occur between SNPs, or between a deletion then a SNP."
  // http://seqanswers.com/forums/showthread.php?t=8978
  //
  // read GGGGGCATTTTT
  //      |||||  |||||
  // ref  GGGGGACTTTTT
  expect(getMismatches('12M', '5A0C5', 'GGGGGCATTTTT')).toEqual([
    { altbase: 'A', base: 'C', length: 1, start: 5, type: 'mismatch' },
    { altbase: 'C', base: 'A', length: 1, start: 6, type: 'mismatch' },
  ])

  // same as above but with the non-0-length MD string
  // not sure if it is entirely legal, but may appear in the wild
  expect(getMismatches('12M', '5AC5', 'GGGGGCATTTTT')).toEqual([
    { altbase: 'A', base: 'C', length: 1, start: 5, type: 'mismatch' },
    { altbase: 'C', base: 'A', length: 1, start: 6, type: 'mismatch' },
  ])
  expect(getMismatches('6M200N6M', '5AC5', 'GGGGGCATTTTT')).toEqual([
    { base: 'N', length: 200, start: 6, type: 'skip' },
    { altbase: 'A', base: 'C', length: 1, start: 5, type: 'mismatch' },
    { altbase: 'C', base: 'A', length: 1, start: 206, type: 'mismatch' },
  ])
  expect(
    getMismatches('31M1I17M1D37M', '6G4C20G1A5C5A1^C3A15G1G15', seq).sort(
      (a, b) => a.start - b.start,
    ),
  ).toMatchInlineSnapshot(`
    Array [
      Object {
        "altbase": "G",
        "base": "A",
        "length": 1,
        "start": 6,
        "type": "mismatch",
      },
      Object {
        "altbase": "C",
        "base": "A",
        "length": 1,
        "start": 11,
        "type": "mismatch",
      },
      Object {
        "base": "1",
        "length": 1,
        "start": 31,
        "type": "insertion",
      },
      Object {
        "altbase": "G",
        "base": "C",
        "length": 1,
        "start": 32,
        "type": "mismatch",
      },
      Object {
        "altbase": "A",
        "base": "C",
        "length": 1,
        "start": 34,
        "type": "mismatch",
      },
      Object {
        "altbase": "C",
        "base": "C",
        "length": 1,
        "start": 40,
        "type": "mismatch",
      },
      Object {
        "altbase": "A",
        "base": "C",
        "length": 1,
        "start": 46,
        "type": "mismatch",
      },
      Object {
        "base": "*",
        "length": 1,
        "start": 48,
        "type": "deletion",
      },
      Object {
        "altbase": "A",
        "base": "G",
        "length": 1,
        "start": 52,
        "type": "mismatch",
      },
      Object {
        "altbase": "G",
        "base": "G",
        "length": 1,
        "start": 68,
        "type": "mismatch",
      },
      Object {
        "altbase": "G",
        "base": "G",
        "length": 1,
        "start": 70,
        "type": "mismatch",
      },
    ]
  `)
})

test('clipping', () => {
  expect(getMismatches('200H10M200H', '9A', 'AAAAAAAAAC')).toEqual([
    { cliplen: 200, base: 'H200', length: 1, start: 0, type: 'hardclip' },
    { cliplen: 200, base: 'H200', length: 1, start: 10, type: 'hardclip' },
    { altbase: 'A', base: 'C', length: 1, start: 9, type: 'mismatch' },
  ])

  expect(getMismatches('10S10M10S', '9A', 'AAAAAAAAAAGGGGGGGGGC')).toEqual([
    { cliplen: 10, base: 'S10', length: 1, start: 0, type: 'softclip' },
    { cliplen: 10, base: 'S10', length: 1, start: 10, type: 'softclip' },
    { altbase: 'A', base: 'C', length: 1, start: 9, type: 'mismatch' },
  ])
})
