import { describe, expect, it, test } from 'vitest'

import { cigarToMismatches } from './cigarToMismatches'
import { getMismatches, parseCigar } from './index'
import { mdToMismatches } from './mdToMismatches'

describe('parseCigar', () => {
  it('handles empty string', () => {
    expect(parseCigar('')).toEqual([])
  })

  it('handles simple CIGAR strings', () => {
    expect(parseCigar('10M')).toEqual(['10', 'M'])
    expect(parseCigar('5M2I3M')).toEqual(['5', 'M', '2', 'I', '3', 'M'])
    expect(parseCigar('100M')).toEqual(['100', 'M'])
  })

  it('handles complex CIGAR strings', () => {
    expect(parseCigar('5M2D6M')).toEqual(['5', 'M', '2', 'D', '6', 'M'])
    expect(parseCigar('56M1D45M')).toEqual(['56', 'M', '1', 'D', '45', 'M'])
    expect(parseCigar('89M1I11M')).toEqual(['89', 'M', '1', 'I', '11', 'M'])
  })

  it('handles CIGAR strings with clipping', () => {
    expect(parseCigar('10S10M10S')).toEqual(['10', 'S', '10', 'M', '10', 'S'])
    expect(parseCigar('200H10M200H')).toEqual([
      '200',
      'H',
      '10',
      'M',
      '200',
      'H',
    ])
  })

  it('handles CIGAR strings with skips', () => {
    expect(parseCigar('6M200N6M')).toEqual(['6', 'M', '200', 'N', '6', 'M'])
    expect(parseCigar('3M200N3M200N3M')).toEqual([
      '3',
      'M',
      '200',
      'N',
      '3',
      'M',
      '200',
      'N',
      '3',
      'M',
    ])
  })

  it('handles all CIGAR operations', () => {
    expect(parseCigar('10M5I2D3S4H1N2P3X4=')).toEqual([
      '10',
      'M',
      '5',
      'I',
      '2',
      'D',
      '3',
      'S',
      '4',
      'H',
      '1',
      'N',
      '2',
      'P',
      '3',
      'X',
      '4',
      '=',
    ])
  })
})

const seq =
  'AAAAAAAAAACAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTT'

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

describe('get mismatches', () => {
  it('simple deletion', () => {
    // simple deletion
    expect(getMismatches('56M1D45M', '56^A45', seq)).toEqual([
      { start: 56, type: 'deletion', base: '*', length: 1 },
    ])
  })

  it('simple insertion', () => {
    // simple insertion
    expect(
      getMismatches(
        '89M1I11M',
        '100',
        'AAAAAAAAAACAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTTA',
      ),
    ).toEqual([{ start: 89, type: 'insertion', base: '1', length: 0 }])
  })

  it('deletion and a SNP', () => {
    // contains a deletion and a SNP
    // read GGGGG--ATTTTTT
    //      |||||   ||||||
    //      GGGGGACCTTTTTT
    expect(getMismatches('5M2D6M', '5^AC0C5', 'GGGGGATTTTTT')).toEqual([
      { start: 5, type: 'deletion', base: '*', length: 2 },
      { start: 7, type: 'mismatch', base: 'A', altbase: 'C', length: 1 },
    ])
  })

  it('0-length MD entries', () => {
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

  it('non-0-length-MD string', () => {
    // same as above but with the non-0-length MD string
    // not sure if it is entirely legal, but may appear in the wild
    expect(getMismatches('12M', '5AC5', 'GGGGGCATTTTT')).toEqual([
      { altbase: 'A', base: 'C', length: 1, start: 5, type: 'mismatch' },
      { altbase: 'C', base: 'A', length: 1, start: 6, type: 'mismatch' },
    ])
  })
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
  ).toEqual([{ base: '1', length: 0, start: 89, type: 'insertion' }])

  // https://github.com/vsbuffalo/devnotes/wiki/The-MD-Tag-in-BAM-Files
  // example 2
  expect(
    getMismatches(
      '9M1I91M',
      '48T42G8',
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    ),
  ).toEqual([
    { base: '1', length: 0, start: 9, type: 'insertion' },
    {
      altbase: 'T',
      base: 'A',
      length: 1,
      start: 48,
      type: 'mismatch',
    },
    {
      altbase: 'G',
      base: 'A',
      length: 1,
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
