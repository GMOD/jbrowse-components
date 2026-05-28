import { revlist, stitch } from './seqUtils.ts'

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
