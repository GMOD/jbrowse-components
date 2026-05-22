import {
  CIGAR_D,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_X,
} from './cigarConstants.ts'
import { visitCigarRenderedSegments } from './cigarOpsVisitor.ts'

function pack(len: number, op: number) {
  return (len << 4) | op
}

function collect(cigar: number[], bpPerPx0: number, bpPerPx1: number) {
  const results: { op: number; bp1End: number; bp2End: number }[] = []
  visitCigarRenderedSegments(
    cigar,
    0,
    0,
    bpPerPx0,
    bpPerPx1,
    1,
    1,
    (op, _bp1Start, bp1End, _bp2Start, bp2End) =>
      results.push({ op, bp1End, bp2End }),
  )
  return results
}

describe('visitCigarRenderedSegments', () => {
  // bpPerPx0=2 (ref: 2bp/px), bpPerPx1=20 (query: 20bp/px)
  // 10D → ref advances 10bp (>= 2bp threshold, visible); query unchanged
  it('emits CIGAR_D for a deletion visible on the ref track', () => {
    const [seg] = collect([pack(10, CIGAR_D)], 2, 20)
    expect(seg!.op).toBe(CIGAR_D)
    expect(seg!.bp1End).toBeCloseTo(10)
    expect(seg!.bp2End).toBeCloseTo(0)
  })

  it('emits CIGAR_N for a skip visible on the ref track', () => {
    const [seg] = collect([pack(10, CIGAR_N)], 2, 20)
    expect(seg!.op).toBe(CIGAR_N)
  })

  it('emits CIGAR_X for a mismatch on both tracks', () => {
    const [seg] = collect([pack(10, CIGAR_X)], 2, 20)
    expect(seg!.op).toBe(CIGAR_X)
  })

  // bpPerPx0=20 (ref: 20bp/px), bpPerPx1=2 (query: 2bp/px)
  // 10I → query advances 10bp (>= 2bp threshold, visible); ref unchanged
  it('emits CIGAR_I for an insertion visible on the query track', () => {
    const [seg] = collect([pack(10, CIGAR_I)], 20, 2)
    expect(seg!.op).toBe(CIGAR_I)
    expect(seg!.bp2End).toBeCloseTo(10)
  })

  it('emits CIGAR_D when visible on both tracks', () => {
    const [seg] = collect([pack(10, CIGAR_D)], 2, 2)
    expect(seg!.op).toBe(CIGAR_D)
  })

  // Small D (1bp < bpPerPx0=20) is merged into the subsequent large M
  it('emits CIGAR_M when a small indel is merged into a surrounding match', () => {
    const cigar = [pack(1, CIGAR_D), pack(30, CIGAR_M)]
    const segs = collect(cigar, 20, 20)
    expect(segs.every(s => s.op === CIGAR_M)).toBe(true)
  })
})
