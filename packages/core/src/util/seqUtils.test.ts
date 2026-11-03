import { revlist } from './revlist.ts'
import {
  complement,
  complementTable,
  reverse,
  revcom,
  stitch,
} from './seqUtils.ts'

function referenceComplement(str: string) {
  return str
    .split('')
    .map(c => complementTable[c] ?? c)
    .join('')
}

function referenceReverse(str: string) {
  return str.split('').reverse().join('')
}

function asciiSequence(length: number) {
  const alphabet = 'ACGTacgtNnRYrykmKMx-*.'
  let state = 1
  let out = ''
  for (let i = 0; i < length; i++) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0
    out += alphabet[(state >>> 24) % alphabet.length]
  }
  return out
}

function expectMatchesReference(seq: string) {
  expect(complement(seq)).toBe(referenceComplement(seq))
  expect(reverse(seq)).toBe(referenceReverse(seq))
  expect(revcom(seq)).toBe(referenceReverse(referenceComplement(seq)))
}

describe('revcom, reverse and complement', () => {
  test('complement IUPAC codes, keep case, pass other characters through', () => {
    expect(revcom('ACGTN')).toBe('NACGT')
    expect(revcom('aacgR-')).toBe('-Ycgtt')
    expect(complement('ACgtRY*')).toBe('TGcaYR*')
    expect(reverse('ACgt')).toBe('tgCA')
    expect(revcom('')).toBe('')
  })

  test.each([1, 255, 256, 257, 100_000])(
    'matches a reference implementation at length %i',
    length => {
      expectMatchesReference(asciiSequence(length))
    },
  )
})

describe('stitch', () => {
  test('joins slices of a sequence', () => {
    // ATGCCCTTG: slice(0,3)='ATG', slice(6,9)='TTG'
    expect(
      stitch(
        [
          { start: 0, end: 3 },
          { start: 6, end: 9 },
        ],
        'ATGCCCTTG',
      ),
    ).toBe('ATGTTG')
  })

  test('empty subfeatures returns empty string', () => {
    expect(stitch([], 'ATGCCC')).toBe('')
  })
})

describe('revlist', () => {
  test('reverses coordinates relative to seqlen and sorts', () => {
    expect(
      revlist(
        [
          { start: 0, end: 10 },
          { start: 90, end: 100 },
        ],
        100,
      ),
    ).toStrictEqual([
      { start: 0, end: 10 },
      { start: 90, end: 100 },
    ])
  })

  test('transforms coords correctly', () => {
    // seqlen=100: start = 100-30=70, end = 100-20=80
    expect(revlist([{ start: 20, end: 30 }], 100)).toStrictEqual([
      { start: 70, end: 80 },
    ])
  })

  test('preserves extra fields', () => {
    expect(
      revlist([{ start: 20, end: 30, phase: 1, type: 'CDS' }], 100),
    ).toStrictEqual([{ start: 70, end: 80, phase: 1, type: 'CDS' }])
  })
})
