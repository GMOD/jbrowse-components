import {
  applyView,
  createTestAlignmentsDisplay,
  makeEmptyPileupData as emptyPileupData,
  oneReadWithInterchromMate,
  oneReadWithMate,
} from '../testUtils.ts'

// The breakend feet an interchromosomal arc draws: a short horizontal tick at
// each foot, lying over the sequence that foot's aligned body occupies.
//
// Driven through the model rather than through `computeCrossRegionArcs` directly,
// because the thing most likely to break is not the geometry — it is the chain
// from a read's strand flags to a screen direction, which crosses the producer,
// the coalescer, the region partition and the reversal. A unit test of the last
// step passes with any of the earlier ones inverted.
//
// Every case reads the DIRECTIONS off the path rather than the coordinates: the
// arc's own placement is `crossRegionArcs.test.ts`' subject, and re-asserting it
// here would be a second, drifting statement of it.

// Two contigs side by side, 10 kb each, with one paired read on the first whose
// mate is on the second — the connection that is interchromosomal by
// construction, and so always in the cross-region overlay.
//
// bpPerPx 40 puts the whole 20 kb in 500 px, which is what keeps BOTH feet
// inside the 800 px band: the overlay's box is the view's width and its
// `overflow: hidden` is the clip, so a foot beyond it would be dropped from the
// picture while still appearing in `d`.
function interchromDisplay({
  strand = 1,
  mateReverse = false,
  reverseSecondRegion = false,
}: {
  strand?: number
  mateReverse?: boolean
  reverseSecondRegion?: boolean
} = {}) {
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
    groups: [
      {
        key: '',
        label: '',
        data: oneReadWithInterchromMate({
          mateRefName: 'ctgB',
          mateBp: 2000,
          strand,
          mateReverse,
        }),
      },
    ],
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

test('a forward read with a reverse mate draws its feet inward', () => {
  // The ordinary FR-like pair across two contigs: each mate reads INTO the
  // fragment, so each body lies on the side of its own breakend nearer the
  // other one. Inward feet.
  const d = oneArcPath(interchromDisplay({ mateReverse: true })).d
  expect(feetOf(d)).toEqual({ left: 1, right: -1, count: 2 })
})

test('and two forward reads draw them parallel', () => {
  // Both bodies run toward higher coordinates, which is the same-orientation
  // (LL) junction — the shape that distinguishes an inversion-flavoured join
  // from a deletion-flavoured one, and the reason the mark exists at all: the
  // interchromosomal colour slot has overwritten the orientation colour, so
  // nothing else in the band says these two are not an ordinary pair.
  const d = oneArcPath(interchromDisplay({ mateReverse: false })).d
  expect(feetOf(d)).toEqual({ left: 1, right: 1, count: 2 })
})

test('and reversing the read flips both, because the junction is the same one seen from the far end', () => {
  const fwd = feetOf(oneArcPath(interchromDisplay({ mateReverse: true })).d)
  const rev = feetOf(
    oneArcPath(interchromDisplay({ strand: -1, mateReverse: true })).d,
  )
  // Not a mirror of `fwd`: only the ctgA read turned round, so only its foot
  // moves. The mate's is where its own flag put it.
  expect(rev).toEqual({ ...fwd, left: -1 })
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
