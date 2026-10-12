import { classifyRecord, sortCoordinate } from './sortCoordinate.ts'

// start0 is VCF POS - 1 throughout
describe('sortCoordinate', () => {
  test.each([
    // [label, ref, alts, expected]
    ['SNV', 'G', ['A'], { type: 'basePair', pos: 100 }],
    ['MNV, first base differs', 'AC', ['GT'], { type: 'basePair', pos: 100 }],
    [
      'MNV, second base differs',
      'ACG',
      ['ATT'],
      { type: 'basePair', pos: 101 },
    ],
    ['anchored deletion', 'ACGT', ['A'], { type: 'basePair', pos: 101 }],
    [
      'two-base anchor deletion',
      'ACGT',
      ['AC'],
      { type: 'basePair', pos: 102 },
    ],
    [
      'unanchored (k = 0) deletion',
      'ACGT',
      ['T'],
      { type: 'basePair', pos: 100 },
    ],
    ['anchored insertion', 'A', ['ACCC'], { type: 'insertion', pos: 101 }],
    ['complex', 'ACG', ['ATTTG'], { type: 'basePair', pos: 101 }],
    ['complex, k = 0', 'AC', ['TTT'], { type: 'basePair', pos: 100 }],
  ] as const)('%s', (_label, ref, alts, expected) => {
    expect(sortCoordinate(100, ref, alts)).toEqual(expected)
  })

  test('lower-case alleles compare case-insensitively', () => {
    expect(sortCoordinate(100, 'acgt', ['A'])).toEqual({
      type: 'basePair',
      pos: 101,
    })
    expect(sortCoordinate(100, 'a', ['ACC'])).toEqual({
      type: 'insertion',
      pos: 101,
    })
    // an SNV whose case differs only is still REF == ALT: nothing to sort
    expect(sortCoordinate(100, 'a', ['A'])).toBeUndefined()
  })

  test.each([
    ['symbolic', ['<DEL>'], 'symbolic'],
    ['breakend', ['G]17:198982]'], 'breakend'],
    ['other breakend orientation', ['[13:123456[T'], 'breakend'],
    ['single breakend', ['G.'], 'breakend'],
    ['star', ['*'], 'complex'],
    ['dot', ['.'], 'complex'],
  ] as const)('no sort for %s', (_label, alts, kind) => {
    expect(classifyRecord(100, 'G', alts)).toEqual({ kind, sort: undefined })
  })

  test('multi-allelic takes the leftmost column', () => {
    // SNV at 100 vs deletion's first deleted base at 101
    expect(classifyRecord(100, 'GC', ['AC', 'G'])).toEqual({
      kind: 'complex',
      sort: { type: 'basePair', pos: 100 },
    })
  })

  test('multi-allelic tie prefers basePair over insertion', () => {
    // deletion's first deleted base and insertion's following base are both 101
    expect(classifyRecord(100, 'AC', ['A', 'ATC'])).toEqual({
      kind: 'complex',
      sort: { type: 'basePair', pos: 101 },
    })
    expect(classifyRecord(100, 'AC', ['ATC', 'A']).sort).toEqual({
      type: 'basePair',
      pos: 101,
    })
  })

  test('multi-allelic with a star keeps the real allele', () => {
    expect(classifyRecord(100, 'G', ['*', 'T'])).toEqual({
      kind: 'complex',
      sort: { type: 'basePair', pos: 100 },
    })
  })

  test('multi-allelic of one kind keeps the kind', () => {
    expect(classifyRecord(100, 'G', ['A', 'T']).kind).toBe('snv')
  })

  test('a symbolic ALT beside a sequence ALT still sorts on the sequence', () => {
    expect(classifyRecord(100, 'G', ['<DEL>', 'A'])).toEqual({
      kind: 'symbolic',
      sort: { type: 'basePair', pos: 100 },
    })
  })
})
