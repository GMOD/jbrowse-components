import { pileupDataFromSamRecords } from '../samRecordFixture.ts'
import {
  applyView,
  createTestAlignmentsDisplay,
  makeEmptyPileupData as emptyPileupData,
  oneReadWithInterchromMate,
  oneReadWithMate,
} from '../testUtils.ts'

// The breakend feet an interchromosomal arc draws: a short horizontal tick at
// each foot, lying over the ARM that foot's junction keeps.
//
// Driven through the model rather than through `computeCrossRegionArcs` directly,
// because the thing most likely to break is not the geometry — it is the chain
// from a read's strand flags to a screen direction, which crosses the producer,
// the coalescer, the region partition and the reversal. A unit test of the last
// step passes with any of the earlier ones inverted.
//
// TWO PRODUCERS REACH THAT CHAIN and they have to answer alike, which is what
// `the two evidence kinds agree` below is for. A split junction's arc endpoint
// IS the junction; a mate link's is the fragment's outer edge, a read length
// outside it with the read's body pointing back at the junction. Taking each
// read's own direction at both made an FR pair draw its feet inward — the
// grammar's "duplication" — while a split read over the identical junction drew
// them outward, in one colour, within a fragment length of each other.
//
// Every case reads the DIRECTIONS off the path rather than the coordinates: the
// arc's own placement is `crossRegionArcs.test.ts`' subject, and re-asserting it
// here would be a second, drifting statement of it.

// The MATE-LINK evidence: one paired read on ctgA whose mate is on ctgB — a
// connection that is interchromosomal by construction, and so always in the
// cross-region overlay.
function interchromDisplay({
  strand = 1,
  mateReverse = false,
  reverseSecondRegion = false,
}: {
  strand?: number
  mateReverse?: boolean
  reverseSecondRegion?: boolean
} = {}) {
  return twoContigDisplay(
    oneReadWithInterchromMate({
      mateRefName: 'ctgB',
      mateBp: 2000,
      strand,
      mateReverse,
    }),
    reverseSecondRegion,
  )
}

// Two contigs side by side, 10 kb each, showing whatever one fetch of ctgA
// found.
//
// bpPerPx 40 puts the whole 20 kb in 500 px, which is what keeps BOTH feet
// inside the 800 px band: the overlay's box is the view's width and its
// `overflow: hidden` is the clip, so a foot beyond it would be dropped from the
// picture while still appearing in `d`.
function twoContigDisplay(
  data: ReturnType<typeof oneReadWithInterchromMate>,
  reverseSecondRegion = false,
) {
  const { view, display } = createTestAlignmentsDisplay()
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
    {
      assemblyName: 'volvox',
      start: 0,
      end: 10_000,
      refName: 'ctgB',
      reversed: reverseSecondRegion,
    },
  ])
  applyView(view, 40, 0)
  display.setReadConnections('arc')
  // The mismapping floor, off. It defaults to 2 reads clustered at one
  // breakpoint, so a one-read fixture draws NOTHING — no arc and no tick — and
  // every case here would pass its assertion on an empty section list.
  display.setMinInterchromSupport(1)
  display.setRpcData(0, {
    groups: [{ key: '', label: '', data }],
  })
  // ctgB's own fetch, empty: the read scan walks the LOADED list, and the mate
  // is known here only from RNEXT/PNEXT on the ctgA record.
  display.setRpcData(1, {
    groups: [{ key: '', label: '', data: emptyPileupData() }],
  })
  display.setLoadedRegion(0, {
    refName: 'ctgA',
    start: 0,
    end: 10_000,
    assemblyName: 'volvox',
  })
  display.setLoadedRegion(1, {
    refName: 'ctgB',
    start: 0,
    end: 10_000,
    assemblyName: 'volvox',
  })
  return display
}

// The one arc a case produced, as its path's arc command plus its feet. Each
// foot is reported as the SIGN it points in, keyed by which end of the mark it
// sits on, since that is the whole content of the mark.
function feetOf(d: string) {
  const feet = [...d.matchAll(/M (-?[\d.]+) (-?[\d.]+) L (-?[\d.]+) \2/g)].map(
    m => ({ x: m[1]!, dir: Math.sign(Number(m[3]!) - Number(m[1]!)) }),
  )
  const arc = /^M (-?[\d.]+) -?[\d.]+ A [\d.]+ [\d.]+ 0 0 [01] (-?[\d.]+)/.exec(
    d,
  )
  // Matched as STRINGS off the arc command's own two endpoints, so "which foot"
  // is answered by the mark rather than by the test guessing which is left.
  const at = (x: string | undefined) => feet.find(f => f.x === x)?.dir
  return { left: at(arc?.[1]), right: at(arc?.[2]), count: feet.length }
}

function oneArcPath(display: ReturnType<typeof interchromDisplay>) {
  const sections = display.crossRegionArcSections
  expect(sections).toHaveLength(1)
  expect(sections[0]!.arcs).toHaveLength(1)
  return sections[0]!.arcs[0]!
}

test('a forward read with a reverse mate draws its feet outward', () => {
  // The ordinary FR-like pair across two contigs, which is the deletion-type
  // signature: the fragment runs off ctgA toward higher coordinates and into
  // ctgB from above, so each junction keeps the arm running AWAY from the other
  // one. Outward feet.
  //
  // The two mates read INTO the fragment, which is the opposite ray and the one
  // this used to draw — see `pairOuterDir`. It is the wrong one because a foot
  // is placed at the fragment's outer edge here and at the junction itself for a
  // split read, so answering with the read's direction makes the two families
  // disagree about the same junction.
  const d = oneArcPath(interchromDisplay({ mateReverse: true })).d
  expect(feetOf(d)).toEqual({ left: -1, right: 1, count: 2 })
})

test('and two forward reads draw them parallel', () => {
  // The same-orientation (LL) junction — the shape that distinguishes an
  // inversion-flavoured join from a deletion-flavoured one, and the reason the
  // mark exists at all: the interchromosomal colour slot has overwritten the
  // orientation colour, so nothing else in the band says these two are not an
  // ordinary pair.
  //
  // Parallel is the case that survives getting the ray backwards, since negating
  // both feet of a parallel pair is a no-op. That is exactly why it cannot be
  // the only multi-foot case here.
  const d = oneArcPath(interchromDisplay({ mateReverse: false })).d
  expect(feetOf(d)).toEqual({ left: -1, right: -1, count: 2 })
})

test('and reversing the read flips both, because the junction is the same one seen from the far end', () => {
  const fwd = feetOf(oneArcPath(interchromDisplay({ mateReverse: true })).d)
  const rev = feetOf(
    oneArcPath(interchromDisplay({ strand: -1, mateReverse: true })).d,
  )
  // Not a mirror of `fwd`: only the ctgA read turned round, so only its foot
  // moves. The mate's is where its own flag put it.
  expect(rev).toEqual({ ...fwd, left: 1 })
})

test('the two evidence kinds agree about one junction', () => {
  // The crossing test, and the one the families exist to be held against. A
  // split read and a discordant pair supporting the SAME deletion-type
  // translocation must draw the SAME feet: both are ARC_COLOR_INTERCHROM, both
  // are domes, and on a real breakpoint they land within a fragment length of
  // each other — so two answers here is two marks contradicting one another with
  // nothing in the picture saying which is which.
  //
  // They reach the answer by different routes, which is the point: the split
  // read's endpoints come from `connectionEndpointBps` at the junction itself,
  // the pair's from `pairOuterBp` at the fragment's outer edge a read length
  // away. Asserted against each other rather than against a remembered ±1, so
  // this stays a statement about agreement even if the sign convention moves.
  const pair = feetOf(oneArcPath(interchromDisplay({ mateReverse: true })).d)
  const split = feetOf(
    oneArcPath(
      twoContigDisplay(
        // ctgA:4001 forward, 200 aligned bases then 300 soft-clipped, with the
        // clipped tail aligning forward at ctgB:6001. Read order is primary then
        // supplementary (clipAtStart 0, then 200), so the junction is ctgA's
        // right edge joined to ctgB's left edge — the same arms the FR pair
        // above says are joined.
        pileupDataFromSamRecords([
          {
            name: 'splitRead',
            flag: 0,
            strand: 1,
            pos: 4001,
            CIGAR: '200M300S',
            SA: 'ctgB,6001,+,200S300M,60,0;',
          },
        ]),
      ),
    ).d,
  )
  expect(split).toEqual(pair)
  // and stated once absolutely, so a change that inverted BOTH still fails
  expect(split).toEqual({ left: -1, right: 1, count: 2 })
})

test('a reversed displayed region mirrors the foot in it and only that one', () => {
  // What `regionReversed` is for. A genomic direction is not a screen direction:
  // a reversed region — which is also how `horizontallyFlip` is implemented —
  // draws right to left, so a body extending toward higher coordinates points
  // LEFT there. Getting this wrong is invisible in an unflipped view, which is
  // every view a figure is captured in.
  const plain = feetOf(oneArcPath(interchromDisplay({ mateReverse: true })).d)
  const flipped = feetOf(
    oneArcPath(
      interchromDisplay({ mateReverse: true, reverseSecondRegion: true }),
    ).d,
  )
  // ctgB is the second region, and at these coordinates it is the right-hand
  // foot whichever way it is drawn.
  expect(flipped.left).toBe(plain.left)
  expect(flipped.right).toBe(-plain.right!)
})

test('a SAME-CHROMOSOME cross-region arc draws none', () => {
  // The control, and the reason the family is the gate rather than the overlay.
  // This arc is in the same overlay, drawn by the same code, and differs only in
  // that its colour still carries its orientation. Feet here too would appear
  // and disappear as a reader pans the identical junction across a seam;
  // interchromosomal arcs cannot, since two refNames never share a region.
  const { view, display } = createTestAlignmentsDisplay()
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 1500, refName: 'ctgA' },
    { assemblyName: 'volvox', start: 1500, end: 10_000, refName: 'ctgA' },
  ])
  applyView(view, 10, 0)
  display.setReadConnections('arc')
  display.setRpcData(0, {
    groups: [{ key: '', label: '', data: oneReadWithMate(2000) }],
  })
  display.setRpcData(1, {
    groups: [{ key: '', label: '', data: emptyPileupData() }],
  })
  display.setLoadedRegion(0, {
    refName: 'ctgA',
    start: 0,
    end: 1500,
    assemblyName: 'volvox',
  })
  display.setLoadedRegion(1, {
    refName: 'ctgA',
    start: 1500,
    end: 10_000,
    assemblyName: 'volvox',
  })
  const arcs = display.crossRegionArcSections[0]!.arcs
  expect(arcs).toHaveLength(1)
  expect(feetOf(arcs[0]!.d).count).toBe(0)
})

test('the hover highlight traces the feet too', () => {
  // The half that drifts if the feet are appended to `d` by the overlay instead
  // of living in the mark: `ArcHoverOverlay` re-traces `arc.mark` at its own
  // origin, so a foot the mark does not carry is a highlight that stops at the
  // curve while the ink under it has two ticks on the end.
  const arc = oneArcPath(interchromDisplay({ mateReverse: true }))
  expect(arc.mark.kind).toBe('dome')
  expect(feetOf(arc.d).count).toBe(2)
})
