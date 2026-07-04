import { pafIdentity } from './util.ts'

describe('pafIdentity', () => {
  test('prefers de:f: tag (1 - de)', () => {
    expect(
      pafIdentity({ de: 0.02, numMatches: 50, blockLen: 100 }),
    ).toBeCloseTo(0.98)
  })

  test('falls back to id:f: (fraction)', () => {
    expect(pafIdentity({ id: 0.95, numMatches: 50, blockLen: 100 })).toBe(0.95)
  })

  test('falls back to id:f: as percentage', () => {
    expect(pafIdentity({ id: 95, numMatches: 50, blockLen: 100 })).toBe(0.95)
  })

  test('falls back to numMatches/blockLen', () => {
    expect(pafIdentity({ numMatches: 95, blockLen: 100 })).toBe(0.95)
  })

  test('returns 0 when blockLen is missing', () => {
    expect(pafIdentity({})).toBe(0)
  })

  test('ignores invalid de values', () => {
    expect(pafIdentity({ de: 2, numMatches: 90, blockLen: 100 })).toBe(0.9)
  })
})
