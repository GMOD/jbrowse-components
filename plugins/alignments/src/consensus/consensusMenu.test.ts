import {
  clickMenuItem,
  createRpcTestEnvironment,
  menuSubItems,
} from '../LinearAlignmentsDisplay/testUtils.ts'
import ConsensusSequenceF from './index.ts'

const LABEL = 'Consensus sequence (visible region)'

test('the alignments track menu offers a consensus, no rubberband needed', () => {
  const { createDisplay } = createRpcTestEnvironment({
    register: ConsensusSequenceF,
  })
  const { display } = createDisplay()
  expect(
    menuSubItems(display.trackMenuItems(), 'Launch').map(i =>
      'label' in i ? i.label : undefined,
    ),
  ).toContain(LABEL)
})

test('it opens on the region the view is showing, and on its own display', () => {
  const { createDisplay } = createRpcTestEnvironment({
    register: ConsensusSequenceF,
  })
  const { session, view, display } = createDisplay()
  view.zoomTo(10)
  view.scrollTo(2000)

  clickMenuItem(display.trackMenuItems(), LABEL)

  const props = session.queuedDialogs[0]!
  expect(props.display).toBe(display)
  // The VIEW, not the display: the dialog's "Open as variant track" calls
  // `showTrack` on whatever it is handed, and a display has none.
  expect(props.model).toBe(view)
  // the window, not the whole displayed region: a consensus over 10Mb of reads
  // where the view is showing 8kb of them is a different answer, and the
  // dialog's size guard would refuse it
  expect(props.regions).toEqual([
    { assemblyName: 'volvox', refName: 'ctgA', start: 20000, end: 28000 },
  ])
})

// The blocks are a span of SCREEN and only land on a whole base by luck. The
// dialog seeds its Region field through `assembleLocString` and parses the
// string back, and `BP_QUANTITY_SOURCE` rejects a bare fractional coordinate on
// purpose — so a fractional block opened the dialog red, with nothing fetchable,
// on any view that had been panned or zoomed off a whole base.
test('it rounds to whole bases, whatever the view is sitting between', () => {
  const { createDisplay } = createRpcTestEnvironment({
    register: ConsensusSequenceF,
  })
  const { session, view, display } = createDisplay()
  view.zoomTo(10.5)
  view.scrollTo(2001)
  expect(view.dynamicBlocks.contentBlocks[0]!.start % 1).not.toBe(0)

  clickMenuItem(display.trackMenuItems(), LABEL)

  for (const r of session.queuedDialogs[0]!.regions as {
    start: number
    end: number
  }[]) {
    expect(r.start % 1).toBe(0)
    expect(r.end % 1).toBe(0)
  }
})

// The rubberband entry could not reach this state — it only exists once a drag
// has selected something — so the track-menu entry is the one that has to say
// no. `ConsensusSequenceDialog` reads `selectedRegions[0]!.assemblyName`.
test('it opens nothing when no region is on screen', () => {
  const { createDisplay } = createRpcTestEnvironment({
    register: ConsensusSequenceF,
  })
  const { session, view, display } = createDisplay()
  view.setDisplayedRegions([])
  expect(view.dynamicBlocks.contentBlocks).toHaveLength(0)

  clickMenuItem(display.trackMenuItems(), LABEL)

  expect(session.queuedDialogs).toHaveLength(0)
})
