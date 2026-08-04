import { createReciprocalDedupe, parseBed, resolveCoarseTier } from './util.ts'

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

describe('createReciprocalDedupe', () => {
  // The E. coli wfmash pair that prompted this: one homology, aligned from
  // either end, so the two sides differ by 4 bp on the anchor and 513 on the
  // mate over 134 kb. Both are anchored on K12 when K12 is the row being drawn,
  // so without this the band paints the ribbon twice.
  const k12ToCft = {
    refName: 'K12#1#chr',
    start: 4362432,
    end: 4496576,
    mateRefName: 'CFT073#1#chr',
    mateStart: 4971470,
    mateEnd: 5115529,
  }
  const cftToK12 = {
    refName: 'K12#1#chr',
    start: 4362436,
    end: 4496063,
    mateRefName: 'CFT073#1#chr',
    mateStart: 4971408,
    mateEnd: 5115000,
  }

  test('drops the second statement of one homology', () => {
    const isDuplicate = createReciprocalDedupe()
    expect(isDuplicate(k12ToCft)).toBe(false)
    expect(isDuplicate(cftToK12)).toBe(true)
  })

  test('keeps a second alignment of the same contigs at another locus', () => {
    const isDuplicate = createReciprocalDedupe()
    expect(isDuplicate(k12ToCft)).toBe(false)
    expect(isDuplicate({ ...k12ToCft, start: 100_000, end: 234_144 })).toBe(
      false,
    )
  })

  // Paralogy: the same span of the anchor aligned to two different places on
  // the mate is two homologies, not one stated twice, and only agreement on
  // BOTH spans makes a duplicate.
  test('keeps two mates of one anchor span', () => {
    const isDuplicate = createReciprocalDedupe()
    expect(isDuplicate(k12ToCft)).toBe(false)
    expect(
      isDuplicate({ ...k12ToCft, mateStart: 100_000, mateEnd: 244_059 }),
    ).toBe(false)
  })

  test('keeps everything in a file with one direction per pair', () => {
    const isDuplicate = createReciprocalDedupe()
    for (let i = 0; i < 5; i++) {
      expect(
        isDuplicate({
          ...k12ToCft,
          start: i * 200_000,
          end: i * 200_000 + 134_144,
        }),
      ).toBe(false)
    }
  })
})
