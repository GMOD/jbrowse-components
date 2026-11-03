import { getStrandStr } from './util.ts'

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
