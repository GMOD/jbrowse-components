import {
  calculateUTRs,
  calculateUTRs2,
  filterSuccessiveElementsWithSameStartAndEndCoord,
  formatSubfeatures,
  revlist,
  stitch,
} from './util.tsx'

import type { Feat } from './util.tsx'

describe('stitch', () => {
  test('joins slices of a sequence', () => {
    // ATGCCCTTG: slice(0,3)='ATG', slice(6,9)='TTG'
    expect(
      stitch(
        [
          { start: 0, end: 3 },
          { start: 6, end: 9 },
        ],
        'ATGCCCTTG',
      ),
    ).toBe('ATGTTG')
  })

  test('empty subfeatures returns empty string', () => {
    expect(stitch([], 'ATGCCC')).toBe('')
  })
})

describe('filterSuccessiveElementsWithSameStartAndEndCoord', () => {
  test('removes immediately successive duplicates', () => {
    const input: Feat[] = [
      { start: 10, end: 20 },
      { start: 10, end: 20 },
      { start: 30, end: 40 },
    ]
    expect(
      filterSuccessiveElementsWithSameStartAndEndCoord(input),
    ).toStrictEqual([
      { start: 10, end: 20 },
      { start: 30, end: 40 },
    ])
  })

  test('keeps non-successive duplicates', () => {
    const input: Feat[] = [
      { start: 10, end: 20 },
      { start: 30, end: 40 },
      { start: 10, end: 20 },
    ]
    expect(
      filterSuccessiveElementsWithSameStartAndEndCoord(input),
    ).toHaveLength(3)
  })

  test('empty list returns empty list', () => {
    expect(filterSuccessiveElementsWithSameStartAndEndCoord([])).toStrictEqual(
      [],
    )
  })
})

describe('revlist', () => {
  test('reverses coordinates relative to seqlen and sorts', () => {
    const list: Feat[] = [
      { start: 0, end: 10 },
      { start: 90, end: 100 },
    ]
    expect(revlist(list, 100)).toStrictEqual([
      { start: 0, end: 10 },
      { start: 90, end: 100 },
    ])
  })

  test('transforms coords correctly', () => {
    const list: Feat[] = [{ start: 20, end: 30 }]
    // seqlen=100: start = 100-30=70, end = 100-20=80
    expect(revlist(list, 100)).toStrictEqual([{ start: 70, end: 80 }])
  })
})

describe('calculateUTRs', () => {
  test('returns empty when no CDS', () => {
    expect(
      calculateUTRs([], [{ start: 0, end: 100 }]),
    ).toStrictEqual([])
  })

  test('returns empty when exons < cds length', () => {
    const cds: Feat[] = [
      { start: 10, end: 30 },
      { start: 50, end: 70 },
    ]
    const exons: Feat[] = [{ start: 0, end: 100 }]
    expect(calculateUTRs(cds, exons)).toStrictEqual([])
  })

  test('calculates 5prime and 3prime UTRs from CDS within exons', () => {
    // gene: 0-200, exons: 0-200, cds: 50-150
    const cds: Feat[] = [{ start: 50, end: 150 }]
    const exons: Feat[] = [{ start: 0, end: 200 }]
    const utrs = calculateUTRs(cds, exons)
    expect(utrs).toContainEqual(
      expect.objectContaining({ start: 0, end: 50, type: 'five_prime_UTR' }),
    )
    expect(utrs).toContainEqual(
      expect.objectContaining({ start: 150, end: 200, type: 'three_prime_UTR' }),
    )
  })

  test('multi-exon gene with UTR exons', () => {
    // exon1: 0-100 (UTR), exon2: 200-400 (contains CDS start at 250),
    // exon3: 500-700 (contains CDS end at 600), exon4: 800-900 (UTR)
    const cds: Feat[] = [
      { start: 250, end: 400 },
      { start: 500, end: 600 },
    ]
    const exons: Feat[] = [
      { start: 0, end: 100 },
      { start: 200, end: 400 },
      { start: 500, end: 700 },
      { start: 800, end: 900 },
    ]
    const utrs = calculateUTRs(cds, exons)
    // 5' UTR: exon1 entirely, plus 200-250 from exon2
    expect(utrs).toContainEqual(
      expect.objectContaining({ start: 0, end: 100, type: 'five_prime_UTR' }),
    )
    expect(utrs).toContainEqual(
      expect.objectContaining({ start: 200, end: 250, type: 'five_prime_UTR' }),
    )
    // 3' UTR: 600-700 from exon3, plus exon4 entirely
    expect(utrs).toContainEqual(
      expect.objectContaining({ start: 600, end: 700, type: 'three_prime_UTR' }),
    )
    expect(utrs).toContainEqual(
      expect.objectContaining({ start: 800, end: 900, type: 'three_prime_UTR' }),
    )
  })
})

describe('calculateUTRs2', () => {
  test('returns empty when no CDS', () => {
    expect(
      calculateUTRs2([], { start: 0, end: 100 }),
    ).toStrictEqual([])
  })

  test('computes UTRs from parent bounds and first/last CDS', () => {
    const cds: Feat[] = [{ start: 30, end: 70 }]
    const parent: Feat = { start: 0, end: 100 }
    const utrs = calculateUTRs2(cds, parent)
    expect(utrs).toContainEqual(
      expect.objectContaining({ start: 0, end: 30, type: 'five_prime_UTR' }),
    )
    expect(utrs).toContainEqual(
      expect.objectContaining({ start: 70, end: 100, type: 'three_prime_UTR' }),
    )
  })

  test('multi-CDS uses outermost boundaries', () => {
    const cds: Feat[] = [
      { start: 20, end: 40 },
      { start: 60, end: 80 },
    ]
    const parent: Feat = { start: 0, end: 100 }
    const utrs = calculateUTRs2(cds, parent)
    expect(utrs).toContainEqual(
      expect.objectContaining({ start: 0, end: 20, type: 'five_prime_UTR' }),
    )
    expect(utrs).toContainEqual(
      expect.objectContaining({ start: 80, end: 100, type: 'three_prime_UTR' }),
    )
  })
})

describe('formatSubfeatures', () => {
  test('calls parse on each subfeature within depth', () => {
    const parsed: Record<string, unknown>[] = []
    const feat = {
      start: 0,
      end: 100,
      subfeatures: [
        { start: 10, end: 30 },
        { start: 50, end: 70 },
      ],
    }
    formatSubfeatures(feat, 1, sub => {
      parsed.push(sub)
    })
    expect(parsed).toHaveLength(2)
  })

  test('does not recurse beyond depth limit', () => {
    const parsed: Record<string, unknown>[] = []
    const feat = {
      start: 0,
      end: 100,
      subfeatures: [
        {
          start: 10,
          end: 30,
          subfeatures: [{ start: 15, end: 25 }],
        },
      ],
    }
    formatSubfeatures(feat, 1, sub => {
      parsed.push(sub)
    })
    // depth=1 means only immediate subfeatures are parsed, not nested ones
    expect(parsed).toHaveLength(1)
  })

  test('handles features with no subfeatures', () => {
    const parsed: Record<string, unknown>[] = []
    formatSubfeatures({ start: 0, end: 100 }, 1, sub => {
      parsed.push(sub)
    })
    expect(parsed).toHaveLength(0)
  })
})
