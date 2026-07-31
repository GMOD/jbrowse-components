import { getTraMate, parseFiniteNumber } from './util.ts'

describe('parseFiniteNumber', () => {
  test('coerces numeric strings and numbers', () => {
    expect(parseFiniteNumber('5')).toBe(5)
    expect(parseFiniteNumber(-100)).toBe(-100)
    expect(parseFiniteNumber('1e3')).toBe(1000)
  })

  test('rejects the empty-ish values Number() would call 0', () => {
    // '.' parses to undefined, which a snapshot round-trip hands back as null
    expect(parseFiniteNumber(undefined)).toBeUndefined()
    expect(parseFiniteNumber(null)).toBeUndefined()
    expect(parseFiniteNumber('')).toBeUndefined()
  })

  test('rejects non-numeric values', () => {
    expect(parseFiniteNumber('.')).toBeUndefined()
    expect(parseFiniteNumber('chr1')).toBeUndefined()
    expect(parseFiniteNumber(Number.POSITIVE_INFINITY)).toBeUndefined()
  })
})

describe('getTraMate', () => {
  test('names the mate breakpoint from CHR2/END', () => {
    expect(getTraMate({ CHR2: ['ctgB'], END: [1000] })).toBe('ctgB:1,000')
  })

  test('a missing END names no mate rather than position 0', () => {
    expect(getTraMate({ CHR2: ['ctgB'], END: [null] })).toBeUndefined()
    expect(getTraMate({ CHR2: ['ctgB'] })).toBeUndefined()
    expect(getTraMate(undefined)).toBeUndefined()
  })
})
