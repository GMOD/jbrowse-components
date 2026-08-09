import { getBpDisplayStr, getTickDisplayStr, parseBpString } from './bpUtils.ts'

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

describe('parseBpString', () => {
  test.each([
    ['0', 0],
    ['150', 150],
    ['1,500', 1500],
    ['1,000,000', 1_000_000],
    ['-200', -200],
    // metric suffixes, with and without the trailing "b", in either case
    ['1k', 1_000],
    ['1kb', 1_000],
    ['1Kb', 1_000],
    ['34M', 34_000_000],
    ['34Mb', 34_000_000],
    ['34mb', 34_000_000],
    ['2G', 2_000_000_000],
    ['2gb', 2_000_000_000],
    // decimals are allowed when a unit carries them
    ['1.5kb', 1_500],
    ['0.5M', 500_000],
    ['1.5M', 1_500_000],
    ['-1.5M', -1_500_000],
    // and the scaled value is rounded, since a coordinate is whole bases
    ['1.0000001M', 1_000_000],
    ['1.9999k', 2000],
    // the spellings getBpDisplayStr prints, which the UI shows for a window
    // size and a user may well type back into a bp field
    ['999bp', 999],
    ['1000bp', 1000],
    ['1Kbp', 1_000],
    ['1.5Kbp', 1_500],
    ['1.5Mbp', 1_500_000],
    ['3,090Mbp', 3_090_000_000],
  ])('%p -> %p', (str, expected) => {
    expect(parseBpString(str)).toBe(expected)
  })

  test.each([
    0, 1, 999, 1000, 1500, 999_499, 999_500, 1_000_000, 1_500_000,
    3_088_269_832,
  ])('everything getBpDisplayStr prints for %p parses back', total => {
    const parsed = parseBpString(getBpDisplayStr(total))
    expect(parsed).toBeDefined()
    // it is the spelling that round-trips, not the exact value: the printed
    // form is rounded to 3 significant digits, so allow that much drift
    expect(Math.abs(parsed! - total)).toBeLessThanOrEqual(total * 0.005 + 1)
  })

  test.each([
    // a bare decimal is not a coordinate, and must not silently truncate
    '1.5',
    '1.5.5',
    '',
    'abc',
    '1kbb',
    '1mm',
    '1k5',
    'M',
    '1e6',
    '0x10',
    'Infinity',
    // the loosened unit tail stops at "bp" and does not admit a bare "p"
    '1p',
    '1Kp',
    '1bpp',
    'bp',
    // a bare decimal is still one, whatever unit tail follows it
    '1.5bp',
    // a range is not a single quantity
    '1-2',
  ])('%p is not a bp quantity', str => {
    expect(parseBpString(str)).toBeUndefined()
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
