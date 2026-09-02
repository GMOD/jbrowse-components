import {
  coarseRowsAreBounded,
  makeIndexedSyntenyFeature,
  markReciprocalDuplicates,
  parseBed,
  parsePifHeader,
  parsePifLine,
  resolveCoarseTier,
  restatementContext,
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

  // The parse walks tab offsets in the whole text rather than splitting it into
  // lines and each line into columns, so every boundary the split used to
  // handle for free is now this function's own business. These are the ones a
  // real BED reaches: all three line terminators, a trailing newline, a
  // truncated row, an empty column, and a strand column with something after
  // the `-`.
  // The minus strand is on the FIRST row of each pair, so the terminator falls
  // immediately after the `-` that the last column has to read as a strand: a
  // parse that leaves the `\r` on the line reads `-\r` and reports plus.
  test.each([
    ['\\n', 'chr1\t1\t2\tg1\t0\t-\nchr2\t3\t4\tg2\t0\t+'],
    ['\\r\\n', 'chr1\t1\t2\tg1\t0\t-\r\nchr2\t3\t4\tg2\t0\t+'],
    ['lone \\r', 'chr1\t1\t2\tg1\t0\t-\rchr2\t3\t4\tg2\t0\t+'],
    ['trailing newline', 'chr1\t1\t2\tg1\t0\t-\nchr2\t3\t4\tg2\t0\t+\n'],
    ['trailing \\r\\n', 'chr1\t1\t2\tg1\t0\t-\r\nchr2\t3\t4\tg2\t0\t+\r\n'],
  ])('splits rows on %s', (_label, text) => {
    const bed = parseBed(text)
    expect(bed.size).toBe(2)
    expect(bed.get('g1')).toEqual({
      refName: 'chr1',
      start: 1,
      end: 2,
      name: 'g1',
      score: 0,
      strand: -1,
    })
    expect(bed.get('g2')).toEqual({
      refName: 'chr2',
      start: 3,
      end: 4,
      name: 'g2',
      score: 0,
      strand: 1,
    })
  })

  // the score is the last column here, so a CR left on the line lands inside
  // it: `0\r` is not finite and falls back to the missing-value 0, which is
  // what a `0` score reads as anyway. A non-zero one is what tells them apart.
  test('reads the last column of a CRLF row without the CR', () => {
    expect(parseBed('chr1\t1\t2\tg1\t55\r\n').get('g1')?.score).toBe(55)
  })

  test.each([
    ['a comment', '#chr1\t1\t2\tg1\t0\t+'],
    ['a blank line', '\n\n'],
    ['no tabs', 'chr1'],
    ['a row cut off before the name', 'chr1\t1\t2'],
    ['an empty refName', '\t1\t2\tg1\t0\t+'],
    ['an empty start', 'chr1\t\t2\tg1\t0\t+'],
    ['an empty end', 'chr1\t1\t\tg1\t0\t+'],
    ['an empty name', 'chr1\t1\t2\t\t0\t+'],
  ])('skips %s', (_label, text) => {
    expect(parseBed(text).size).toBe(0)
  })

  // a `-` is the minus strand; a column that merely starts with one is not
  test('reads a strand column of `-x` as plus', () => {
    expect(parseBed('chr1\t1\t2\tg1\t0\t-x').get('g1')?.strand).toBe(1)
  })

  // the columns past strand are thickStart/thickEnd/itemRgb, which say nothing
  // about the strand column before them
  test('reads a minus strand followed by more columns', () => {
    expect(parseBed('chr1\t1\t2\tg1\t0\t-\t1\t2').get('g1')?.strand).toBe(-1)
  })

  // the coordinate columns take the digit fast path; a score that is not a
  // whole number still has to coerce
  test('reads a fractional score', () => {
    expect(parseBed('chr1\t1\t2\tg1\t2.5\t+').get('g1')?.score).toBe(2.5)
  })

  test('reads a negative score', () => {
    expect(parseBed('chr1\t1\t2\tg1\t-3\t+').get('g1')?.score).toBe(-3)
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

  // AN INVERTED HOMOLOGY, chained two ways, which is the shape the forward-only
  // boundary test could not see. Modelled on the same K12/NCTC86 split above but
  // on a reverse diagonal: the fragment starting 42 bp before the parent ends
  // 42 bp AFTER the parent's mateEnd, and its mateStart belongs to the other end
  // of the block entirely. Read forwards, the two deltas differ by the whole
  // block and every one of these drew twice.
  const invParent = {
    refName: 'NCTC86#1#chr',
    start: 1435000,
    end: 2044664,
    mateRefName: 'IAI39#1#chr',
    mateStart: 1698409,
    mateEnd: 2292242,
    strand: -1,
  }
  const invHead = {
    ...invParent,
    start: 1434958,
    // reverse diagonal: the anchor's low end is the mate's high end
    end: 1632337,
    mateStart: 2091815,
    mateEnd: 2292284,
  }
  const invTail = {
    ...invParent,
    start: 1652745,
    end: 2044577,
    mateStart: 1698496,
    mateEnd: 2091751,
  }

  test('drops the fragments of an INVERTED block chained further', () => {
    expect(markReciprocalDuplicates([invParent, invHead, invTail])).toEqual([
      false,
      true,
      true,
    ])
  })

  test('keeps the longer chaining of an inverted block whatever the order', () => {
    expect(markReciprocalDuplicates([invHead, invTail, invParent])).toEqual([
      true,
      true,
      false,
    ])
  })

  // Same spans, opposite orientations: a forward and a reverse alignment of one
  // pair of loci are two statements, not one restated, and no amount of span
  // containment makes them one.
  test('keeps two sides that disagree about orientation', () => {
    expect(
      markReciprocalDuplicates([invParent, { ...invParent, strand: 1 }]),
    ).toEqual([false, false])
  })

  // A side with no strand is forward, which is what every caller assumed before
  // the field existed.
  test('treats a missing strand as forward', () => {
    expect(markReciprocalDuplicates([k12ToNctc, nctcHead, nctcTail])).toEqual([
      false,
      true,
      true,
    ])
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

// How far past a region query an INDEXED adapter has to read for the pass above
// to answer the same way it would over the whole file. The bound is what makes
// the fix affordable: an adapter that widened to the rows' own extent would read
// a whole chromosome of a pangenome for every block.
describe('restatementContext', () => {
  const side = (start: number, end: number) => ({
    refName: 'K12#1#chr',
    start,
    end,
    mateRefName: 'CFT073#1#chr',
    mateStart: start,
    mateEnd: end,
  })

  test('a query landing inside its rows reads once', () => {
    expect(restatementContext([side(1000, 11_000)], 5000, 6000)).toEqual({
      start: 5000,
      end: 6000,
    })
  })

  // A row the query catches by its outer tenth may have a partner covering the
  // rest of it and nothing the query reaches — one fringe further on reaches a
  // point that partner has to cover.
  test('a row caught by its trailing fringe reaches back a tenth of it', () => {
    expect(restatementContext([side(1000, 11_000)], 10_500, 12_000)).toEqual({
      start: 10_000,
      end: 12_000,
    })
  })

  test('a row caught by its leading fringe reaches forward a tenth of it', () => {
    expect(restatementContext([side(1000, 11_000)], 0, 1500)).toEqual({
      start: 0,
      end: 2000,
    })
  })

  test('an empty answer widens nothing', () => {
    expect(restatementContext([], 5000, 6000)).toEqual({
      start: 5000,
      end: 6000,
    })
  })

  // A tenth back from a row's own end is 0.9*end + 0.1*start, so a row on a
  // contig start cannot reach below it and the answer needs no clamp
  test('a row at the contig start reaches back inside the contig', () => {
    expect(restatementContext([side(0, 10_000)], 9500, 10_000).start).toBe(9000)
  })
})

describe('the #pif header', () => {
  test('parses the fields make-pif writes, and reads nothing from no header', () => {
    expect(
      parsePifHeader(
        '#pif\tversion:i:1\ttiers:Z:fine,coarse\tcoarse:i:10000\tcigars:Z:all\n',
      ),
    ).toEqual({
      version: 1,
      tiers: ['fine', 'coarse'],
      coarseGap: 10000,
      cigars: 'all',
    })
    expect(parsePifHeader('')).toEqual({})
  })

  test('coarse rows are bounded only with a bound and a CIGAR on every row', () => {
    expect(coarseRowsAreBounded({ coarseGap: 10000, cigars: 'all' })).toBe(true)
    expect(coarseRowsAreBounded({ coarseGap: 10000, cigars: 'some' })).toBe(
      false,
    )
    expect(coarseRowsAreBounded({ cigars: 'all' })).toBe(false)
    expect(coarseRowsAreBounded({})).toBe(false)
  })
})

// A coarse row of a bounded file that carries no fold is the single run its
// columns describe, so it walks, flips and clips like any fold; a fine row and
// an unbounded file's coarse row get nothing implied.
describe('the implied fold of a tagless coarse row', () => {
  const row = (prefix: string) =>
    parsePifLine(
      `${prefix}chr1\t1000\t0\t500\t+\tq1\t1000\t0\t450\t400\t500\t60\tde:f:0.1`,
    )
  const feature = (prefix: string, boundedCoarseRows: boolean) =>
    makeIndexedSyntenyFeature({
      line: row(prefix),
      fileOffset: 1,
      assemblyName: 'a',
      refName: 'chr1',
      boundedCoarseRows,
      mate: { start: 0, end: 450, refName: 'q1', assemblyName: 'b' },
    })
  test('implied for a coarse row of a bounded file', () => {
    expect(feature('T', true).get('coarseCigar')).toBe('500:450M')
  })
  test('not for a fine row, nor without the bound', () => {
    expect(feature('t', true).get('coarseCigar')).toBeUndefined()
    expect(feature('T', false).get('coarseCigar')).toBeUndefined()
  })
})
