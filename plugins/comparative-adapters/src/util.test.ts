import { parseBed, resolveCoarseTier } from './util.ts'

describe('parseBed', () => {
  test('reads a scored, stranded row', () => {
    expect(parseBed('chr1\t10\t20\tgene1\t55\t-').get('gene1')).toEqual({
      refName: 'chr1',
      start: 10,
      end: 20,
      name: 'gene1',
      score: 55,
      strand: -1,
    })
  })

  // BED's missing-score sentinel; `+'.'` made this NaN on the feature
  test('reads a `.` score as 0', () => {
    expect(parseBed('chr1\t10\t20\tgene1\t.\t+').get('gene1')?.score).toBe(0)
  })

  test('reads a row with no score column as 0', () => {
    expect(parseBed('chr1\t10\t20\tgene1').get('gene1')?.score).toBe(0)
  })
})

// The tier chooser for the all-vs-all indexed adapter (PairwiseIndexedPAFAdapter
// has its own twin, pickPifPrefix, tested alongside it). The adapter honors a
// tier it is handed and nothing more — the zoom-based 'auto' decision lives in
// resolveLodTier on the main thread, where it can reach the fetch cache key.
describe('resolveCoarseTier', () => {
  test('reads the coarse tier when asked for it', () => {
    expect(resolveCoarseTier({ hasCoarseTier: true, lodMode: 'coarse' })).toBe(
      true,
    )
  })

  test('reads the fine tier when asked for it', () => {
    expect(resolveCoarseTier({ hasCoarseTier: true, lodMode: 'fine' })).toBe(
      false,
    )
  })

  // a direct getFeatures call (feature-by-id lookup, text search) states no tier
  test('defaults to fine when no tier is stated', () => {
    expect(resolveCoarseTier({ hasCoarseTier: true })).toBe(false)
  })

  // a file made without a coarse tier has no T/Q rows to read, so asking for
  // one must degrade rather than query prefixes that return nothing
  test('coarse degrades to fine when the file has no coarse tier', () => {
    expect(resolveCoarseTier({ hasCoarseTier: false, lodMode: 'coarse' })).toBe(
      false,
    )
  })
})
