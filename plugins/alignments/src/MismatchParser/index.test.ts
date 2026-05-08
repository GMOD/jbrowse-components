import { cigarToMismatches2 } from './cigarToMismatches2.ts'
import { getMismatches, parseCigar2 } from './index.ts'
import { mdToMismatches2 } from './mdToMismatches2.ts'

const seq =
  'AAAAAAAAAACAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTT'

// examples come from
// https://github.com/vsbuffalo/devnotes/wiki/The-MD-Tag-in-BAM-Files and
// http://seqanswers.com/forums/showthread.php?t=8978

test('cigar to mismatches', () => {
  expect(cigarToMismatches2(parseCigar2('56M1D45M'), seq)).toEqual([
    { start: 56, type: 'deletion', length: 1 },
  ])
})

test('md to mismatches', () => {
  const ops = parseCigar2('56M1D45M')
  const cigarMismatches = cigarToMismatches2(ops, seq)
  expect(mdToMismatches2('10A80', ops, cigarMismatches, seq)).toEqual([
    {
      start: 10,
      type: 'mismatch',
      base: 'C',
      altbase: 'A',
      length: 1,
    },
  ])
})

test('simple deletion', () => {
  // simple deletion
  expect(getMismatches('56M1D45M', '56^A45', seq)).toEqual([
    { start: 56, type: 'deletion', length: 1 },
  ])
})

test('simple insertion', () => {
  // simple insertion
  expect(
    getMismatches(
      '89M1I11M',
      '100',
      'AAAAAAAAAACAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTTA',
    ),
  ).toEqual([
    {
      start: 89,
      type: 'insertion',
      insertedBases: 'T',
      insertlen: 1,
      length: 0,
    },
  ])
})

test('deletion and a SNP', () => {
  // contains a deletion and a SNP
  // read GGGGG--ATTTTTT
  //      |||||   ||||||
  //      GGGGGACCTTTTTT
  expect(getMismatches('5M2D6M', '5^AC0C5', 'GGGGGATTTTTT')).toEqual([
    { start: 5, type: 'deletion', length: 2 },
    {
      start: 7,
      type: 'mismatch',
      base: 'A',
      altbase: 'C',
      length: 1,
    },
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
  expect(getMismatches('12M', '5A0C5', 'GGGGGCATTTTT')).toEqual([
    {
      altbase: 'A',
      base: 'C',
      length: 1,
      start: 5,
      type: 'mismatch',
    },
    {
      altbase: 'C',
      base: 'A',
      length: 1,
      start: 6,
      type: 'mismatch',
    },
  ])
})

test('non-0-length-MD string', () => {
  // same as above but with the non-0-length MD string
  // not sure if it is entirely legal, but may appear in the wild
  expect(getMismatches('12M', '5AC5', 'GGGGGCATTTTT')).toEqual([
    {
      altbase: 'A',
      base: 'C',
      length: 1,
      start: 5,
      type: 'mismatch',
    },
    {
      altbase: 'C',
      base: 'A',
      length: 1,
      start: 6,
      type: 'mismatch',
    },
  ])
})

test('basic skip', () => {
  expect(getMismatches('6M200N6M', '5AC5', 'GGGGGCATTTTT')).toEqual([
    { length: 200, start: 6, type: 'skip' },
    {
      altbase: 'A',
      base: 'C',
      length: 1,
      start: 5,
      type: 'mismatch',
    },
    {
      altbase: 'C',
      base: 'A',
      length: 1,
      start: 206,
      type: 'mismatch',
    },
  ])
})

test('vsbuffalo', () => {
  // https://github.com/vsbuffalo/devnotes/wiki/The-MD-Tag-in-BAM-Files
  // example 1
  expect(
    getMismatches(
      '89M1I11M',
      '100',
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    ),
  ).toEqual([
    {
      insertlen: 1,
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
      '9M1I91M',
      '48T42G8',
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    ),
  ).toEqual([
    {
      insertlen: 1,
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
  expect(getMismatches('3M200N3M200N3M', '8A', 'GGGGGCATTTTT')).toEqual([
    { length: 200, start: 3, type: 'skip' },
    { length: 200, start: 206, type: 'skip' },
    {
      altbase: 'A',
      base: 'T',
      length: 1,
      start: 408,
      type: 'mismatch',
    },
  ])
  expect(
    getMismatches('31M1I17M1D37M', '6G4C20G1A5C5A1^C3A15G1G15', seq).sort(
      (a, b) => a.start - b.start,
    ),
  ).toMatchSnapshot()
})

test('clipping', () => {
  expect(getMismatches('200H10M200H', '9A', 'AAAAAAAAAC')).toEqual([
    {
      cliplen: 200,
      length: 1,
      start: 0,
      type: 'hardclip',
    },
    {
      cliplen: 200,
      length: 1,
      start: 10,
      type: 'hardclip',
    },
    {
      altbase: 'A',
      base: 'C',
      length: 1,
      start: 9,
      type: 'mismatch',
    },
  ])

  expect(getMismatches('10S10M10S', '9A', 'AAAAAAAAAAGGGGGGGGGC')).toEqual([
    {
      cliplen: 10,
      length: 1,
      start: 0,
      type: 'softclip',
    },
    {
      cliplen: 10,
      length: 1,
      start: 10,
      type: 'softclip',
    },
    {
      altbase: 'A',
      base: 'C',
      length: 1,
      start: 9,
      type: 'mismatch',
    },
  ])
})

test('multiple consecutive mismatches', () => {
  // SAM spec example: 10A5^AC6 from the spec
  expect(getMismatches('21M', '10A5^AC6', 'ACGTACGTACTTTTTTTTTTTT')).toEqual([
    {
      altbase: 'A',
      base: 'T',
      length: 1,
      start: 10,
      type: 'mismatch',
    },
  ])
})

test('consecutive mismatches with 0-length runs', () => {
  // Multiple mismatches back-to-back
  expect(getMismatches('10M', 'A0T0G0C6', 'CATGCCCCCC')).toEqual([
    {
      altbase: 'A',
      base: 'C',
      length: 1,
      start: 0,
      type: 'mismatch',
    },
    {
      altbase: 'T',
      base: 'A',
      length: 1,
      start: 1,
      type: 'mismatch',
    },
    {
      altbase: 'G',
      base: 'T',
      length: 1,
      start: 2,
      type: 'mismatch',
    },
    {
      altbase: 'C',
      base: 'G',
      length: 1,
      start: 3,
      type: 'mismatch',
    },
  ])
})

test('long deletion', () => {
  // Multiple base deletion
  expect(getMismatches('5M10D5M', '5^ACGTACGTAC5', 'AAAAABBBBB')).toEqual([
    { start: 5, type: 'deletion', length: 10 },
  ])
})

test('MD string with only matches', () => {
  // No mismatches or deletions
  expect(getMismatches('20M', '20', 'ACGTACGTACGTACGTACGT')).toEqual([])
})

test('MD string starting with mismatch', () => {
  // Mismatch at first position (0-length initial match)
  expect(getMismatches('5M', 'T4', 'ATTTT')).toEqual([
    {
      altbase: 'T',
      base: 'A',
      length: 1,
      start: 0,
      type: 'mismatch',
    },
  ])
})

test('MD string ending with mismatch', () => {
  // Mismatch at last position
  expect(getMismatches('5M', '4G', 'TTTTA')).toEqual([
    {
      altbase: 'G',
      base: 'A',
      length: 1,
      start: 4,
      type: 'mismatch',
    },
  ])
})

test('deletion at start', () => {
  // Deletion at beginning
  expect(getMismatches('5D10M', '^ACGTA10', 'TTTTTTTTTT')).toEqual([
    { start: 0, type: 'deletion', length: 5 },
  ])
})

test('deletion at end', () => {
  // Deletion at end
  expect(getMismatches('10M5D', '10^ACGTA', 'TTTTTTTTTT')).toEqual([
    { start: 10, type: 'deletion', length: 5 },
  ])
})

test('complex pattern with insertions, deletions, and mismatches', () => {
  // Real-world complex example
  const complexSeq = 'ACGTACGTACNNACGTACGTACGTACGTACGTAC'
  expect(getMismatches('10M2I5M3D18M', '5T4^GCA2A15', complexSeq)).toEqual([
    {
      start: 10,
      type: 'insertion',
      insertlen: 2,
      insertedBases: 'NN',
      length: 0,
    },
    { start: 15, type: 'deletion', length: 3 },
    {
      altbase: 'T',
      base: 'C',
      length: 1,
      start: 5,
      type: 'mismatch',
      qual: undefined,
    },
    {
      altbase: 'A',
      base: 'G',
      length: 1,
      start: 15,
      type: 'mismatch',
      qual: undefined,
    },
  ])
})

test('multiple skips with mismatches', () => {
  // Multiple N operations (spliced alignment)
  expect(getMismatches('5M100N5M50N5M', '3A1C4A4', 'AAATAACCCCCAAAAA')).toEqual(
    [
      { length: 100, start: 5, type: 'skip' },
      { length: 50, start: 110, type: 'skip' },
      {
        altbase: 'A',
        base: 'T',
        length: 1,
        start: 3,
        type: 'mismatch',
        qual: undefined,
      },
      {
        altbase: 'C',
        base: 'A',
        length: 1,
        start: 105,
        type: 'mismatch',
        qual: undefined,
      },
      {
        altbase: 'A',
        base: 'C',
        length: 1,
        start: 160,
        type: 'mismatch',
        qual: undefined,
      },
    ],
  )
})

test('soft clipping with complex operations', () => {
  // Soft clips with various operations - MD doesn't include clip info
  expect(
    getMismatches(
      '5S10M2I5M3D5M5S',
      '5T4^ACG2A2',
      'SSSSSAAAAATAAAANNAAAAACGSSSSS',
    ),
  ).toEqual([
    {
      cliplen: 5,
      length: 1,
      start: 0,
      type: 'softclip',
    },
    {
      start: 10,
      type: 'insertion',
      insertlen: 2,
      insertedBases: 'NN',
      length: 0,
    },
    { start: 15, type: 'deletion', length: 3 },
    {
      cliplen: 5,
      length: 1,
      start: 23,
      type: 'softclip',
    },
    {
      altbase: 'T',
      base: 'T',
      length: 1,
      start: 5,
      type: 'mismatch',
      qual: undefined,
    },
    {
      altbase: 'A',
      base: 'A',
      length: 1,
      start: 15,
      type: 'mismatch',
      qual: undefined,
    },
  ])
})

test('edge case: empty MD string components', () => {
  // Test with multiple zeros
  expect(getMismatches('10M', '0A0T0G7', 'CTGAAAAAAA')).toEqual([
    {
      altbase: 'A',
      base: 'C',
      length: 1,
      start: 0,
      type: 'mismatch',
    },
    {
      altbase: 'T',
      base: 'T',
      length: 1,
      start: 1,
      type: 'mismatch',
    },
    {
      altbase: 'G',
      base: 'G',
      length: 1,
      start: 2,
      type: 'mismatch',
    },
  ])
})

test('large numbers in MD string', () => {
  // Test parsing of large position numbers
  const longSeq = `${'A'.repeat(1000)}C${'T'.repeat(500)}`
  expect(getMismatches('1501M', '1000G500', longSeq)).toEqual([
    {
      altbase: 'G',
      base: 'C',
      length: 1,
      start: 1000,
      type: 'mismatch',
    },
  ])
})

test('quality scores are passed through to mismatch entries', () => {
  const ops = parseCigar2('10M')
  const seq = 'AAAAATAAAA'
  const qual = new Uint8Array([30, 30, 30, 30, 30, 25, 30, 30, 30, 30])
  const cigarMismatches = cigarToMismatches2(ops, seq, undefined, qual)
  const result = mdToMismatches2('5A4', ops, cigarMismatches, seq, qual)
  expect(result).toEqual([
    {
      start: 5,
      type: 'mismatch',
      base: 'T',
      altbase: 'A',
      length: 1,
      qual: 25,
    },
  ])
})
