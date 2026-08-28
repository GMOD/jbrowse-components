import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// Clicking an off-screen mate mark is the only thing in the view that navigates
// a row on the user's behalf, and it was written inside the canvas component's
// pointerup — reachable only by rendering a WebGL band in jsdom, which is to
// say not reachable. It lives on the level now, so what a click does can be
// asked directly.
//
// The hit test is `offscreenMateStrip.test.ts`'s; this is the other half, and
// the half with a consequence: `navToLocString` REPLACES the row's displayed
// regions, so getting the row wrong silently rewrites the wrong axis.

// Big enough that a locus is a small part of it — the whole point of the
// coordinates is that they narrow the row, and a contig the size of the minimum
// window could not show the difference.
const BP = 400_000

function assembly(name: string, refNames: string[]) {
  return {
    name,
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: `${name}_refseq`,
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: refNames.map(refName => ({
          refName,
          uniqueId: `${name}-${refName}`,
          start: 0,
          end: BP,
          seq: 'a'.repeat(BP),
        })),
      },
    },
  }
}

async function setup() {
  const session = createTestSession() as any
  // two contigs on each, one shown per row: ctgB is the contig the marks on
  // either edge of the band point at
  session.addAssemblyConf(assembly('volvox', ['ctgA', 'ctgB']))
  session.addAssemblyConf(assembly('volvox2', ['ctgA', 'ctgB']))
  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [
        { assembly: 'volvox', loc: 'ctgA' },
        { assembly: 'volvox2', loc: 'ctgA' },
      ],
    },
  }) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(() => view.init === undefined)
  return { session, view, level: view.levels[0]! }
}

function refNames(view: LinearSyntenyViewModel, row: number) {
  return view.views[row]!.displayedRegions.map(r => r.refName)
}

test('a query-axis mark shows its contig on the row below the level', async () => {
  const { view, level } = await setup()

  level.showOffscreenMateContig('ctgB', level.level + 1)
  await when(() => refNames(view, 1).join(',') === 'ctgB', { timeout: 5000 })

  // and only that row: the query row is where the marks were measured, so
  // rewriting it would move every mark out from under the pointer that clicked
  expect(refNames(view, 0)).toEqual(['ctgA'])
}, 20000)

// The mirror, which is why the row is an argument rather than `level + 1`: a
// mark on the target axis names a contig the row ABOVE is not displaying, and
// navigating the row below for it would move the wrong genome.
test('a target-axis mark shows its contig on the row above the level', async () => {
  const { view, level } = await setup()

  level.showOffscreenMateContig('ctgB', level.level)
  await when(() => refNames(view, 0).join(',') === 'ctgB', { timeout: 5000 })

  expect(refNames(view, 1)).toEqual(['ctgA'])
}, 20000)

// A refName that resolves to nothing is ordinary here — the mate names come out
// of an alignment file, and an assembly can be missing the contig one of them
// points at. It has to reach the user as a notification rather than as an
// unhandled rejection in a pointer handler.
test('a contig the row cannot resolve is reported, not thrown', async () => {
  const { session, view, level } = await setup()

  level.showOffscreenMateContig('nope', level.level + 1)
  await when(() => session.snackbarMessages.length > 0, { timeout: 5000 })

  expect(session.snackbarMessages[0]!.level).toBe('error')
  expect(refNames(view, 1)).toEqual(['ctgA'])
}, 20000)

// A mate name that is not a refName here but PREFIX-matches several goes to the
// text search, which raises a picker over the hits and navigates nothing — and
// resolves, so awaiting it says nothing. Ordinary for a PAF naming contigs
// `1`,`2` against an assembly spelling them `chr1`,`chr2`. Reported as a move it
// posted "Showing ctg, and following this row" with a live Undo over a stack
// nothing had touched; the picker is the feedback, so the click says nothing.
test('a mate name that opens a picker is not reported as a move', async () => {
  const { session, view, level } = await setup()

  level.showOffscreenMateContig('ctg', level.level + 1)
  await when(() => session.queueOfDialogs.length > 0, { timeout: 5000 })

  expect(refNames(view, 1)).toEqual(['ctgA'])
  expect(session.snackbarMessages).toEqual([])
}, 20000)

// The mark's own coordinates, which is the whole reason the payload carries
// them: a bare refName is a whole chromosome, so a click meant to answer "what
// is over there" used to answer it by zooming out past everything else. `grow`
// puts context around the locus rather than framing it exactly.
test('a mark with a mate locus shows that locus, not the whole contig', async () => {
  const { view, level } = await setup()

  level.showOffscreenMateContig('ctgB', level.level + 1, {
    locus: { start: 200_000, end: 201_000 },
  })
  await when(() => refNames(view, 1).join(',') === 'ctgB', { timeout: 5000 })

  // the row still DISPLAYS the whole contig — `navToLocString` sets the region
  // set and then frames the locus in it — so what has to be checked is the
  // window, which is what a reader sees
  const [visible] = view.views[1]!.dynamicBlocks.contentBlocks
  expect(visible!.start).toBeGreaterThan(150_000)
  expect(visible!.end).toBeLessThan(250_000)
}, 20000)

// ...and not framed exactly. A single small anchor is an ordinary thing to
// click, and its own span can be a few hundred bp: shown as itself the row lands
// at sequence zoom with nothing around the alignment to read it against, which
// is the same failure as the whole chromosome from the other end.
test('a locus narrower than the floor is widened around itself', async () => {
  const { view, level } = await setup()

  level.showOffscreenMateContig('ctgB', level.level + 1, {
    locus: { start: 200_000, end: 200_500 },
  })
  await when(() => refNames(view, 1).join(',') === 'ctgB', { timeout: 5000 })

  const [visible] = view.views[1]!.dynamicBlocks.contentBlocks
  expect(visible!.end - visible!.start).toBeGreaterThanOrEqual(20_000)
  // and still centred on what was clicked
  expect((visible!.start + visible!.end) / 2).toBeGreaterThan(190_000)
  expect((visible!.start + visible!.end) / 2).toBeLessThan(210_000)
}, 20000)

// `navToLocString` REPLACES the row's regions, so what the click discards may be
// a region list built over several navigations. "Show all regions" is a
// different destination, not an undo.
test('the navigation offers an undo that restores what the row was showing', async () => {
  const { session, view, level } = await setup()
  const before = view.views[1]!.bpPerPx

  level.showOffscreenMateContig('ctgB', level.level + 1, {
    locus: { start: 200_000, end: 201_000 },
  })
  await when(() => session.snackbarMessages.length > 0, { timeout: 5000 })

  const [action] = session.snackbarMessages[0]!.actions!
  expect(action!.name).toBe('Undo')
  action!.onClick()

  expect(refNames(view, 1)).toEqual(['ctgA'])
  expect(view.views[1]!.bpPerPx).toBe(before)
}, 20000)

// The anchor is a persisted view-wide setting, and with the follow OFF this
// click does not touch it — so neither may the undo. Writing it back
// unconditionally re-pointed the anchor at whichever row a mark was last
// clicked on, invisibly, until someone turned the mode on and found the stack
// following the wrong row.
//
// The anchor is MOVED between the click and the undo, which is the only shape
// that can tell "put back what this click took" apart from "put back whatever
// was there": with it left alone, restoring unconditionally writes the value it
// already holds and the two are indistinguishable.
test('with the follow off, the undo leaves the anchor row alone', async () => {
  const { session, view, level } = await setup()
  expect(view.followAnchorIndex).toBe(0)

  // row 1, which is not the anchor — so an undo that wrote the anchor back
  // unconditionally would have to write something, and the only thing it had
  // was the row it just navigated
  level.showOffscreenMateContig('ctgB', 1, {
    locus: { start: 200_000, end: 201_000 },
  })
  await when(() => session.snackbarMessages.length > 0, { timeout: 5000 })

  view.setFollowAnchorIndex(1)
  const [action] = session.snackbarMessages[0]!.actions!
  action!.onClick()

  expect(view.followAnchorIndex).toBe(1)
}, 20000)

// The other half of the same rule. With the follow ON a mark clicked on a row
// that is not the anchor TAKES the anchor — the follow propagates away from it,
// so a row navigated while another holds it is a row the next pass pulls back —
// and the undo is what gives that back.
test('with the follow on, the undo gives back the anchor the click took', async () => {
  const { session, view, level } = await setup()
  view.setRowSyncMode('follow')
  view.setFollowAnchorIndex(1)

  level.showOffscreenMateContig('ctgB', 0, {
    locus: { start: 200_000, end: 201_000 },
  })
  await when(() => session.snackbarMessages.length > 0, { timeout: 5000 })
  expect(view.followAnchorIndex).toBe(0)

  const [action] = session.snackbarMessages[0]!.actions!
  action!.onClick()

  expect(view.followAnchorIndex).toBe(1)
}, 20000)

// The take happens BEFORE the navigation, and a navigation is a thing that
// fails: an unresolvable contig is ordinary here. Only a landed one raises the
// snackbar carrying the undo, so a failed one that kept the anchor moved it
// permanently and silently — onto whichever row a mark was clicked on, dragging
// every other row onto it.
test('a navigation that fails does not keep the anchor it took', async () => {
  const { session, view, level } = await setup()
  view.setRowSyncMode('follow')
  expect(view.followAnchorIndex).toBe(0)

  level.showOffscreenMateContig('nope', 1, {
    locus: { start: 200_000, end: 201_000 },
  })
  await when(() => session.snackbarMessages.length > 0, { timeout: 5000 })

  expect(session.snackbarMessages[0]!.level).toBe('error')
  expect(view.followAnchorIndex).toBe(0)
}, 20000)

// The other class of mark, and the one with no coverage here until this: the
// facing row DISPLAYS the contig and has merely scrolled off it, so the click
// scrolls to the mate instead of replacing what the row is showing. It is also
// the class that dominates, because stacked whole assemblies are what produce
// these marks in the first place (`culledRibbonMates`).
async function scrollableSetup() {
  const { session, view, level } = await setup()
  const row = view.views[1]!
  row.showAllRegionsInAssembly()
  // a 40kb window parked at the start of ctgA, so the mate is 600kb away —
  // fifteen screens, which is a flight with a middle rather than a nudge
  row.setWindow(40_000, 0)
  return { session, view, level, row }
}

// The linearized bp of ctgB:200,500 — ctgA runs first and is BP long
const MATE_CENTER_BP = BP + 200_500

test('a contig the row already displays is scrolled to, not navigated to', async () => {
  const { view, level, row } = await scrollableSetup()

  level.showOffscreenMateContig('ctgB', 1, {
    locus: { start: 200_000, end: 201_000 },
    mateCumBp: { start: BP + 200_000, end: BP + 201_000 },
  })
  await when(
    () => row.windowStartBp === MATE_CENTER_BP - row.windowWidthBp / 2,
    { timeout: 5000 },
  )

  // the whole point of the branch: every other contig of the row survives the
  // click, where `navToLocString` would have discarded them
  expect(refNames(view, 1)).toEqual(['ctgA', 'ctgB'])
  // and it arrives at the zoom it left on, however far the arc pulled back
  expect(row.windowWidthBp).toBe(40_000)
})

// The linearized bp of ctgB:350,000 — where a clipped block's ribbons are drawn
const DRAWN_CENTER_BP = BP + 350_000

// WHERE THE RIBBONS ARE, NOT WHERE THE BLOCK IS. `clipLargeBlockToWindow`
// re-anchors a chain to its visible slice, `locus` stays the UNTRIMMED extent
// (the detail panel's), and the mark is decided from the drawn one — so the two
// part company on exactly the alignments that produce these marks. A chain over
// the whole contig sent every click to the contig's midpoint, whatever the mark
// stood for and wherever the row already was.
test('a scrolling click goes to the drawn span, not the block extent', async () => {
  const { view, level, row } = await scrollableSetup()

  level.showOffscreenMateContig('ctgB', 1, {
    locus: { start: 0, end: BP },
    mateCumBp: { start: DRAWN_CENTER_BP - 500, end: DRAWN_CENTER_BP + 500 },
  })
  await when(
    () => row.windowStartBp === DRAWN_CENTER_BP - row.windowWidthBp / 2,
    { timeout: 5000 },
  )

  expect(refNames(view, 1)).toEqual(['ctgA', 'ctgB'])
  expect(row.windowWidthBp).toBe(40_000)
})

// THE ROW'S OWN SCROLL IS IN THE CONVERSION. `pxToBp` takes a SCREEN pixel and
// adds `offsetPx` back, so the drawn cumBp has to have it subtracted first —
// and every other case here clicks from a row parked at the origin, where the
// term is zero and a missing one costs nothing. Started anywhere else, dropping
// it lands the row its own scroll distance past the mark.
test('the destination does not move with where the row already is', async () => {
  const { level, row } = await scrollableSetup()
  row.setWindow(40_000, 300_000)

  level.showOffscreenMateContig('ctgB', 1, {
    locus: { start: 0, end: BP },
    mateCumBp: { start: MATE_CENTER_BP - 500, end: MATE_CENTER_BP + 500 },
  })
  await when(
    () => row.windowStartBp === MATE_CENTER_BP - row.windowWidthBp / 2,
    { timeout: 5000 },
  )

  expect(row.windowWidthBp).toBe(40_000)
})

// THE STALE CUMBP THAT READS AS VALID. Off the end of the layout the
// conversion says `oob` and there is no doubt; landing inside ANOTHER contig's
// region it just answers with that contig's coordinate, and taken as a
// coordinate on the mark's contig it navigates somewhere nothing pointed at.
// Here the drawn span sits in ctgA while the mark names ctgB, which is what a
// region-list replacement between draw and click leaves behind.
test('a drawn span that lands on another contig moves nothing', async () => {
  const { level, row } = await scrollableSetup()
  const before = row.windowStartBp

  level.showOffscreenMateContig('ctgB', 1, {
    locus: { start: 200_000, end: 201_000 },
    mateCumBp: { start: 100_000, end: 101_000 },
  })
  await new Promise(resolve => {
    setTimeout(resolve, 500)
  })

  expect(row.windowStartBp).toBe(before)
})

// A drawn span outside every displayed region is geometry from before this row
// was navigated. The row HOLDS: there is nothing to fall back TO, since the
// block's own extent is the coordinate this branch exists to stop using, and a
// stale mark is not evidence of anywhere else to go.
test('a drawn span this row cannot show moves nothing', async () => {
  const { level, row } = await scrollableSetup()
  const before = row.windowStartBp

  level.showOffscreenMateContig('ctgB', 1, {
    locus: { start: 200_000, end: 201_000 },
    mateCumBp: { start: 5_000_000, end: 5_001_000 },
  })
  await new Promise(resolve => {
    setTimeout(resolve, 500)
  })

  expect(row.windowStartBp).toBe(before)
  expect(row.windowWidthBp).toBe(40_000)
})

// Flown, not jumped — so the row is somewhere else on the way and the reader
// can see the distance being crossed. Asserted on the zoom rather than the
// position, since the pull-back is the half a jump could not produce.
test('the row travels to it rather than appearing there', async () => {
  const { level, row } = await scrollableSetup()

  level.showOffscreenMateContig('ctgB', 1, {
    locus: { start: 200_000, end: 201_000 },
    mateCumBp: { start: BP + 200_000, end: BP + 201_000 },
  })
  await when(() => row.windowWidthBp > 40_000, { timeout: 5000 })
  await when(
    () => row.windowStartBp === MATE_CENTER_BP - row.windowWidthBp / 2,
    { timeout: 5000 },
  )

  expect(row.windowWidthBp).toBe(40_000)
})

// A reader who has turned motion off gets the destination and nothing else —
// and gets it in the click, not a frame later.
test('with animation off the row is simply placed there', async () => {
  const { session, level, row } = await scrollableSetup()
  session.setPreferenceOverride('animationMode', 'disabled')

  level.showOffscreenMateContig('ctgB', 1, {
    locus: { start: 200_000, end: 201_000 },
    mateCumBp: { start: BP + 200_000, end: BP + 201_000 },
  })

  expect(row.windowStartBp).toBe(MATE_CENTER_BP - 40_000 / 2)
})

// The click TAKES the anchor when the follow is on, so the flight then runs on
// the row every other row is being re-placed against, sixty times a second. The
// follow moves the non-anchor rows only — if it ever re-asserted the anchor's
// own window the flight would read the interference back and stop one frame in,
// leaving the row wherever the arc had got to.
test('the flight survives the follow it just became the anchor of', async () => {
  const { view, level, row } = await scrollableSetup()
  view.setRowSyncMode('follow')
  expect(view.followAnchorIndex).toBe(0)

  level.showOffscreenMateContig('ctgB', 1, {
    locus: { start: 200_000, end: 201_000 },
    mateCumBp: { start: BP + 200_000, end: BP + 201_000 },
  })
  await when(
    () => row.windowStartBp === MATE_CENTER_BP - row.windowWidthBp / 2,
    { timeout: 5000 },
  )

  expect(view.followAnchorIndex).toBe(1)
  expect(row.windowWidthBp).toBe(40_000)
}, 20000)

// The Undo the click posts writes the pre-click window, and the flight reads
// back what it wrote — so pressing it mid-flight ends the flight rather than
// being overwritten by its next frame. Without that the row would spring
// straight back to the mate and the Undo would look broken.
test('the undo wins against a flight still in the air', async () => {
  const { session, level, row } = await scrollableSetup()

  level.showOffscreenMateContig('ctgB', 1, {
    locus: { start: 200_000, end: 201_000 },
    mateCumBp: { start: BP + 200_000, end: BP + 201_000 },
  })
  await when(() => session.snackbarMessages.length > 0, { timeout: 5000 })
  await when(() => row.windowStartBp !== 0, { timeout: 5000 })
  const [action] = session.snackbarMessages[0]!.actions!
  action!.onClick()

  const restored = { start: row.windowStartBp, width: row.windowWidthBp }
  await new Promise(resolve => setTimeout(resolve, 1500))
  expect(row.windowStartBp).toBe(restored.start)
  expect(row.windowWidthBp).toBe(restored.width)
  expect(restored.start).toBe(0)
}, 20000)

// The floor is a WIDTH, and a locus near the origin has nowhere to put half of
// it. Padded symmetrically and then clipped at zero, a mate a few hundred bp
// into its contig framed half the minimum window — at the one place that states
// the minimum. The window slides right instead, so the origin gets the same
// width as anywhere else.
test('a locus at the start of its contig still gets the whole floor', async () => {
  const { view, level } = await setup()

  level.showOffscreenMateContig('ctgB', 1, { locus: { start: 100, end: 600 } })
  await when(() => refNames(view, 1).join(',') === 'ctgB', { timeout: 5000 })

  const [visible] = view.views[1]!.dynamicBlocks.contentBlocks
  expect(visible!.end - visible!.start).toBeGreaterThanOrEqual(20_000)
}, 20000)
