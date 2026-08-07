import {
  markReciprocalDuplicates,
  parseBed,
  resolveCoarseTier,
} from './util.ts'

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

describe('markReciprocalDuplicates', () => {
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
    expect(markReciprocalDuplicates([k12ToCft, cftToK12])).toEqual([
      false,
      true,
    ])
  })

  // Which member survives is decided by coordinate, not by which the caller
  // happened to read first: the in-memory adapter walks a PAF in file order and
  // the indexed one reads two tabix ranges concurrently, and the same file must
  // draw the same ribbon either way.
  test('drops the same member whichever order the sides arrive in', () => {
    expect(markReciprocalDuplicates([cftToK12, k12ToCft])).toEqual([
      true,
      false,
    ])
  })

  test('keeps a second alignment of the same contigs at another locus', () => {
    expect(
      markReciprocalDuplicates([
        k12ToCft,
        { ...k12ToCft, start: 100_000, end: 234_144 },
      ]),
    ).toEqual([false, false])
  })

  // Paralogy: the same span of the anchor aligned to two different places on
  // the mate is two homologies, not one stated twice, and only agreement on
  // BOTH spans makes a duplicate.
  test('keeps two mates of one anchor span', () => {
    expect(
      markReciprocalDuplicates([
        k12ToCft,
        { ...k12ToCft, mateStart: 100_000, mateEnd: 244_059 },
      ]),
    ).toEqual([false, false])
  })

  // Scored over the shorter span, containment read as a perfect match, so a
  // short block nested inside a long one on BOTH spans — a repeat inside a
  // syntenic block, a minimap2 secondary inside its primary — was silently
  // dropped. Two homologies at very different scales are not one stated twice.
  // It is off the long block's diagonal by 9 kb, which is what says so.
  test('keeps a short block nested inside a long one on both spans', () => {
    expect(
      markReciprocalDuplicates([
        k12ToCft,
        {
          ...k12ToCft,
          start: 4400000,
          end: 4401000,
          mateStart: 5000000,
          mateEnd: 5001000,
        },
      ]),
    ).toEqual([false, false])
  })

  // The other direction's chaining of one homology, from the E. coli graph's own
  // file: wfmash states K12/NCTC86 once from K12 (610 kb) and twice from NCTC86,
  // split at a joint the K12 pass ran through. The fragments are contained in the
  // long block on both axes and meet it on its diagonal — the first shares its
  // start, the second its end — so they are the same homology restated, and
  // drawing all three painted every covered base twice.
  const k12ToNctc = {
    refName: 'K12#1#chr',
    start: 1435000,
    end: 2044664,
    mateRefName: 'NCTC86#1#chr',
    mateStart: 1698409,
    mateEnd: 2292242,
  }
  const nctcHead = {
    ...k12ToNctc,
    start: 1434958,
    end: 1632337,
    mateStart: 1698328,
    mateEnd: 1898776,
  }
  const nctcTail = {
    ...k12ToNctc,
    start: 1652745,
    end: 2044577,
    mateStart: 1898712,
    mateEnd: 2292184,
  }

  test('drops the fragments of a block the other direction chained further', () => {
    expect(markReciprocalDuplicates([k12ToNctc, nctcHead, nctcTail])).toEqual([
      false,
      true,
      true,
    ])
  })

  // The fragment sorts FIRST — it starts 42 bp sooner — so keeping whichever
  // arrived first would drop the long block and leave the band drawn as pieces
  // with a hole between them.
  test('keeps the longer chaining however the sides are ordered', () => {
    expect(markReciprocalDuplicates([nctcHead, nctcTail, k12ToNctc])).toEqual([
      true,
      true,
      false,
    ])
  })

  // Same containment, same contig pair, but 40 kb off the long block's diagonal
  // at both ends: a second homology inside the span of the first, not a chaining
  // of it.
  test('keeps a contained block that is off the diagonal', () => {
    expect(
      markReciprocalDuplicates([
        k12ToNctc,
        { ...nctcHead, mateStart: 1738328, mateEnd: 1938776 },
      ]),
    ).toEqual([false, false])
  })

  // A different contig pair is never a candidate, however similar the coords
  test('keeps identical coordinates on a different contig pair', () => {
    expect(
      markReciprocalDuplicates([
        k12ToCft,
        { ...k12ToCft, mateRefName: 'UTI89#1#chr' },
      ]),
    ).toEqual([false, false])
  })

  test('keeps everything in a file with one direction per pair', () => {
    expect(
      markReciprocalDuplicates(
        Array.from({ length: 5 }, (_, i) => ({
          ...k12ToCft,
          start: i * 200_000,
          end: i * 200_000 + 134_144,
        })),
      ),
    ).toEqual([false, false, false, false, false])
  })

  // The sweep prunes on `end <= start`, so a long run of non-overlapping
  // alignments on one contig pair must not degrade to comparing everything
  // against everything — which is what made a 50k-row pair cost seconds, per
  // region, per band, per pan/zoom.
  test('stays linear over a tiled contig pair', () => {
    const n = 50_000
    const sides = Array.from({ length: n }, (_, i) => ({
      ...k12ToCft,
      start: i * 1000,
      end: i * 1000 + 900,
      mateStart: i * 1000,
      mateEnd: i * 1000 + 900,
    }))
    const t = performance.now()
    expect(markReciprocalDuplicates(sides).filter(Boolean)).toHaveLength(0)
    expect(performance.now() - t).toBeLessThan(2000)
  })
})
