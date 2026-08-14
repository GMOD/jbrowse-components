import {
  connectionEndpointBps,
  readLeadingBodyDir,
  readLeadingBp,
  readTrailingBodyDir,
  readTrailingBp,
} from './readEndpoints.ts'

describe('readTrailingBp (3-prime / read-trailing edge)', () => {
  it('forward strand → end', () => {
    expect(readTrailingBp(1, 100, 200)).toBe(200)
  })
  it('reverse strand → start', () => {
    expect(readTrailingBp(-1, 100, 200)).toBe(100)
  })
})

describe('readLeadingBp (5-prime / read-leading edge)', () => {
  it('forward strand → start', () => {
    expect(readLeadingBp(1, 100, 200)).toBe(100)
  })
  it('reverse strand → end', () => {
    expect(readLeadingBp(-1, 100, 200)).toBe(200)
  })
})

// Each direction is checked AGAINST ITS OWN BP on the same segment, rather than
// against a remembered ±1: the claim is "the body lies on this side of the edge
// the partner function returned", which is the only thing a consumer drawing a
// breakend tick can rely on. A test that pinned the numbers alone would pass
// with the pair swapped.
describe('body direction agrees with the edge its partner returns', () => {
  const START = 100
  const END = 200
  it.each([1, -1])('trailing edge, strand %i', strand => {
    const edge = readTrailingBp(strand, START, END)
    const dir = readTrailingBodyDir(strand)
    expect(edge + dir * (END - START)).toBe(edge === START ? END : START)
  })
  it.each([1, -1])('leading edge, strand %i', strand => {
    const edge = readLeadingBp(strand, START, END)
    const dir = readLeadingBodyDir(strand)
    expect(edge + dir * (END - START)).toBe(edge === START ? END : START)
  })
  // A strandless feature reads as forward in both halves, so the pair still
  // agrees rather than one of them falling through to 0.
  it('strand 0 falls to the forward answer in both', () => {
    expect(readTrailingBodyDir(0)).toBe(readTrailingBodyDir(1))
    expect(readLeadingBodyDir(0)).toBe(readLeadingBodyDir(1))
  })
})

describe('connectionEndpointBps', () => {
  it('pair: both endpoints are read-trailing 3-prime edges', () => {
    expect(
      connectionEndpointBps({
        s1: 1,
        start1: 100,
        end1: 200,
        s2: -1,
        start2: 500,
        end2: 600,
        isSplit: false,
      }),
    ).toEqual({ bp1: 200, bp2: 500, dir1: -1, dir2: 1 })
  })
  it('split: endpoint 2 folds back to the next segment read-leading 5-prime edge', () => {
    // fwd→rev inversion: endpoint 2 lands on the reverse segment's end (the
    // breakpoint side), not its start.
    expect(
      connectionEndpointBps({
        s1: 1,
        start1: 100,
        end1: 200,
        s2: -1,
        start2: 500,
        end2: 600,
        isSplit: true,
      }),
    ).toEqual({ bp1: 200, bp2: 600, dir1: -1, dir2: -1 })
  })
  // The three shapes a reader is meant to tell apart from the feet alone, each
  // stated as the junction it is rather than as a pair of numbers.
  it('the breakend grammar: outward = deletion, inward = duplication, parallel = inversion', () => {
    const del = connectionEndpointBps({
      s1: 1,
      start1: 500,
      end1: 1000,
      s2: 1,
      start2: 2000,
      end2: 2500,
      isSplit: true,
    })
    expect([del.dir1, del.dir2]).toEqual([-1, 1])
    // the same two segments in the other read order — a read crossing a tandem
    // duplication's junction
    const dup = connectionEndpointBps({
      s1: 1,
      start1: 2000,
      end1: 2500,
      s2: 1,
      start2: 500,
      end2: 1000,
      isSplit: true,
    })
    expect([dup.dir1, dup.dir2]).toEqual([-1, 1])
    // …which is the same PAIR of directions, and is not a contradiction: the
    // left foot here is `dir2` and the right one `dir1`, so on screen they point
    // inward where the deletion's point outward. Sorting the two onto the two
    // sides of the mark is `arcMarkFrom`'s job, not this one's.
    expect(dup.bp1).toBeGreaterThan(dup.bp2)
    const inv = connectionEndpointBps({
      s1: 1,
      start1: 500,
      end1: 1000,
      s2: -1,
      start2: 3000,
      end2: 3500,
      isSplit: true,
    })
    expect([inv.dir1, inv.dir2]).toEqual([-1, -1])
  })
  // The direction is a property of the junction: sequencing the same molecule
  // from the other end swaps which segment is trailing AND flips both strands,
  // and the two flips cancel. This is what makes it safe on an arc several reads
  // were coalesced into.
  it('reading the same junction from the other end gives each locus the same direction', () => {
    const fwd = connectionEndpointBps({
      s1: 1,
      start1: 500,
      end1: 1000,
      s2: -1,
      start2: 3000,
      end2: 3500,
      isSplit: true,
    })
    const rev = connectionEndpointBps({
      s1: 1,
      start1: 3000,
      end1: 3500,
      s2: -1,
      start2: 500,
      end2: 1000,
      isSplit: true,
    })
    // rev's endpoint 1 is the locus fwd's endpoint 2 described, and vice versa
    expect([rev.bp1, rev.bp2]).toEqual([fwd.bp2, fwd.bp1])
    expect([rev.dir1, rev.dir2]).toEqual([fwd.dir2, fwd.dir1])
  })
})
