import {
  filterSuccessiveElementsWithSameStartAndEndCoord,
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
