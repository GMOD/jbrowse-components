import {
  CIGAR_D,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_UNALIGNED,
} from './cigarConstants.ts'
import { visitCigarPairedIndelSegments } from './cigarPairedIndelSegments.ts'

function pack(len: number, op: number) {
  return (len << 4) | op
}

function collect(
  cigar: number[],
  { rev2 = 1, bpPerPx0 = 10, bpPerPx1 = 10 } = {},
) {
  const segments: number[][] = []
  visitCigarPairedIndelSegments(
    cigar,
    0,
    0,
    bpPerPx0,
    bpPerPx1,
    1,
    rev2,
    (op, bp1Start, bp1End, bp2Start, bp2End) => {
      segments.push([op, bp1Start, bp1End, bp2Start, bp2End])
    },
  )
  return segments
}

describe('visitCigarPairedIndelSegments', () => {
  it('reports a deletion meeting an insertion as one unaligned segment', () => {
    expect(
      collect([
        pack(100, CIGAR_M),
        pack(5000, CIGAR_D),
        pack(4800, CIGAR_I),
        pack(100, CIGAR_M),
      ]),
    ).toEqual([
      [CIGAR_M, 0, 100, 0, 100],
      [CIGAR_UNALIGNED, 100, 5100, 100, 4900],
      [CIGAR_M, 5100, 5200, 4900, 5000],
    ])
  })

  it('pairs an insertion before a deletion', () => {
    expect(collect([pack(3000, CIGAR_I), pack(1000, CIGAR_D)])).toEqual([
      [CIGAR_UNALIGNED, 0, 1000, 0, 3000],
    ])
  })

  it('pairs across a sub-pixel match', () => {
    expect(
      collect([pack(5000, CIGAR_D), pack(3, CIGAR_M), pack(5000, CIGAR_I)]),
    ).toEqual([[CIGAR_UNALIGNED, 0, 5003, 0, 5003]])
  })

  it('pairs across sub-pixel deletions mixed with a few matched bases', () => {
    expect(
      collect(
        [
          pack(5000, CIGAR_D),
          pack(3, CIGAR_M),
          pack(9, CIGAR_D),
          pack(3, CIGAR_M),
          pack(9, CIGAR_D),
          pack(5000, CIGAR_I),
        ],
        {},
      ),
    ).toEqual([[CIGAR_UNALIGNED, 0, 5024, 0, 5006]])
  })

  it('keeps apart a pair whose match is under a pixel only on the coarser axis', () => {
    expect(
      collect([pack(5000, CIGAR_D), pack(900, CIGAR_M), pack(5000, CIGAR_I)], {
        bpPerPx0: 1000,
        bpPerPx1: 10,
      }),
    ).toEqual([
      [CIGAR_D, 0, 5000, 0, 0],
      [CIGAR_M, 5000, 5900, 0, 900],
      [CIGAR_I, 5900, 5900, 900, 5900],
    ])
  })

  it('walks a reverse axis', () => {
    expect(
      collect([pack(5000, CIGAR_D), pack(4000, CIGAR_I)], { rev2: -1 }),
    ).toEqual([[CIGAR_UNALIGNED, 0, 5000, 0, -4000]])
  })

  it('leaves indels apart by a rendered match alone', () => {
    expect(
      collect([pack(5000, CIGAR_D), pack(100, CIGAR_M), pack(4800, CIGAR_I)]),
    ).toEqual([
      [CIGAR_D, 0, 5000, 0, 0],
      [CIGAR_M, 5000, 5100, 0, 100],
      [CIGAR_I, 5100, 5100, 100, 4900],
    ])
  })

  it('pairs only two of three alternating indels', () => {
    expect(
      collect([pack(1000, CIGAR_D), pack(1000, CIGAR_I), pack(1000, CIGAR_D)]),
    ).toEqual([
      [CIGAR_UNALIGNED, 0, 1000, 0, 1000],
      [CIGAR_D, 1000, 2000, 1000, 1000],
    ])
  })

  it('leaves a skip beside an insertion alone', () => {
    expect(collect([pack(5000, CIGAR_N), pack(4800, CIGAR_I)])).toEqual([
      [CIGAR_N, 0, 5000, 0, 0],
      [CIGAR_I, 5000, 5000, 0, 4800],
    ])
  })

  it('keeps a lone trailing indel', () => {
    expect(collect([pack(100, CIGAR_M), pack(5000, CIGAR_D)])).toEqual([
      [CIGAR_M, 0, 100, 0, 100],
      [CIGAR_D, 100, 5100, 100, 100],
    ])
  })
})
