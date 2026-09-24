import {
  formatEndLocation,
  formatLocationRange,
  formatStartLocation,
  toNavLocString,
} from './locStrings.ts'

// The whole point of these helpers is the 0-based half-open -> 1-based inclusive
// conversion, which is asymmetric: a `start` gains 1, an `end` does not. Pin
// both sides against one interval so a "simplification" that treats them alike
// fails here rather than silently shifting every location the plugin prints.
describe('0-based half-open in, 1-based inclusive out', () => {
  // [1000, 1100) covers 1-based 1001..1100 — 100 bases
  test('start converts, end does not', () => {
    expect(formatStartLocation('chr1', 1000)).toBe('chr1:1,001')
    expect(formatEndLocation('chr1', 1100)).toBe('chr1:1,100')
    expect(formatLocationRange('chr1', 1000, 1100)).toBe('chr1:1,001-1,100')
  })

  test('a range spans exactly end - start bases', () => {
    expect(formatLocationRange('chr1', 0, 100)).toBe('chr1:1-100')
    expect(formatLocationRange('chr1', 0, 1)).toBe('chr1:1-1')
  })

  // A range's two ends are the same positions the single-position helpers
  // print, so a panel that shows one junction can't disagree with one that
  // shows the whole span.
  test('the range endpoints agree with the single-position helpers', () => {
    expect(formatLocationRange('ctgA', 7, 42)).toBe('ctgA:8-42')
    expect(formatStartLocation('ctgA', 7)).toBe('ctgA:8')
    expect(formatEndLocation('ctgA', 42)).toBe('ctgA:42')
  })
})

describe('toNavLocString', () => {
  // Same range formatLocationRange prints, minus the thousands separators a
  // locstring parser would have to strip.
  test('unpadded matches the displayed range', () => {
    expect(toNavLocString('chr1', 1000, 1100)).toBe('chr1:1001-1100')
  })

  test('padding widens both sides', () => {
    expect(toNavLocString('chr1', 1000, 1100, 20)).toBe('chr1:981-1120')
  })

  test('padded start clamps to 1', () => {
    expect(toNavLocString('chr1', 4, 104, 20)).toBe('chr1:1-124')
  })
})
