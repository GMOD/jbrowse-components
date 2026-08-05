import {
  derivativeOffsets,
  projectReadsOntoDerivative,
} from './projectReads.ts'

import type { NamedReadChain, SegAln } from '../arcs/compute.ts'
import type { DerivativeSegment } from './computePaths.ts'

function seg(
  refName: string,
  start: number,
  end: number,
  strand: number,
  clipAtStart: number,
  onScreen = true,
): SegAln {
  return { refName, start, end, strand, clipAtStart, onScreen }
}

// A path with one of everything: a forward segment, a short forward insert, an
// inverted insert, and a second copy of the first chromosome traversed backwards
// — the foldback shape, so nothing here can be placed by refName alone.
const PATH: DerivativeSegment[] = [
  { refName: 'chrA', start: 1000, end: 3000, strand: 1 },
  { refName: 'chrB', start: 500, end: 600, strand: 1 },
  { refName: 'chrC', start: 100, end: 200, strand: -1 },
  { refName: 'chrA', start: 2000, end: 2800, strand: -1 },
]

// The read a path-following molecule produces: every segment of the path, in
// order, in the orientation the path traverses it.
function followingChain(): SegAln[] {
  return [
    seg('chrA', 1000, 3000, 1, 0),
    seg('chrB', 500, 600, 1, 2000),
    seg('chrC', 100, 200, -1, 2100),
    seg('chrA', 2000, 2800, -1, 2200),
  ]
}

function project(chains: NamedReadChain[], tolerance?: number) {
  return projectReadsOntoDerivative({ segments: PATH, chains, tolerance })
}

function one(chain: SegAln[], tolerance?: number) {
  return project([{ readName: 'read', chain }], tolerance)[0]
}

describe('derivativeOffsets', () => {
  it('is a prefix sum ending in the allele’s length', () => {
    expect(derivativeOffsets(PATH)).toEqual([0, 2000, 2100, 2200, 3000])
  })

  it('is empty-safe', () => {
    expect(derivativeOffsets([])).toEqual([0])
  })
})

describe('projectReadsOntoDerivative', () => {
  it('lays a path-following read out as one unbroken run', () => {
    const read = one(followingChain())!
    expect(read.followsPath).toBe(true)
    expect(read.maxGap).toBe(0)
    expect(read.unplacedCount).toBe(0)
    expect(read.pieces.map(piece => [piece.start, piece.end])).toEqual([
      [0, 2000],
      [2000, 2100],
      [2100, 2200],
      [2200, 3000],
    ])
    expect(read.start).toBe(0)
    expect(read.end).toBe(3000)
  })

  it('flips an inverted segment’s coordinates, not just its arrow', () => {
    // The read enters chrC at its HIGH reference coordinate, because the path
    // traverses that segment backwards. Mapping the interval without flipping it
    // would put the read on the right segment at the wrong end of it, which is
    // the failure that looks correct at a whole-allele zoom.
    const read = one([
      seg('chrC', 150, 200, -1, 0),
      seg('chrA', 2000, 2800, -1, 50),
    ])!
    expect(read.pieces[0]).toMatchObject({
      start: 2100,
      end: 2150,
      strand: 1,
      refStart: 150,
      refEnd: 200,
    })
  })

  it('reads a molecule sequenced the other way round the same way', () => {
    // Same molecule, sequenced from its other end: the chain arrives reversed
    // and every strand flipped. It has to land in the same place — an allele and
    // its reverse complement are one molecule — with the read itself marked as
    // running the other way.
    const forward = one(followingChain())!
    const reverse = one(
      [...followingChain()].reverse().map(s => ({ ...s, strand: -s.strand })),
    )!
    expect(reverse.followsPath).toBe(true)
    expect(reverse.strand).toBe(-1)
    expect(forward.strand).toBe(1)
    expect(reverse.pieces.map(piece => [piece.start, piece.end])).toEqual(
      forward.pieces.map(piece => [piece.start, piece.end]),
    )
  })

  it('tells the two copies of a foldback apart by orientation', () => {
    // Both chrA arms overlap both chrA segments of the path, so refName and
    // position cannot say which copy either belongs to. Only the direction each
    // is read in can, and getting it wrong draws a foldback as a read that
    // doubles back on itself.
    const read = one(followingChain())!
    expect(read.pieces.map(piece => piece.segmentIndex)).toEqual([0, 1, 2, 3])
  })

  it('counts a segment the path does not contain rather than dropping it', () => {
    const read = one([
      seg('chrA', 1000, 3000, 1, 0),
      seg('chrZ', 90_000, 91_000, 1, 2000),
    ])!
    expect(read.unplacedCount).toBe(1)
    expect(read.pieces).toHaveLength(1)
    expect(read.followsPath).toBe(false)
  })

  it('leaves a read that touches the path nowhere off the picture', () => {
    expect(
      project([
        {
          readName: 'elsewhere',
          chain: [seg('chrZ', 0, 100, 1, 0), seg('chrZ', 5000, 5100, 1, 100)],
        },
      ]),
    ).toEqual([])
  })

  it('clips a read at the edges of the allele it is drawn against', () => {
    // A read sequenced past the outermost junction is not evidence about
    // anything beyond it, and the axis it is drawn on stops there.
    const read = one([
      seg('chrA', 0, 3000, 1, 0),
      seg('chrB', 400, 700, 1, 3000),
    ])!
    expect(read.start).toBe(0)
    expect(read.pieces[0]!.refStart).toBe(1000)
    expect(read.pieces[1]!.end).toBe(2100)
  })

  it('reports how far a read misses by, and calls it broken past the tolerance', () => {
    // Skips the chrC insert: chrB is followed straight by the second chrA arm,
    // so the read is short by exactly that segment.
    const chain = [
      seg('chrA', 1000, 3000, 1, 0),
      seg('chrB', 500, 600, 1, 2000),
      seg('chrA', 2000, 2800, -1, 2100),
    ]
    expect(one(chain, 50)!.maxGap).toBe(100)
    expect(one(chain, 50)!.followsPath).toBe(false)
    // ...and a tolerance wide enough to swallow the missing segment says so,
    // which is the knob doing what it says rather than a second rule.
    expect(one(chain, 150)!.followsPath).toBe(true)
  })

  it('scores a fit by pieces placed, not by bases covered', () => {
    // A read whose long arm is the one the path revisits. Read the wrong way
    // round, that arm lands whole on the first segment (1800 bp) and the rest of
    // the read falls off the path; read the right way round, all four pieces
    // land but the long arm is clipped to the shorter second copy, for 1100 bp.
    // So a bases-weighted score prefers a 2-of-4 fit to a 4-of-4 one — which is
    // not a synthetic curiosity: it picks the wrong reading of every supporting
    // read of COLO829's der(3), where that arm is 30 kb.
    const read = one([
      seg('chrA', 1000, 2800, 1, 0),
      seg('chrC', 100, 200, 1, 1800),
      seg('chrB', 500, 600, -1, 1900),
      seg('chrA', 2900, 3000, -1, 2000),
    ])!
    expect(read.pieces).toHaveLength(4)
    expect(read.followsPath).toBe(true)
    expect(read.strand).toBe(-1)
    expect(read.pieces.map(piece => piece.segmentIndex)).toEqual([0, 1, 2, 3])
  })

  it('keeps two adjacent segments of one read on one path segment', () => {
    // A small deletion inside a segment is not a departure from the allele: the
    // read stays on the same segment and the gap says how big the deletion is.
    const read = one([
      seg('chrA', 1000, 1500, 1, 0),
      seg('chrA', 1520, 3000, 1, 500),
    ])!
    expect(read.pieces.map(piece => piece.segmentIndex)).toEqual([0, 0])
    expect(read.maxGap).toBe(20)
    expect(read.followsPath).toBe(true)
  })

  it('names every read it places', () => {
    const projected = project([
      { readName: 'r1', chain: followingChain() },
      { readName: 'r2', chain: followingChain() },
    ])
    expect(projected.map(read => read.readName)).toEqual(['r1', 'r2'])
  })

  it('carries the off-screen flag through to the piece', () => {
    // A segment known only from an SA tag is the normal case for the far side of
    // an interchromosomal junction, and a caller may want to draw it differently
    // from one it actually fetched.
    const read = one([
      seg('chrA', 1000, 3000, 1, 0),
      seg('chrB', 500, 600, 1, 2000, false),
    ])!
    expect(read.pieces.map(piece => piece.onScreen)).toEqual([true, false])
  })
})
