import {
  assembleLocString,
  assembleLocStringRaw,
  parseLocString,
} from './locString.ts'
import {
  getNumberGrouping,
  setNumberGrouping,
  toLocale,
} from './numericUtils.ts'

const region = { refName: 'chr1', start: 1234566, end: 1235000 }
const validRefName = (refName: string) => refName === 'chr1'

afterEach(() => {
  setNumberGrouping(true)
})

describe('numberGrouping preference', () => {
  test('grouping on by default', () => {
    expect(getNumberGrouping()).toBe(true)
    expect(toLocale(1234567)).toBe('1,234,567')
    expect(assembleLocString(region)).toBe('chr1:1,234,567..1,235,000')
  })

  test('grouping off renders numbers bare', () => {
    setNumberGrouping(false)
    expect(toLocale(1234567)).toBe('1234567')
    expect(assembleLocString(region)).toBe('chr1:1234567..1235000')
  })

  test('negative numbers follow the preference', () => {
    expect(toLocale(-1234567)).toBe('-1,234,567')
    setNumberGrouping(false)
    expect(toLocale(-1234567)).toBe('-1234567')
  })

  // The reason assembleLocStringRaw exists: block keys, dedup buckets and
  // machine-parsed locStrings must not shift when a user flips a display
  // preference, or cached entries stop matching freshly built ones.
  test('raw locStrings never follow the display preference', () => {
    const grouped = assembleLocStringRaw(region)
    setNumberGrouping(false)
    expect(assembleLocStringRaw(region)).toBe(grouped)
    expect(grouped).toBe('chr1:1234567..1235000')
  })

  // a copied coordinate has to survive being pasted back into the search box
  // under either setting
  test.each([true, false])(
    'display locStrings round-trip through parseLocString (grouping=%s)',
    grouping => {
      setNumberGrouping(grouping)
      const parsed = parseLocString(assembleLocString(region), validRefName)
      expect(parsed.start).toBe(region.start)
      expect(parsed.end).toBe(region.end)
      expect(parsed.refName).toBe(region.refName)
    },
  )
})
