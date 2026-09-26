import { recordPath } from '@jbrowse/render-core/marks'
import { canvasWideBlock } from '@jbrowse/render-core/renderBlock'

import { ARC_LINK_MARKS } from '../renderers/arcMarks.ts'
import { pileupDataFromSamRecords } from '../samRecordFixture.ts'
import {
  applyView,
  createTestAlignmentsDisplay,
  makeEmptyPileupData as emptyPileupData,
  oneReadWithInterchromMate,
  oneReadWithMate,
} from '../testUtils.ts'
import { resolveArcBandHover } from './arcHitTest.ts'

// The breakend feet an interchromosomal arc draws: a short horizontal tick at
// each foot, lying over the ARM that foot's junction keeps.
//
// Driven through the model and the band's own link mark, because the thing
// most likely to break is not the geometry — it is the chain from a read's
// strand flags to a screen direction, which crosses the producer, the
// coalescer, the region partition, the feed and the reversal. A unit test of
// the last step passes with any of the earlier ones inverted.
//
// TWO PRODUCERS REACH THAT CHAIN and they have to answer alike, which is what
// `the two evidence kinds agree` below is for. A split junction's arc endpoint
// IS the junction; a mate link's is the fragment's outer edge, a read length
// outside it with the read's body pointing back at the junction. Taking each
// read's own direction at both made an FR pair draw its feet inward — the
// grammar's "duplication" — while a split read over the identical junction drew
// them outward, in one colour, within a fragment length of each other.
//
// Every case reads the DIRECTIONS off the painted feet rather than the
// coordinates: the arc's own placement is `crossRegionArcs.test.ts`' subject.

// The MATE-LINK evidence: one paired read on ctgA whose mate is on ctgB — a
// connection that is interchromosomal by construction, and so always
// cross-region.
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
// bpPerPx 40 puts the whole 20 kb in 500 px, so both feet are on screen.
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
  display.setRpcData(
    0,
    {
      groups: [{ key: '', label: '', data }],
    },
    {
      refName: 'ctgA',
      start: 0,
      end: 10_000,
      assemblyName: 'volvox',
    },
  )
  // ctgB's own fetch, empty: the read scan walks the LOADED list, and the mate
  // is known here only from RNEXT/PNEXT on the ctgA record.
  display.setRpcData(
    1,
    {
      groups: [{ key: '', label: '', data: emptyPileupData() }],
    },
    {
      refName: 'ctgB',
      start: 0,
      end: 10_000,
      assemblyName: 'volvox',
    },
  )
  return display
}

// The horizontal segments in a recorded path: a foot is a moveTo and one
// lineTo at the same y.
function feetIn(d: string) {
  return [...d.matchAll(/M(-?[\d.e]+) (-?[\d.e]+)L(-?[\d.e]+) \2(?=M|$)/g)].map(
    m => ({
      x: Number(m[1]),
      dir: Math.sign(Number(m[3]) - Number(m[1])),
    }),
  )
}

// The feet the one arc a case produced paints, through the band's arc mark:
// each foot as the SIGN it points in, left and right by where it starts, since
// that is the whole content of the mark.
function paintedArc(display: ReturnType<typeof interchromDisplay>) {
  const feeds = display.sourceSections[0]!.arcFeeds
  const owners = [...feeds].filter(([, feed]) => feed.links.count > 0)
  expect(owners).toHaveLength(1)
  const [regionIdx, feed] = owners[0]!
  expect(feed.links.count).toBe(1)
  const { renderState } = display
  const arcBand = renderState.sections[0]!.arcBand!
  const recorder = recordPath()
  ARC_LINK_MARKS[1]!.paintBlock(
    recorder.ctx,
    feed,
    canvasWideBlock(regionIdx, renderState.canvasWidth),
    { ...renderState, arcBand },
  )
  return recorder.d
}

function feetStarts(display: ReturnType<typeof interchromDisplay>) {
  return feetIn(paintedArc(display))
    .map(f => f.x)
    .sort((a, b) => a - b)
}

function oneArcFeet(display: ReturnType<typeof interchromDisplay>) {
  const feet = feetIn(paintedArc(display)).sort((a, b) => a.x - b.x)
  return feet.length === 2
    ? { left: feet[0]!.dir, right: feet[1]!.dir, count: 2 }
    : { left: undefined, right: undefined, count: feet.length }
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
  const feet = oneArcFeet(interchromDisplay({ mateReverse: true }))
  expect(feet).toEqual({ left: -1, right: 1, count: 2 })
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
  expect(oneArcFeet(interchromDisplay({ mateReverse: false }))).toEqual({
    left: -1,
    right: -1,
    count: 2,
  })
})

test('and reversing the read flips both, because the junction is the same one seen from the far end', () => {
  const fwd = oneArcFeet(interchromDisplay({ mateReverse: true }))
  const rev = oneArcFeet(interchromDisplay({ strand: -1, mateReverse: true }))
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
  const pair = oneArcFeet(interchromDisplay({ mateReverse: true }))
  const split = oneArcFeet(
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
  )
  expect(split).toEqual(pair)
  // and stated once absolutely, so a change that inverted BOTH still fails
  expect(split).toEqual({ left: -1, right: 1, count: 2 })
})

test('a reversed displayed region mirrors the foot in it and only that one', () => {
  // A genomic direction is not a screen direction: a reversed region — which is
  // also how `horizontallyFlip` is implemented — draws right to left, so a body
  // extending toward higher coordinates points LEFT there. Getting this wrong
  // is invisible in an unflipped view, which is every view a figure is captured
  // in.
  const plain = oneArcFeet(interchromDisplay({ mateReverse: true }))
  const flipped = oneArcFeet(
    interchromDisplay({ mateReverse: true, reverseSecondRegion: true }),
  )
  // ctgB is the second region, and at these coordinates it is the right-hand
  // foot whichever way it is drawn.
  expect(flipped.left).toBe(plain.left)
  expect(flipped.right).toBe(-plain.right!)
})

test('a SAME-CHROMOSOME cross-region arc draws none', () => {
  // The control, and the reason the family is the gate. This arc crosses the
  // same kind of seam and differs only in that its colour still carries its
  // orientation. Feet here too would appear and disappear as a reader pans the
  // identical junction across a seam; interchromosomal arcs cannot, since two
  // refNames never share a region.
  const { view, display } = createTestAlignmentsDisplay()
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 1500, refName: 'ctgA' },
    { assemblyName: 'volvox', start: 1500, end: 10_000, refName: 'ctgA' },
  ])
  applyView(view, 10, 0)
  display.setReadConnections('arc')
  display.setRpcData(
    0,
    {
      groups: [{ key: '', label: '', data: oneReadWithMate(2000) }],
    },
    {
      refName: 'ctgA',
      start: 0,
      end: 1500,
      assemblyName: 'volvox',
    },
  )
  display.setRpcData(
    1,
    {
      groups: [{ key: '', label: '', data: emptyPileupData() }],
    },
    {
      refName: 'ctgA',
      start: 1500,
      end: 10_000,
      assemblyName: 'volvox',
    },
  )
  expect(oneArcFeet(display).count).toBe(0)
})

test('the hover highlight traces the feet too', () => {
  // The hover traces the arc through the mark's own painter, so a foot the
  // mark paints is a foot the highlight carries.
  const display = interchromDisplay({ mateReverse: true })
  const { renderState } = display
  const arcBand = renderState.sections[0]!.arcBand!
  const footY = arcBand.down
    ? arcBand.top + 1
    : arcBand.top + arcBand.height - 1
  const hover = resolveArcBandHover(
    feetStarts(display)[0]! - 8,
    footY,
    display.sourceSections[0]!.arcFeeds,
    { ...renderState, arcBand },
    display.renderBlocks,
  )
  expect(hover?.hit.kind).toBe('arc')
  expect(feetIn(hover!.highlight.d)).toHaveLength(2)
})
