import { makeContentBlock } from '@jbrowse/core/util/blockTypes'

import { axisLabelWidthPx, getBlockLabelKeysToHide } from './util.ts'

function region(refName: string, end: number) {
  return { refName, end }
}

// label position along the axis is `round(length - offsetPx + viewOffsetPx)`;
// each label occupies the 12px ending at that position.
function posBlock(key: string, offsetPx: number, len: number) {
  return makeContentBlock({
    key,
    offsetPx,
    widthPx: 100,
    assemblyName: 'a',
    refName: key,
    start: 0,
    end: len,
  })
}

describe('axisLabelWidthPx', () => {
  test('returns max label width across refName and tick string', () => {
    expect(axisLabelWidthPx([region('chr1', 1_000_000)], 1)).toBeGreaterThan(0)
  })

  test('empty regions yield zero (no border-independent input)', () => {
    expect(axisLabelWidthPx([], 1)).toBe(0)
  })

  test('the widest region label wins', () => {
    const short = axisLabelWidthPx([region('chr1', 1_000)], 1)
    const long = axisLabelWidthPx(
      [region('chr1', 1_000), region('verylongname123', 1_000)],
      1,
    )
    expect(long).toBeGreaterThan(short)
  })

  test('bpPerPx changes tick-label precision and so the result', () => {
    // "1,234,567" (bpPerPx=1) is a wider tick label than "1.23M" (bpPerPx=1e6).
    const fine = axisLabelWidthPx([region('chr1', 1_234_567)], 1)
    const coarse = axisLabelWidthPx([region('chr1', 1_234_567)], 1_000_000)
    expect(fine).toBeGreaterThan(coarse)
  })
})

describe('getBlockLabelKeysToHide', () => {
  test('well-separated labels are all kept', () => {
    const hide = getBlockLabelKeysToHide(
      [posBlock('a', 0, 200), posBlock('b', 400, 100)],
      600,
      0,
    )
    expect([...hide]).toEqual([])
  })

  test('a label overlapping a higher-priority (larger) one is hidden', () => {
    // a (len 200) at offsetPx 0 → pos 600, occupies [588,600)
    // b (len 100) at offsetPx 8 → pos 592, occupies [580,592), overlaps a
    const hide = getBlockLabelKeysToHide(
      [posBlock('a', 0, 200), posBlock('b', 8, 100)],
      600,
      0,
    )
    expect([...hide]).toEqual(['b'])
  })

  test('priority is by block length, independent of input order', () => {
    // smaller block listed first, but the larger one wins the slot
    const hide = getBlockLabelKeysToHide(
      [posBlock('small', 8, 100), posBlock('big', 0, 200)],
      600,
      0,
    )
    expect([...hide]).toEqual(['small'])
  })

  test('a label exactly at position 0 is hidden', () => {
    const hide = getBlockLabelKeysToHide([posBlock('a', 600, 100)], 600, 0)
    expect([...hide]).toEqual(['a'])
  })

  test('a label scrolled to a negative position is kept and blocks nothing', () => {
    // a is off-axis (pos -100) so it is kept and does not occupy any slot,
    // leaving b free to render
    const hide = getBlockLabelKeysToHide(
      [posBlock('a', 700, 200), posBlock('b', 0, 100)],
      600,
      0,
    )
    expect([...hide]).toEqual([])
  })

  test('viewOffsetPx shifts label positions', () => {
    // with viewOffsetPx=100, a at offsetPx 700 → pos 0 → hidden
    const hide = getBlockLabelKeysToHide([posBlock('a', 700, 100)], 600, 100)
    expect([...hide]).toEqual(['a'])
  })
})
