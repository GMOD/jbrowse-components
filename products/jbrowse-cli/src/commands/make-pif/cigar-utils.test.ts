import { splitCigarOnLargeGaps } from './cigar-utils.ts'

// `tend` is what the row's own columns say, so it is what `closed` is judged
// against; each case below passes the value its CIGAR actually consumes.
function split({
  cigar = '100M',
  strand = '+',
  tstart = 0,
  tend = 100,
  qstart = 0,
  qend = 100,
  splitGap,
}: {
  cigar?: string
  strand?: string
  tstart?: number
  tend?: number
  qstart?: number
  qend?: number
  splitGap: number
}) {
  return splitCigarOnLargeGaps({
    cigar,
    strand,
    tstart,
    tend,
    qstart,
    qend,
    splitGap,
  })
}

function call(args: Parameters<typeof split>[0]) {
  const { segments, closed } = split(args)
  if (!closed) {
    throw new Error(
      'walk did not close on the row columns; use split() instead',
    )
  }
  return segments
}

describe('splitCigarOnLargeGaps', () => {
  test('returns a single segment when no qualifying gap', () => {
    const segs = call({ cigar: '100M', splitGap: 50 })
    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatchObject({
      tstart: 0,
      tend: 100,
      qstart: 0,
      qend: 100,
      blockLen: 100,
    })
  })

  test('splits on a large deletion (target gap)', () => {
    // 30M then 1000D then 30M — target advances over the 1000bp gap;
    // query does not. With splitGap=500 we expect two segments.
    const segs = call({
      cigar: '30M1000D30M',
      tend: 1060,
      qend: 60,
      splitGap: 500,
    })
    expect(segs).toHaveLength(2)
    expect(segs[0]).toMatchObject({
      tstart: 0,
      tend: 30,
      qstart: 0,
      qend: 30,
      blockLen: 30,
    })
    expect(segs[1]).toMatchObject({
      tstart: 1030,
      tend: 1060,
      qstart: 30,
      qend: 60,
      blockLen: 30,
    })
  })

  test('splits on a large insertion (query gap)', () => {
    const segs = call({
      cigar: '20M1000I20M',
      tend: 40,
      qend: 1040,
      splitGap: 500,
    })
    expect(segs).toHaveLength(2)
    expect(segs[0]).toMatchObject({
      tstart: 0,
      tend: 20,
      qstart: 0,
      qend: 20,
      blockLen: 20,
    })
    expect(segs[1]).toMatchObject({
      tstart: 20,
      tend: 40,
      qstart: 1020,
      qend: 1040,
      blockLen: 20,
    })
  })

  test('handles minus strand by walking query backward', () => {
    // '-' strand: walk target forward, query backward in forward-strand coords
    const segs = call({
      cigar: '20M1000D20M',
      strand: '-',
      qstart: 0,
      qend: 40,
      tstart: 0,
      tend: 1040,
      splitGap: 500,
    })
    expect(segs).toHaveLength(2)
    // First segment: target 0..20, query walks from 40 down to 20
    expect(segs[0]).toMatchObject({
      tstart: 0,
      tend: 20,
      qstart: 20,
      qend: 40,
    })
    // Second segment: target 1020..1040, query 0..20
    expect(segs[1]).toMatchObject({
      tstart: 1020,
      tend: 1040,
      qstart: 0,
      qend: 20,
    })
  })

  test('multiple large gaps yield N+1 segments', () => {
    const segs = call({
      cigar: '10M1000D10M1000I10M',
      tend: 1030,
      qend: 1030,
      splitGap: 500,
    })
    expect(segs).toHaveLength(3)
    expect(segs[0]).toMatchObject({ tstart: 0, tend: 10, qstart: 0, qend: 10 })
    expect(segs[1]).toMatchObject({
      tstart: 1010,
      tend: 1020,
      qstart: 10,
      qend: 20,
    })
    expect(segs[2]).toMatchObject({
      tstart: 1020,
      tend: 1030,
      qstart: 1020,
      qend: 1030,
    })
  })

  test('block length counts aligned bases and the small indels kept inside', () => {
    // 50=5D45= — the 5bp deletion is below the split gap, so it stays inside the
    // piece and counts toward its aligned length
    const segs = call({ cigar: '50=5D45=', qend: 95, splitGap: 500 })
    expect(segs).toHaveLength(1)
    expect(segs[0]!.blockLen).toBe(100)
  })

  test('a split drops the large gaps from every piece block length', () => {
    const segs = call({
      cigar: '10M1000D10M',
      tend: 1020,
      qend: 20,
      splitGap: 500,
    })
    // the 1000bp gap belongs to neither piece
    expect(segs.map(s => s.blockLen)).toEqual([10, 10])
  })
})

describe('closure against the row columns', () => {
  // What separates a gap the split legitimately trimmed from a CIGAR that
  // disagrees with its columns — the caller keeps the columns verbatim on false.
  test('a well-formed walk closes', () => {
    expect(split({ cigar: '100M', splitGap: 500 }).closed).toBe(true)
  })

  test('a CIGAR that under-spans its columns does not', () => {
    // 50M against a 0..100 target span: the fine tier draws the columns, so the
    // coarse row must not drift onto the walk's shorter answer
    expect(split({ cigar: '50M', splitGap: 500 }).closed).toBe(false)
  })

  test('a large gap at the START still closes, and yields one tight piece', () => {
    // the case a piece COUNT could not tell from an under-spanning CIGAR
    const { segments, closed } = split({
      cigar: '1000D100M',
      tend: 1100,
      qend: 100,
      splitGap: 500,
    })
    expect(closed).toBe(true)
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ tstart: 1000, tend: 1100 })
  })

  test('a large gap at the END closes too', () => {
    const { segments, closed } = split({
      cigar: '100M1000D',
      tend: 1100,
      qend: 100,
      splitGap: 500,
    })
    expect(closed).toBe(true)
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ tstart: 0, tend: 100 })
  })

  test('a minus-strand walk closes on the query START', () => {
    expect(
      split({
        cigar: '20M1000D20M',
        strand: '-',
        tend: 1040,
        qend: 40,
        splitGap: 500,
      }).closed,
    ).toBe(true)
  })
})
