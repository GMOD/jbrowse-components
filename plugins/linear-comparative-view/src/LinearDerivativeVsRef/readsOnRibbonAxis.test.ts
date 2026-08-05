import { projectReadsOntoDerivative } from '@jbrowse/plugin-alignments'

import { buildDerivativeVsRefSpec } from './buildDerivativeVsRefSpec.ts'

import type {
  DerivativeCandidate,
  ProjectedRead,
} from '@jbrowse/plugin-alignments'

// One invariant, spanning two packages: a read placed on the allele has to land
// exactly where the ribbon it belongs to says its reference interval goes.
//
// The two sides share `derivativeOffsets`, so where a segment BEGINS cannot
// drift. Where a reference base lands INSIDE one is spelled twice — once by
// `clipToSegment` in plugin-alignments, once by the synteny feature's own
// start/end/mate/strand here — and those two can disagree on a reversed segment,
// where one runs the interval backwards and the other does not. The result is a
// read drawn at the wrong END of the right segment: correct at a whole-allele
// zoom, wrong everywhere that matters, and invisible to either side's own tests.
//
// It lives in its own file because it belongs to neither module. Asserting it
// inside `buildDerivativeVsRefSpec.test.ts` invites the fixture it needs — a
// really projected read — to be replaced by hand-written pieces, which is what
// it is here to avoid: hand-written pieces test the builder against a
// transcription of the answer rather than against the other implementation.

// The COLO829 der(3) path: two chr3 arms in opposite orientations with short
// pieces of chr10 and chr12 spliced in at the turn. Segments 2 and 3 are the
// reversed ones, and are the whole point of the fixture.
const CANDIDATE: DerivativeCandidate = {
  segments: [
    { refName: 'chr3', start: 25_326_821, end: 25_359_568, strand: 1 },
    { refName: 'chr10', start: 58_717_463, end: 58_717_662, strand: 1 },
    { refName: 'chr12', start: 72_273_111, end: 72_273_294, strand: -1 },
    { refName: 'chr3', start: 25_352_683, end: 25_359_111, strand: -1 },
  ],
  readCount: 29,
  locString: '',
  refNames: ['chr3', 'chr10', 'chr12'],
  extendsOffScreen: false,
}

interface Ribbon {
  syntenyId: number
  start: number
  end: number
  strand: number
  mate: { start: number; end: number }
}

// A molecule that crosses the whole allele: every segment of the path, in path
// order, traversed the way the path traverses it.
//
// Each piece covers its segment PARTIALLY and ASYMMETRICALLY, which is the only
// thing that makes this file worth running. A piece covering a whole segment
// maps to the same derivative interval whether the segment is read forwards or
// backwards — both come out as the segment's entire slot — so a fixture of
// whole-segment reads asserts the invariant vacuously on exactly the reversed
// segments it exists to check. Trimming both edges by the SAME amount is vacuous
// for the same reason. The trims stay under the projection's 100 bp tolerance so
// the read still reads as following the path.
const LEAD = 30
const TRAIL = 10

function pathFollowingChain() {
  return CANDIDATE.segments.map((seg, i) => ({
    refName: seg.refName,
    start: seg.start + LEAD,
    end: seg.end - TRAIL,
    strand: seg.strand === -1 ? -1 : 1,
    clipAtStart: i * 100,
    onScreen: true,
  }))
}

function ribbonsFor(candidate: DerivativeCandidate, read: ProjectedRead) {
  const { viewSpec } = buildDerivativeVsRefSpec({
    candidate,
    trackAssembly: 'hg38',
    viewWidth: 1000,
    sequenceTrackConf: { trackId: 'hg38-ReferenceSequenceTrack' },
    projectedReads: [read],
    now: () => 1234,
    rand: () => 1,
  })
  return (viewSpec.viewTrackConfigs[0] as { adapter: { features: Ribbon[] } })
    .adapter.features
}

// Where a ribbon itself puts a reference interval, read off the emitted feature
// rather than recomputed from the segment list — so this is the synteny track's
// own account of the mapping, not a second copy of the projection's.
function ribbonPlaces(ribbon: Ribbon, refStart: number, refEnd: number) {
  return ribbon.strand === -1
    ? [
        ribbon.mate.start + (ribbon.end - refEnd),
        ribbon.mate.start + (ribbon.end - refStart),
      ]
    : [
        ribbon.mate.start + (refStart - ribbon.start),
        ribbon.mate.start + (refEnd - ribbon.start),
      ]
}

describe('a projected read against the ribbons it is drawn beside', () => {
  it('lands where its own ribbon says its reference interval goes', () => {
    const [read] = projectReadsOntoDerivative({
      segments: CANDIDATE.segments,
      chains: [{ readName: 'real', chain: pathFollowingChain() }],
    })
    expect(read!.followsPath).toBe(true)
    expect(read!.pieces).toHaveLength(CANDIDATE.segments.length)

    const ribbons = ribbonsFor(CANDIDATE, read!)
    for (const piece of read!.pieces) {
      const ribbon = ribbons.find(f => f.syntenyId === piece.segmentIndex)!
      expect([piece.start, piece.end]).toEqual(
        ribbonPlaces(ribbon, piece.refStart, piece.refEnd),
      )
    }
  })

  it('would notice a reversed segment mapped as if it were forward', () => {
    // The check above is only worth its runtime if the two formulas actually
    // differ on the segments it covers. They do — but only on the reversed ones,
    // which is why a fixture of forward segments would pass it while placing
    // every inverted read at the wrong end of its arm.
    const [read] = projectReadsOntoDerivative({
      segments: CANDIDATE.segments,
      chains: [{ readName: 'real', chain: pathFollowingChain() }],
    })
    const ribbons = ribbonsFor(CANDIDATE, read!)
    const reversed = read!.pieces.filter(
      piece => CANDIDATE.segments[piece.segmentIndex]!.strand === -1,
    )
    expect(reversed.length).toBeGreaterThan(0)
    for (const piece of reversed) {
      const ribbon = ribbons.find(f => f.syntenyId === piece.segmentIndex)!
      const asIfForward = [
        ribbon.mate.start + (piece.refStart - ribbon.start),
        ribbon.mate.start + (piece.refEnd - ribbon.start),
      ]
      expect([piece.start, piece.end]).not.toEqual(asIfForward)
    }
  })
})
