import {
  CIGAR_D,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_RUN,
  CIGAR_X,
} from './cigarConstants.ts'
import { visitCigarRenderedSegments } from './cigarRenderedSegments.ts'

function pack(len: number, op: number) {
  return (len << 4) | op
}

function collect(cigar: number[], bpPerPx0: number, bpPerPx1: number) {
  const results: {
    op: number
    bp1Start: number
    bp1End: number
    bp2End: number
  }[] = []
  visitCigarRenderedSegments(
    cigar,
    0,
    0,
    bpPerPx0,
    bpPerPx1,
    1,
    1,
    (op, bp1Start, bp1End, _bp2Start, bp2End) =>
      results.push({ op, bp1Start, bp1End, bp2End }),
  )
  return results
}

describe('visitCigarRenderedSegments', () => {
  // bpPerPx0=2 (ref: 2bp/px), bpPerPx1=20 (query: 20bp/px)
  // 10D → ref advances 10bp (5px wide, > 1px threshold), visible; query unchanged
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
  // 10I → query advances 10bp (>= 1px threshold, visible); ref unchanged
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

  // MIN_INDEL_PX=1 threshold: 1bp indel at bpPerPx=2 is 0.5px wide — merged
  it('merges a 1bp indel that would be < 1px wide', () => {
    const cigar = [pack(30, CIGAR_M), pack(1, CIGAR_I), pack(30, CIGAR_M)]
    const segs = collect(cigar, 2, 2)
    expect(segs.every(s => s.op === CIGAR_M)).toBe(true)
  })

  // 3bp indel at bpPerPx=2 is 1.5px wide — now kept (frission from ~1px
  // detail); the old 2px floor (MIN_INDEL_PX=2) merged anything under 4bp here
  it('keeps a 1.5px indel that the old 2px floor would have merged', () => {
    const cigar = [pack(30, CIGAR_M), pack(3, CIGAR_I), pack(30, CIGAR_M)]
    const segs = collect(cigar, 2, 2)
    expect(segs.some(s => s.op === CIGAR_I)).toBe(true)
  })

  // The merge path skips the flush, so a sub-pixel indel LAST used to leave the
  // open segment unemitted — the whole span from the previous emit to the end of
  // the alignment, silently.
  it('flushes the tail when the last op is a merged sub-pixel indel', () => {
    const segs = collect([pack(500, CIGAR_M), pack(1, CIGAR_D)], 100, 100)
    expect(segs.at(-1)!.bp1End).toBeCloseTo(501)
  })

  // And the tail is not necessarily small: it is however long a run of sub-pixel
  // indels the CIGAR ends with. 1000 x 1bp D at 100bp/px is 10px of query axis.
  it('flushes a tail made of many sub-pixel indels', () => {
    const segs = collect(
      [
        pack(500, CIGAR_M),
        ...Array.from({ length: 1000 }, () => pack(1, CIGAR_D)),
      ],
      100,
      100,
    )
    expect(segs.at(-1)!.bp1End).toBeCloseTo(1500)
    // Labelled a match: every op merged into it was individually sub-pixel, so
    // the trailing D's kind would misname a span that is 500bp of match.
    expect(segs.at(-1)!.op).toBe(CIGAR_M)
  })

  // The segments must partition the query axis for the location-marker grid to
  // be able to ask each one "does a round coordinate fall inside you" and get
  // each tick exactly once.
  it('emits segments that tile the query axis end to end', () => {
    const cigar = [
      pack(300, CIGAR_M),
      pack(2000, CIGAR_D),
      pack(400, CIGAR_M),
      pack(50, CIGAR_I),
      pack(600, CIGAR_M),
      pack(3, CIGAR_D),
    ]
    const segs = collect(cigar, 100, 100)
    expect(segs[0]!.bp1Start).toBe(0)
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i]!.bp1Start).toBeCloseTo(segs[i - 1]!.bp1End)
    }
    expect(segs.at(-1)!.bp1End).toBeCloseTo(300 + 2000 + 400 + 600 + 3)
  })
})

describe('CIGAR_RUN word pairs', () => {
  test('a run advances each axis by its own length and reports as M', () => {
    const [seg, ...rest] = collect(
      [pack(100, CIGAR_RUN), pack(50, CIGAR_RUN)],
      1,
      1,
    )
    expect(rest).toHaveLength(0)
    expect(seg!.op).toBe(CIGAR_M)
    expect(seg!.bp1End).toBe(100)
    expect(seg!.bp2End).toBe(50)
  })

  test('a kept gap between two runs is still emitted as its own op', () => {
    const segs = collect(
      [
        pack(100, CIGAR_RUN),
        pack(50, CIGAR_RUN),
        pack(30, CIGAR_D),
        pack(100, CIGAR_RUN),
        pack(50, CIGAR_RUN),
      ],
      1,
      1,
    )
    expect(segs.map(s => s.op)).toEqual([CIGAR_M, CIGAR_D, CIGAR_M])
    expect(segs[1]).toEqual({
      op: CIGAR_D,
      bp1Start: 100,
      bp1End: 130,
      bp2End: 50,
    })
    expect(segs[2]).toEqual({
      op: CIGAR_M,
      bp1Start: 130,
      bp1End: 230,
      bp2End: 100,
    })
  })
})
