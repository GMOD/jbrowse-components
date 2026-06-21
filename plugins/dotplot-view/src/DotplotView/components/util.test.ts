import { makeContentBlock } from '@jbrowse/core/util/blockTypes'

import { getBlockLabelKeysToHide, pxWidthForBlocks } from './util.ts'

function block(refName: string, end: number, key = refName) {
  return makeContentBlock({
    key,
    offsetPx: 0,
    widthPx: 100,
    assemblyName: 'a',
    refName,
    start: 0,
    end,
  })
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

describe('pxWidthForBlocks', () => {
  test('returns max label width across refName and tick string', () => {
    const result = pxWidthForBlocks({
      blocks: [block('chr1', 1_000_000)],
      bpPerPx: 1,
      hide: new Set(),
    })
    expect(result).toBeGreaterThan(0)
  })

  test('hidden blocks do not contribute width', () => {
    const all = pxWidthForBlocks({
      blocks: [block('chr1', 1_000), block('verylongname123', 1_000)],
      bpPerPx: 1,
      hide: new Set(),
    })
    const hidden = pxWidthForBlocks({
      blocks: [block('chr1', 1_000), block('verylongname123', 1_000)],
      bpPerPx: 1,
      hide: new Set(['verylongname123']),
    })
    expect(hidden).toBeLessThan(all)
  })

  // Locks in correct axis<->bpPerPx pairing — a regression of the swap bug
  // (calling with the *other* axis's bpPerPx) would change the result here.
  test('bpPerPx changes tick-label precision and so the result', () => {
    const fine = pxWidthForBlocks({
      blocks: [block('chr1', 1_234_567)],
      bpPerPx: 1,
      hide: new Set(),
    })
    const coarse = pxWidthForBlocks({
      blocks: [block('chr1', 1_234_567)],
      bpPerPx: 1_000_000,
      hide: new Set(),
    })
    // "1,234,567" (bpPerPx=1) is a wider tick label than "1 Mb" (bpPerPx=1e6).
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
