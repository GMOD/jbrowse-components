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

function collect(cigar: number[], bpPerPxInv0: number, bpPerPxInv1: number) {
  const results: { op: number; cx1: number; cx2: number }[] = []
  visitCigarRenderedSegments(
    cigar,
    0,
    0,
    bpPerPxInv0,
    bpPerPxInv1,
    1,
    1,
    (op, _px1, cx1, _px2, cx2) => results.push({ op, cx1, cx2 }),
  )
  return results
}

describe('visitCigarRenderedSegments', () => {
  // bpPerPxInv0=0.5 (ref: 2bp/px), bpPerPxInv1=0.05 (query: 20bp/px)
  // 10D → d1=5 (visible on ref), d2=0.5 (not visible on query)
  it('emits CIGAR_D for a deletion visible only on the ref track', () => {
    const [seg] = collect([pack(10, CIGAR_D)], 0.5, 0.05)
    expect(seg!.op).toBe(CIGAR_D)
    expect(seg!.cx1).toBeCloseTo(5) // ref advances
    expect(seg!.cx2).toBeCloseTo(0) // query unchanged
  })

  it('emits CIGAR_N for a skip visible only on the ref track', () => {
    const [seg] = collect([pack(10, CIGAR_N)], 0.5, 0.05)
    expect(seg!.op).toBe(CIGAR_N)
  })

  it('emits CIGAR_X for a mismatch visible only on the ref track', () => {
    const [seg] = collect([pack(10, CIGAR_X)], 0.5, 0.05)
    expect(seg!.op).toBe(CIGAR_X)
  })

  // bpPerPxInv0=0.05 (ref: 20bp/px), bpPerPxInv1=0.5 (query: 2bp/px)
  // 10I → d1=0.5 (not visible), d2=5 (visible on query)
  it('emits CIGAR_I for an insertion visible only on the query track', () => {
    const [seg] = collect([pack(10, CIGAR_I)], 0.05, 0.5)
    expect(seg!.op).toBe(CIGAR_I)
    expect(seg!.cx2).toBeCloseTo(5)
  })

  it('emits CIGAR_D when visible on both tracks', () => {
    const [seg] = collect([pack(10, CIGAR_D)], 0.5, 0.5)
    expect(seg!.op).toBe(CIGAR_D)
  })

  // Small D (0.05px) is merged into the subsequent large M — result is M
  it('emits CIGAR_M when a small indel is merged into a surrounding match', () => {
    const cigar = [pack(1, CIGAR_D), pack(30, CIGAR_M)]
    const segs = collect(cigar, 0.05, 0.05)
    expect(segs.every(s => s.op === CIGAR_M)).toBe(true)
  })
})
