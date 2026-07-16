import {
  filterSuccessiveElementsWithSameStartAndEndCoord,
  formatSubfeatures,
  getStrandStr,
} from './util.tsx'

import type { Feat } from './util.tsx'

describe('filterSuccessiveElementsWithSameStartAndEndCoord', () => {
  test('removes immediately successive duplicates', () => {
    const input: Feat[] = [
      { start: 10, end: 20 },
      { start: 10, end: 20 },
      { start: 30, end: 40 },
    ]
    expect(
      filterSuccessiveElementsWithSameStartAndEndCoord(input),
    ).toStrictEqual([
      { start: 10, end: 20 },
      { start: 30, end: 40 },
    ])
  })

  test('keeps non-successive duplicates', () => {
    const input: Feat[] = [
      { start: 10, end: 20 },
      { start: 30, end: 40 },
      { start: 10, end: 20 },
    ]
    expect(
      filterSuccessiveElementsWithSameStartAndEndCoord(input),
    ).toHaveLength(3)
  })

  test('empty list returns empty list', () => {
    expect(filterSuccessiveElementsWithSameStartAndEndCoord([])).toStrictEqual(
      [],
    )
  })
})

describe('getStrandStr', () => {
  test('plus strand', () => {
    expect(getStrandStr(1)).toBe('(+)')
  })
  test('minus strand', () => {
    expect(getStrandStr(-1)).toBe('(-)')
  })
  test('no strand (0)', () => {
    expect(getStrandStr(0)).toBe('')
  })
  test('undefined strand', () => {
    expect(getStrandStr(undefined)).toBe('')
  })
})

describe('formatSubfeatures', () => {
  test('calls parse on each subfeature within depth', () => {
    const parsed: Record<string, unknown>[] = []
    const feat = {
      start: 0,
      end: 100,
      subfeatures: [
        { start: 10, end: 30 },
        { start: 50, end: 70 },
      ],
    }
    formatSubfeatures(feat, 1, sub => {
      parsed.push(sub)
    })
    expect(parsed).toHaveLength(2)
  })

  test('does not recurse beyond depth limit', () => {
    const parsed: Record<string, unknown>[] = []
    const feat = {
      start: 0,
      end: 100,
      subfeatures: [
        {
          start: 10,
          end: 30,
          subfeatures: [{ start: 15, end: 25 }],
        },
      ],
    }
    formatSubfeatures(feat, 1, sub => {
      parsed.push(sub)
    })
    // depth=1 means only immediate subfeatures are parsed, not nested ones
    expect(parsed).toHaveLength(1)
  })

  test('handles features with no subfeatures', () => {
    const parsed: Record<string, unknown>[] = []
    formatSubfeatures({ start: 0, end: 100 }, 1, sub => {
      parsed.push(sub)
    })
    expect(parsed).toHaveLength(0)
  })
})
