import { splitCigarOnLargeGaps } from './cigar-utils.ts'

function call({
  cigar = '100M',
  strand = '+',
  tstart = 0,
  qstart = 0,
  qend = 100,
  splitGap,
}: {
  cigar?: string
  strand?: string
  tstart?: number
  qstart?: number
  qend?: number
  splitGap: number
}) {
  return splitCigarOnLargeGaps({
    cigar,
    strand,
    tstart,
    qstart,
    qend,
    splitGap,
  })
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
      qend: 20,
      splitGap: 500,
    })
    // the 1000bp gap belongs to neither piece
    expect(segs.map(s => s.blockLen)).toEqual([10, 10])
  })
})
