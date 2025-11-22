import { cigarToMismatches } from './cigarToMismatches'
import { getMismatches, parseCigar } from './index'
import { mdToMismatches } from './mdToMismatches'
import type { Mismatch } from '../shared/types'

const seq =
  'AAAAAAAAAACAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTT'

// Original implementation from main branch for comparison testing
const mdRegexOriginal = new RegExp(/(\d+|\^[a-z]+|[a-z])/gi)

function mdToMismatchesOriginal(
  mdstring: string,
  ops: string[],
  cigarMismatches: Mismatch[],
  seq: string,
  qual?: Uint8Array,
) {
  let curr: Mismatch = { start: 0, base: '', length: 0, type: 'mismatch' }
  let lastCigar = 0
  let lastTemplateOffset = 0
  let lastRefOffset = 0
  let lastSkipPos = 0
  const mismatchRecords: Mismatch[] = []
  const skips = cigarMismatches.filter(cigar => cigar.type === 'skip')

  function nextRecord(): void {
    mismatchRecords.push(curr)

    curr = {
      start: curr.start + curr.length,
      length: 0,
      base: '',
      type: 'mismatch',
    }
  }

  function getTemplateCoordLocal(refCoord: number): number {
    let templateOffset = lastTemplateOffset
    let refOffset = lastRefOffset
    for (
      let i = lastCigar;
      i < ops.length && refOffset <= refCoord;
      i += 2, lastCigar = i
    ) {
      const len = +ops[i]!
      const op = ops[i + 1]!

      if (op === 'S' || op === 'I') {
        templateOffset += len
      } else if (op === 'D' || op === 'P' || op === 'N') {
        refOffset += len
      } else if (op !== 'H') {
        templateOffset += len
        refOffset += len
      }
    }
    lastTemplateOffset = templateOffset
    lastRefOffset = refOffset

    return templateOffset - (refOffset - refCoord)
  }

  const md = mdstring.match(mdRegexOriginal) || []
  for (const token of md) {
    const num = +token
    if (!Number.isNaN(num)) {
      curr.start += num
    } else if (token.startsWith('^')) {
      curr.start += token.length - 1
    } else {
      // mismatch
      for (let j = 0; j < token.length; j += 1) {
        curr.length = 1

        while (lastSkipPos < skips.length) {
          const mismatch = skips[lastSkipPos]!
          if (curr.start >= mismatch.start) {
            curr.start += mismatch.length
            lastSkipPos++
          } else {
            break
          }
        }
        const s = getTemplateCoordLocal(curr.start)
        curr.base = seq[s] || 'X'
        curr.qual = qual?.[s]
        curr.altbase = token[j]
        nextRecord()
      }
    }
  }
  return mismatchRecords
}

// examples come from
// https://github.com/vsbuffalo/devnotes/wiki/The-MD-Tag-in-BAM-Files and
// http://seqanswers.com/forums/showthread.php?t=8978

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

test('simple deletion', () => {
  // simple deletion
  expect(getMismatches('56M1D45M', '56^A45', seq)).toEqual([
    { start: 56, type: 'deletion', base: '*', length: 1 },
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
  expect(getMismatches('5M2D6M', '5^AC0C5', 'GGGGGATTTTTT')).toEqual([
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
  expect(getMismatches('12M', '5A0C5', 'GGGGGCATTTTT')).toEqual([
    { altbase: 'A', base: 'C', length: 1, start: 5, type: 'mismatch' },
    { altbase: 'C', base: 'A', length: 1, start: 6, type: 'mismatch' },
  ])
})

test('non-0-length-MD string', () => {
  // same as above but with the non-0-length MD string
  // not sure if it is entirely legal, but may appear in the wild
  expect(getMismatches('12M', '5AC5', 'GGGGGCATTTTT')).toEqual([
    { altbase: 'A', base: 'C', length: 1, start: 5, type: 'mismatch' },
    { altbase: 'C', base: 'A', length: 1, start: 6, type: 'mismatch' },
  ])
})

test('basic skip', () => {
  expect(getMismatches('6M200N6M', '5AC5', 'GGGGGCATTTTT')).toEqual([
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
      '89M1I11M',
      '100',
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
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
      '9M1I91M',
      '48T42G8',
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
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
  expect(getMismatches('3M200N3M200N3M', '8A', 'GGGGGCATTTTT')).toEqual([
    { base: 'N', length: 200, start: 3, type: 'skip' },
    { base: 'N', length: 200, start: 206, type: 'skip' },
    { altbase: 'A', base: 'T', length: 1, start: 408, type: 'mismatch' },
  ])
  expect(
    getMismatches('31M1I17M1D37M', '6G4C20G1A5C5A1^C3A15G1G15', seq).sort(
      (a, b) => a.start - b.start,
    ),
  ).toMatchSnapshot()
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

test('multiple consecutive mismatches', () => {
  // SAM spec example: 10A5^AC6 from the spec
  expect(getMismatches('21M', '10A5^AC6', 'ACGTACGTACTTTTTTTTTTTT')).toEqual([
    { altbase: 'A', base: 'T', length: 1, start: 10, type: 'mismatch' },
  ])
})

test('consecutive mismatches with 0-length runs', () => {
  // Multiple mismatches back-to-back
  expect(getMismatches('10M', 'A0T0G0C6', 'CATGCCCCCC')).toEqual([
    { altbase: 'A', base: 'C', length: 1, start: 0, type: 'mismatch' },
    { altbase: 'T', base: 'A', length: 1, start: 1, type: 'mismatch' },
    { altbase: 'G', base: 'T', length: 1, start: 2, type: 'mismatch' },
    { altbase: 'C', base: 'G', length: 1, start: 3, type: 'mismatch' },
  ])
})

test('long deletion', () => {
  // Multiple base deletion
  expect(getMismatches('5M10D5M', '5^ACGTACGTAC5', 'AAAAABBBBB')).toEqual([
    { start: 5, type: 'deletion', base: '*', length: 10 },
  ])
})

test('MD string with only matches', () => {
  // No mismatches or deletions
  expect(getMismatches('20M', '20', 'ACGTACGTACGTACGTACGT')).toEqual([])
})

test('MD string starting with mismatch', () => {
  // Mismatch at first position (0-length initial match)
  expect(getMismatches('5M', 'T4', 'ATTTT')).toEqual([
    { altbase: 'T', base: 'A', length: 1, start: 0, type: 'mismatch' },
  ])
})

test('MD string ending with mismatch', () => {
  // Mismatch at last position
  expect(getMismatches('5M', '4G', 'TTTTA')).toEqual([
    { altbase: 'G', base: 'A', length: 1, start: 4, type: 'mismatch' },
  ])
})

test('deletion at start', () => {
  // Deletion at beginning
  expect(getMismatches('5D10M', '^ACGTA10', 'TTTTTTTTTT')).toEqual([
    { start: 0, type: 'deletion', base: '*', length: 5 },
  ])
})

test('deletion at end', () => {
  // Deletion at end
  expect(getMismatches('10M5D', '10^ACGTA', 'TTTTTTTTTT')).toEqual([
    { start: 10, type: 'deletion', base: '*', length: 5 },
  ])
})

test('complex pattern with insertions, deletions, and mismatches', () => {
  // Real-world complex example
  const complexSeq = 'ACGTACGTACNNACGTACGTACGTACGTACGTAC'
  expect(
    getMismatches('10M2I5M3D18M', '5T4^GCA2A15', complexSeq),
  ).toEqual([
    { start: 10, type: 'insertion', base: '2', insertedBases: 'NN', length: 0 },
    { start: 15, type: 'deletion', base: '*', length: 3 },
    { altbase: 'T', base: 'C', length: 1, start: 5, type: 'mismatch', qual: undefined },
    { altbase: 'A', base: 'G', length: 1, start: 15, type: 'mismatch', qual: undefined },
  ])
})

test('multiple skips with mismatches', () => {
  // Multiple N operations (spliced alignment)
  expect(
    getMismatches('5M100N5M50N5M', '3A1C4A4', 'AAATAACCCCCAAAAA'),
  ).toEqual([
    { base: 'N', length: 100, start: 5, type: 'skip' },
    { base: 'N', length: 50, start: 110, type: 'skip' },
    { altbase: 'A', base: 'T', length: 1, start: 3, type: 'mismatch', qual: undefined },
    { altbase: 'C', base: 'A', length: 1, start: 105, type: 'mismatch', qual: undefined },
    { altbase: 'A', base: 'C', length: 1, start: 160, type: 'mismatch', qual: undefined },
  ])
})

test('soft clipping with complex operations', () => {
  // Soft clips with various operations - MD doesn't include clip info
  expect(
    getMismatches('5S10M2I5M3D5M5S', '5T4^ACG2A2', 'SSSSSAAAAATAAAANNAAAAACGSSSSS'),
  ).toEqual([
    { cliplen: 5, base: 'S5', length: 1, start: 0, type: 'softclip' },
    { start: 10, type: 'insertion', base: '2', insertedBases: 'NN', length: 0 },
    { start: 15, type: 'deletion', base: '*', length: 3 },
    { cliplen: 5, base: 'S5', length: 1, start: 23, type: 'softclip' },
    { altbase: 'T', base: 'T', length: 1, start: 5, type: 'mismatch', qual: undefined },
    { altbase: 'A', base: 'A', length: 1, start: 15, type: 'mismatch', qual: undefined },
  ])
})

test('edge case: empty MD string components', () => {
  // Test with multiple zeros
  expect(getMismatches('10M', '0A0T0G7', 'CTGAAAAAAA')).toEqual([
    { altbase: 'A', base: 'C', length: 1, start: 0, type: 'mismatch' },
    { altbase: 'T', base: 'T', length: 1, start: 1, type: 'mismatch' },
    { altbase: 'G', base: 'G', length: 1, start: 2, type: 'mismatch' },
  ])
})

test('large numbers in MD string', () => {
  // Test parsing of large position numbers
  const longSeq = 'A'.repeat(1000) + 'C' + 'T'.repeat(500)
  expect(getMismatches('1501M', '1000G500', longSeq)).toEqual([
    { altbase: 'G', base: 'C', length: 1, start: 1000, type: 'mismatch' },
  ])
})

describe('compatibility: new implementation vs original', () => {
  // Test cases to ensure new optimized implementation matches original
  const testCases = [
    {
      name: 'simple mismatch',
      cigar: '100M',
      md: '10A80',
      seq: 'AAAAAAAAAACAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTT',
    },
    {
      name: 'deletion',
      cigar: '56M1D45M',
      md: '56^A45',
      seq: 'AAAAAAAAAACAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTT',
    },
    {
      name: 'deletion and SNP',
      cigar: '5M2D6M',
      md: '5^AC0C5',
      seq: 'GGGGGATTTTTT',
    },
    {
      name: 'consecutive mismatches',
      cigar: '12M',
      md: '5A0C5',
      seq: 'GGGGGCATTTTT',
    },
    {
      name: 'basic skip',
      cigar: '6M200N6M',
      md: '5AC5',
      seq: 'GGGGGCATTTTT',
    },
    {
      name: 'multiple skips',
      cigar: '3M200N3M200N3M',
      md: '8A',
      seq: 'GGGGGCATTTTT',
    },
    {
      name: 'insertion',
      cigar: '89M1I11M',
      md: '100',
      seq: 'AAAAAAAAAACAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTTA',
    },
    {
      name: 'complex with insertion and mismatches',
      cigar: '9M1I91M',
      md: '48T42G8',
      seq: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    {
      name: 'very complex',
      cigar: '31M1I17M1D37M',
      md: '6G4C20G1A5C5A1^C3A15G1G15',
      seq,
    },
    {
      name: 'soft clipping',
      cigar: '10S10M10S',
      md: '9A',
      seq: 'AAAAAAAAAAGGGGGGGGGC',
    },
    {
      name: 'hard clipping',
      cigar: '200H10M200H',
      md: '9A',
      seq: 'AAAAAAAAAC',
    },
    {
      name: 'long deletion',
      cigar: '5M10D5M',
      md: '5^ACGTACGTAC5',
      seq: 'AAAAABBBBB',
    },
    {
      name: 'mismatch at start',
      cigar: '5M',
      md: 'T4',
      seq: 'ATTTT',
    },
    {
      name: 'mismatch at end',
      cigar: '5M',
      md: '4G',
      seq: 'TTTTA',
    },
    {
      name: 'deletion at start',
      cigar: '5D10M',
      md: '^ACGTA10',
      seq: 'TTTTTTTTTT',
    },
    {
      name: 'deletion at end',
      cigar: '10M5D',
      md: '10^ACGTA',
      seq: 'TTTTTTTTTT',
    },
    {
      name: 'multiple zeros',
      cigar: '10M',
      md: '0A0T0G7',
      seq: 'CTGAAAAAAA',
    },
    {
      name: 'complex insertions deletions mismatches',
      cigar: '10M2I5M3D18M',
      md: '5T4^GCA2A15',
      seq: 'ACGTACGTACNNACGTACGTACGTACGTACGTAC',
    },
    {
      name: 'multiple skips with mismatches',
      cigar: '5M100N5M50N5M',
      md: '3A1C4A4',
      seq: 'AAATAACCCCCAAAAA',
    },
  ]

  testCases.forEach(({ name, cigar, md, seq }) => {
    test(name, () => {
      const ops = parseCigar(cigar)
      const cigarMismatches = cigarToMismatches(ops, seq)

      const resultNew = mdToMismatches(md, ops, cigarMismatches, seq)
      const resultOld = mdToMismatchesOriginal(md, ops, cigarMismatches, seq)

      // Sort both results by start position for consistent comparison
      const sortFn = (a: Mismatch, b: Mismatch) => a.start - b.start
      resultNew.sort(sortFn)
      resultOld.sort(sortFn)

      expect(resultNew).toEqual(resultOld)
    })
  })

  test('with quality scores', () => {
    const cigar = '10M'
    const md = '5A4'
    const testSeq = 'AAAAATAAAA'
    const qual = new Uint8Array([30, 30, 30, 30, 30, 25, 30, 30, 30, 30])

    const ops = parseCigar(cigar)
    const cigarMismatches = cigarToMismatches(ops, testSeq)

    const resultNew = mdToMismatches(md, ops, cigarMismatches, testSeq, qual)
    const resultOld = mdToMismatchesOriginal(md, ops, cigarMismatches, testSeq, qual)

    expect(resultNew).toEqual(resultOld)
  })

  test('empty MD string (all matches)', () => {
    const cigar = '20M'
    const md = '20'
    const testSeq = 'ACGTACGTACGTACGTACGT'

    const ops = parseCigar(cigar)
    const cigarMismatches = cigarToMismatches(ops, testSeq)

    const resultNew = mdToMismatches(md, ops, cigarMismatches, testSeq)
    const resultOld = mdToMismatchesOriginal(md, ops, cigarMismatches, testSeq)

    expect(resultNew).toEqual(resultOld)
  })
})
