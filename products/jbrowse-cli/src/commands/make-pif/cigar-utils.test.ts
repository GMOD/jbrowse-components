import { splitCigarOnLargeGaps } from './cigar-utils.ts'

function call({
  cigar = '100M',
  strand = '+',
  tstart = 0,
  qstart = 0,
  qend = 100,
  splitGap,
}: {
  cigar?: string | undefined
  strand?: string
  tstart?: number
  qstart?: number
  qend?: number
  splitGap: number | undefined
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
      numMatches: 100,
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

  test('does not split when splitGap is 0 (strip-only)', () => {
    const segs = call({
      cigar: '20M1000D20M',
      qend: 40,
      splitGap: 0,
    })
    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatchObject({
      tstart: 0,
      tend: 1040,
      qstart: 0,
      qend: 40,
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

  test('counts = as matches and X as block-only', () => {
    const segs = call({
      cigar: '50=10X40=',
      qend: 100,
      splitGap: 0,
    })
    expect(segs).toHaveLength(1)
    // = counts as a residue match, X does not; both add to block length
    expect(segs[0]).toMatchObject({
      numMatches: 90,
      blockLen: 100,
    })
  })

  test('block length includes small indel bases; matches exclude them', () => {
    const segs = call({
      cigar: '50=5D45=',
      qend: 95,
      splitGap: 0,
    })
    expect(segs).toHaveLength(1)
    // 95 residue matches, block length 100 (includes the 5bp deletion)
    expect(segs[0]).toMatchObject({
      numMatches: 95,
      blockLen: 100,
    })
  })

  test('missing cigar returns a single passthrough record', () => {
    const segs = call({
      cigar: undefined,
      qend: 100,
      splitGap: 500,
    })
    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatchObject({
      tstart: 0,
      tend: 100,
      qstart: 0,
      qend: 100,
    })
  })
})
