import { makeContentBlock } from '@jbrowse/core/util/blockTypes'

import { pxWidthForBlocks } from './util.ts'

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
