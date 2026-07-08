import { makeContentBlock } from '@jbrowse/core/util/blockTypes'

import {
  axisBorderPx,
  getBlockLabelKeysToHide,
  truncateRefName,
} from './util.ts'

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

describe('truncateRefName', () => {
  test('short names pass through unchanged', () => {
    expect(truncateRefName('chr1')).toBe('chr1')
    expect(truncateRefName('scaffold9')).toBe('scaffold9')
  })

  test('long names are middle-elided, keeping prefix and suffix', () => {
    expect(truncateRefName('scaffold_1234')).toBe('scaf…1234')
  })
})

describe('axisBorderPx', () => {
  test('empty regions fall back to the minimum border', () => {
    expect(axisBorderPx([], 1)).toBe(50)
  })

  test('the widest region label drives the border', () => {
    const short = axisBorderPx([region('chr1', 1_000)], 1)
    const long = axisBorderPx(
      [region('chr1', 1_000), region('a_long_scaffold_name', 1_000)],
      1,
    )
    expect(long).toBeGreaterThan(short)
  })

  test('a truncated long name does not grow the border without bound', () => {
    // both names truncate to the same 9-char display, so the border matches
    expect(axisBorderPx([region('scaffold_1234', 1_000)], 1)).toBe(
      axisBorderPx([region('scaffold_9999', 1_000)], 1),
    )
  })

  test('bpPerPx changes tick-label precision and so the border', () => {
    // "1,234,567" (bpPerPx=1) is a wider tick than "1.23M" (bpPerPx=1e6)
    const fine = axisBorderPx([region('chr1', 1_234_567)], 1)
    const coarse = axisBorderPx([region('chr1', 1_234_567)], 1_000_000)
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
