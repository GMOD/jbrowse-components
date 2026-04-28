import { getClip } from './getClip.ts'

describe('getClip', () => {
  test('soft clip at CIGAR start, forward strand', () => {
    expect(getClip('5S5M', 1)).toBe(5)
  })
  test('soft clip at CIGAR end is not the start of a forward-strand read', () => {
    expect(getClip('5M5S', 1)).toBe(0)
  })
  test('soft clip at CIGAR end, reverse strand', () => {
    expect(getClip('5M5S', -1)).toBe(5)
  })
  test('soft clip at CIGAR start is not the start of a reverse-strand read', () => {
    expect(getClip('5S5M', -1)).toBe(0)
  })
  test('hard clip at CIGAR start, forward strand', () => {
    expect(getClip('3H5M', 1)).toBe(3)
  })
  test('hard clip at CIGAR end, reverse strand', () => {
    expect(getClip('5M3H', -1)).toBe(3)
  })
  test('no clip returns 0', () => {
    expect(getClip('10M', 1)).toBe(0)
    expect(getClip('10M', -1)).toBe(0)
  })
})
