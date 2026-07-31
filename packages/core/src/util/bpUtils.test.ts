import { getBpDisplayStr, getTickDisplayStr } from './bpUtils.ts'

describe('getBpDisplayStr', () => {
  test.each([
    [0, '0bp'],
    [999, '999bp'],
    [1000, '1Kbp'],
    [1500, '1.5Kbp'],
    [999_499, '999Kbp'],
    // 3-significant-digit rounding pushes these to 1000, which belongs in the
    // next unit up rather than reading as "1,000Kbp"
    [999_500, '1Mbp'],
    [999_999, '1Mbp'],
    [1_000_000, '1Mbp'],
    [1_500_000, '1.5Mbp'],
    [3_088_269_832, '3,090Mbp'],
  ])('%p -> %p', (total, expected) => {
    expect(getBpDisplayStr(total)).toBe(expected)
  })
})

describe('getTickDisplayStr', () => {
  test('groups the integer part of a fractional megabase tick', () => {
    expect(getTickDisplayStr(3_088_269_832, 1e6)).toBe('3,088.27M')
  })

  test('floors to whole bp below the megabase threshold', () => {
    expect(getTickDisplayStr(1_234_567, 100)).toBe('1,234,567')
  })
})
