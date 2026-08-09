import { nextJunctionFrom, walkBreakendChain } from './walkBreakendChain.ts'

import type { Junction } from './walkBreakendChain.ts'

// The COLO829 der(3), verbatim from the nanomonsv calls the cancer_sv demo
// serves (`COLO829.somatic-sv.vcf.gz`, INFO reduced to SVTYPE/MATEID):
//
//   chr3   25359111  r_24_1  GTGATGGATTCA[CHR12:72273112[   MATEID=r_24_0
//   chr3   25359568  r_12_1  G[CHR10:58717464[              MATEID=r_12_0
//   chr10  58717464  r_12_0  ]CHR3:25359568]G               MATEID=r_12_1
//   chr10  58717662  r_13_0  GC]CHR12:72273294]             MATEID=r_13_1
//   chr12  72273112  r_24_0  ]CHR3:25359111]TGAATCCATCAG    MATEID=r_24_1
//   chr12  72273294  r_13_1  GG]CHR10:58717662]             MATEID=r_13_0
//
// Three junctions, and they close a triangle: chr3-chr10, chr10-chr12,
// chr12-chr3. The pair of breakends at each corner is 198 bp apart on chr10,
// 182 bp on chr12 and 457 bp on chr3, which is what BREAKEND_COLOCATION_BP is
// sized for. There is no EVENT tag anywhere in this callset -- nanomonsv emits
// SVTYPE and MATEID and nothing grouping records -- so the co-location is the
// only thing that relates them, and following it is what this module does.
//
// Positions are 0-based here, as everything downstream of
// getBreakendCoveringRegions is; the VCF coordinates above are 1-based.
function j(
  id: string,
  mateId: string,
  refName: string,
  pos: number,
  mateRefName: string,
  matePos: number,
): Junction {
  return { id, mateId, refName, pos, mateRefName, matePos: matePos - 1 }
}

const R12 = j('r_12_1', 'r_12_0', 'chr3', 25_359_567, 'chr10', 58_717_464)
const R12_MATE = j('r_12_0', 'r_12_1', 'chr10', 58_717_463, 'chr3', 25_359_568)
const R13 = j('r_13_0', 'r_13_1', 'chr10', 58_717_661, 'chr12', 72_273_294)
const R13_MATE = j('r_13_1', 'r_13_0', 'chr12', 72_273_293, 'chr10', 58_717_662)
const R24 = j('r_24_0', 'r_24_1', 'chr12', 72_273_111, 'chr3', 25_359_111)
const R24_MATE = j('r_24_1', 'r_24_0', 'chr3', 25_359_110, 'chr12', 72_273_112)

const COLO829 = [R12, R12_MATE, R13, R13_MATE, R24, R24_MATE]

function findJunctionsNear(region: {
  refName: string
  start: number
  end: number
}) {
  return Promise.resolve(
    COLO829.filter(
      x =>
        (x.refName === region.refName &&
          x.pos >= region.start &&
          x.pos <= region.end) ||
        (x.mateRefName === region.refName &&
          x.matePos >= region.start &&
          x.matePos <= region.end),
    ),
  )
}

describe('walkBreakendChain over the COLO829 der(3)', () => {
  it('reaches all three chromosomes from the chr3 record', async () => {
    const stops = await walkBreakendChain({
      start: R12,
      findJunctionsNear,
    })
    expect(stops.map(s => s.refName)).toEqual(['chr3', 'chr10', 'chr12'])
    expect(stops.map(s => s.pos)).toEqual([25_359_567, 58_717_463, 72_273_293])
    // and each stop after the first says which junction was crossed to get there
    expect(stops.map(s => s.viaId)).toEqual([undefined, 'r_12_1', 'r_13_0'])
  })

  it('stops at three rather than going round the triangle', async () => {
    // The third junction (r_24) leaves chr12 for chr3, where the chain started.
    // A fourth panel would be a second view of the first locus.
    const stops = await walkBreakendChain({ start: R12, findJunctionsNear })
    expect(stops).toHaveLength(3)
  })

  it('walks the same three from any record in the chain', async () => {
    for (const [start, expected] of [
      [R13, ['chr10', 'chr12', 'chr3']],
      [R24, ['chr12', 'chr3', 'chr10']],
      [R24_MATE, ['chr3', 'chr12', 'chr10']],
    ] as const) {
      const stops = await walkBreakendChain({ start, findJunctionsNear })
      expect(stops.map(s => s.refName)).toEqual(expected)
    }
  })

  it('honors maxStops, since a panel count is a viewport division', async () => {
    const stops = await walkBreakendChain({
      start: R12,
      findJunctionsNear,
      maxStops: 2,
    })
    expect(stops.map(s => s.refName)).toEqual(['chr3', 'chr10'])
  })

  it('gives the record its own two ends when nothing else is co-located', async () => {
    const stops = await walkBreakendChain({
      start: R12,
      findJunctionsNear: () => Promise.resolve([]),
    })
    expect(stops.map(s => s.refName)).toEqual(['chr3', 'chr10'])
  })
})

describe('nextJunctionFrom', () => {
  const stop = { refName: 'chr10', pos: 58_717_463 }
  const visited = [{ refName: 'chr3', pos: 25_359_567 }, stop]

  it('does not read the arrival junction as a way onward', () => {
    // Only the record we came in on is here, under both of its ids.
    expect(
      nextJunctionFrom({
        stop,
        arrivedBy: R12,
        candidates: [R12, R12_MATE],
        visited,
      }),
    ).toBeUndefined()
  })

  it('takes the one other junction at the locus', () => {
    const hop = nextJunctionFrom({
      stop,
      arrivedBy: R12,
      candidates: [R12, R12_MATE, R13],
      visited,
    })
    expect(hop?.junction.id).toBe('r_13_0')
    expect(hop?.next).toEqual({ refName: 'chr12', pos: 72_273_293 })
  })

  it('turns a junction around when the locus is its MATE end', () => {
    // R13_MATE is filed on chr12 and its mate end is the chr10 stop, so leaving
    // by it means going to chr12. A walk that only looked at `refName`/`pos`
    // would not see it at all, and a callset without reciprocal records is
    // exactly the case where only one of the two spellings exists.
    const hop = nextJunctionFrom({
      stop,
      arrivedBy: R12,
      candidates: [R13_MATE],
      visited,
    })
    expect(hop?.next).toEqual({ refName: 'chr12', pos: 72_273_293 })
  })

  it('refuses two open continuations rather than choosing one', () => {
    const other = j('x_0', 'x_1', 'chr10', 58_717_600, 'chr7', 1_000_000)
    expect(
      nextJunctionFrom({
        stop,
        arrivedBy: R12,
        candidates: [R12_MATE, R13, other],
        visited,
      }),
    ).toBeUndefined()
  })

  it('is not made ambiguous by a branch that only closes the chain', () => {
    // The closing junction of a triangle sits at the last stop alongside the one
    // genuine continuation. Counting it as a second answer would stop the walk a
    // panel early, which is how the COLO829 chain lost chr12.
    const closesBack = j('c_0', 'c_1', 'chr10', 58_717_500, 'chr3', 25_359_600)
    const hop = nextJunctionFrom({
      stop,
      arrivedBy: R12,
      candidates: [R12_MATE, R13, closesBack],
      visited,
    })
    expect(hop?.junction.id).toBe('r_13_0')
  })

  it('drops a second copy of the arrival junction with unrelated ids', () => {
    // Two callers merged, or one that writes no MATEID: the same junction is
    // present again under names the arrival ids cannot match, and only its
    // POSITION says it is the way back.
    const duplicate = j(
      'other_1',
      'other_0',
      'chr10',
      58_717_470,
      'chr3',
      25_359_560,
    )
    expect(
      nextJunctionFrom({
        stop,
        arrivedBy: R12,
        candidates: [duplicate],
        visited,
      }),
    ).toBeUndefined()
  })
})
