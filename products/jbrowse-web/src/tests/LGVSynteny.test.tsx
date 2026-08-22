import { getEnv } from '@jbrowse/core/util'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findCanvasIn,
  findDisplayPainted,
  hts,
  mockConsoleWarn,
  setup,
} from './util.tsx'

import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { LinearSyntenyViewModel } from '@jbrowse/plugin-linear-comparative-view'
import type { SessionWithConnections } from '@jbrowse/product-core'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 50000 }
const ALL_VS_ALL_TRACK_NAME = 'volvox all-vs-all (ins/volvox/del pangenome)'
const opts = [{}, delay]

// Where the anchor row lands for a launch off `ctgA:30,222..33,669` at the
// dialog's default 1 kb padding. Its ends are the clicked block clipped to the
// VIEWPORT, whose bounds are fractional (a dynamic block's are), and
// `resolvePanel` rounds such a span outward so the launched view covers the span
// the dialog previewed rather than stopping a base inside it.
const ANCHOR_LOC = 'ctgA:29,222..34,670'

test('nav to synteny from right click', async () => {
  await mockConsoleWarn(async () => {
    const { session, view, findByTestId, findByText } = await createView()

    await view.navToLocString('ctgA:30,222..33,669')
    fireEvent.click(await findByTestId(hts('volvox_ins.paf'), ...opts))

    const display = await findDisplayPainted('pileup-display', delay)
    const canvas = findCanvasIn(display)
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 3 })
    fireEvent.contextMenu(canvas, { clientX: 200, clientY: 3 })
    fireEvent.click(await findByText('Launch synteny view for this position'))
    fireEvent.click(await findByText('Open in new view'))
    await waitFor(() => {
      const v = session.views[1] as LinearSyntenyViewModel | undefined
      expect(v?.initialized).toBe(true)
      expect(v?.views[0]?.coarseVisibleLocStrings).toBe(ANCHOR_LOC)
    }, delay)
    expectCanvasMatch(await findDisplayPainted('synteny_canvas', delay))
  })
}, 60000)

// The other way out of the same dialog. A launch is anchored on the locus the
// launching view is already showing, so appending leaves two views of one place
// stacked — this puts the synteny view in the LGV's slot instead. Asserted on
// session.views, since "the LGV is gone" is the whole difference.
test('replacing the launching view with the synteny view', async () => {
  await mockConsoleWarn(async () => {
    const { session, view, findByTestId, findByText } = await createView()

    await view.navToLocString('ctgA:30,222..33,669')
    fireEvent.click(await findByTestId(hts('volvox_ins.paf'), ...opts))

    const display = await findDisplayPainted('pileup-display', delay)
    const canvas = findCanvasIn(display)
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 3 })
    fireEvent.contextMenu(canvas, { clientX: 200, clientY: 3 })
    fireEvent.click(await findByText('Launch synteny view for this position'))
    fireEvent.click(await findByText('Replace current view'))

    await waitFor(() => {
      expect(session.views.map(v => v.type)).toEqual(['LinearSyntenyView'])
      const v = session.views[0] as LinearSyntenyViewModel | undefined
      expect(v?.initialized).toBe(true)
      expect(v?.views[0]?.coarseVisibleLocStrings).toBe(ANCHOR_LOC)
    }, delay)
    await findDisplayPainted('synteny_canvas', delay)
  })
}, 60000)

test('nav to synteny from feature details', async () => {
  await mockConsoleWarn(async () => {
    const { session, view, findByTestId, findByText } = await createView()

    await view.navToLocString('ctgA:30,222..33,669')
    fireEvent.click(await findByTestId(hts('volvox_ins.paf'), ...opts))

    const display = await findDisplayPainted('pileup-display', delay)
    const canvas = findCanvasIn(display)
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 3 })
    fireEvent.click(canvas, { clientX: 200, clientY: 3 })
    fireEvent.click(
      await findByText('Launch linear synteny view on this feature'),
    )
    // "Open in new view", not "Submit": this link reaches the same dialog the
    // right-click does, so it offers the same two destinations
    fireEvent.click(await findByText('Open in new view'))
    await waitFor(() => {
      const v = session.views[1] as LinearSyntenyViewModel | undefined
      expect(v?.initialized).toBe(true)
      expect(v?.views[0]?.coarseVisibleLocStrings).toBe('ctgA:1..50,001')
    }, delay)
    expectCanvasMatch(await findDisplayPainted('synteny_canvas', delay))
  })
}, 60000)

test('nav to synteny from right click, with launch connection plugin', async () => {
  await mockConsoleWarn(async () => {
    const { session, view, findByTestId, findByText } = await createView()

    getEnv(session).pluginManager.listenToExtensionPoint(
      'Core-handleUnrecognizedAssembly',
      ({ assemblyName, session }) => {
        const jb2asm = `jb2hub-${assemblyName}`
        const s = session as AbstractSessionModel & SessionWithConnections
        if (
          assemblyName &&
          !s.connections.some(f => f.connectionId === jb2asm)
        ) {
          const conf = {
            type: 'JB2TrackHubConnection',
            uri: 'http://localhost:3000/test_data/volvox/config2.json',
            name: `my conn${jb2asm}`,
            assemblyNames: [assemblyName],
            connectionId: jb2asm,
          }
          s.addConnectionConf(conf)
          // @ts-expect-error
          s.makeConnection(conf)
        }
      },
    )

    await view.navToLocString('ctgA:30,222..33,669')
    fireEvent.click(await findByTestId(hts('volvox_del2.paf'), ...opts))

    const display = await findDisplayPainted('pileup-display', delay)
    const canvas = findCanvasIn(display)
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 3 })
    fireEvent.contextMenu(canvas, { clientX: 200, clientY: 3 })
    fireEvent.click(await findByText('Launch synteny view for this position'))
    fireEvent.click(await findByText('Open in new view'))
    await waitFor(() => {
      const v = session.views[1] as LinearSyntenyViewModel | undefined
      expect(v?.initialized).toBe(true)
      expect(v?.views[0]?.coarseVisibleLocStrings).toBe(ANCHOR_LOC)
      // the mate row, rounded outward for the same reason as ANCHOR_LOC
      expect(v?.views[1]?.coarseVisibleLocStrings).toBe('ctgA:27,499..29,810')
    }, delay)
    expectCanvasMatch(await findDisplayPainted('synteny_canvas', delay))
  })
}, 60000)

// The track menu is all submenus, so every setting costs one hover past the
// first click. These drive the two that used to be bare top-level checkboxes,
// through the real menu, and assert the display state they land on.
test('group by mate assembly from the Group by submenu', async () => {
  await mockConsoleWarn(async () => {
    const { view } = await createView()

    await view.navToLocString('ctgA:30,222..33,669')
    fireEvent.click(await screen.findByTestId(hts('volvox_ins.paf'), ...opts))
    await findDisplayPainted('pileup-display', delay)

    fireEvent.click(await screen.findByTestId('track_menu_icon', ...opts))
    fireEvent.click(await screen.findByText('Group by...'))
    fireEvent.click(await screen.findByText('Mate assembly'))

    const display = view.tracks[0]!.displays[0]!
    await waitFor(() => {
      expect(display.groupBy).toEqual({ type: 'mateAssembly' })
    }, delay)
  })
}, 60000)

test('sort by longest features first from the Sort by submenu', async () => {
  await mockConsoleWarn(async () => {
    const { view } = await createView()

    await view.navToLocString('ctgA:30,222..33,669')
    fireEvent.click(await screen.findByTestId(hts('volvox_ins.paf'), ...opts))
    await findDisplayPainted('pileup-display', delay)

    const display = view.tracks[0]!.displays[0]!
    // largeFeaturesFirst is the synteny config default, so flip it off through
    // "Start location" first and prove the radio brings it back.
    fireEvent.click(await screen.findByTestId('track_menu_icon', ...opts))
    fireEvent.click(await screen.findByText('Sort by...'))
    fireEvent.click(await screen.findByText('Start location'))
    await waitFor(() => {
      expect(display.largeFeaturesFirst).toBe(false)
    }, delay)

    fireEvent.click(await screen.findByTestId('track_menu_icon', ...opts))
    fireEvent.click(await screen.findByText('Sort by...'))
    fireEvent.click(await screen.findByText('Longest features first'))
    await waitFor(() => {
      expect(display.largeFeaturesFirst).toBe(true)
    }, delay)
  })
}, 60000)

// SyntenyFeature implements forEachMismatch off the cs tag / CIGAR so per-base
// differences render, which is what makes this checkbox worth carrying on a
// synteny track. Toggling it must actually repaint; a dead layer would leave
// the canvas byte-identical.
test('Show mismatches is a live layer on a synteny track', async () => {
  await mockConsoleWarn(async () => {
    const { view } = await createView()

    await view.navToLocString('ctgA:30,222..33,669')
    fireEvent.click(await screen.findByTestId(hts('volvox_ins.paf'), ...opts))
    await findDisplayPainted('pileup-display', delay)
    const display = view.tracks[0]!.displays[0]!

    const pixels = async () =>
      findCanvasIn(
        await findDisplayPainted('pileup-display', delay),
      ).toDataURL()

    const before = await pixels()
    expect(display.showMismatches).toBe(true)

    fireEvent.click(await screen.findByTestId('track_menu_icon', ...opts))
    fireEvent.click(await screen.findByText('Show...'))
    fireEvent.click(await screen.findByText('Show mismatches'))
    await waitFor(() => {
      expect(display.showMismatches).toBe(false)
    }, delay)
    await waitFor(async () => {
      expect(await pixels()).not.toBe(before)
    }, delay)
  })
}, 60000)

// The region-anchored launch, which is the one that produces a multi-panel
// view. The alignment under the cursor answers "what does this block align
// to"; a selected region answers "what aligns here at all", and on an
// all-vs-all track that is several assemblies at once — one panel each, with a
// synteny strip in every gap.
test('launch a multi-panel synteny view from a region selection', async () => {
  await mockConsoleWarn(async () => {
    const { session, view, findByTestId, findByText } = await createView()

    await view.navToLocString('ctgA:1..50,000')

    // The dialog offers the synteny datasets this view has OPEN, so the launch
    // entry does not exist until one is — and volvox_all_vs_all is the only
    // dataset here spanning three assemblies, i.e. the only one that can fill
    // more than a single target panel.
    fireEvent.click(await findByTestId(hts('volvox_all_vs_all'), ...opts))

    const bp = (coord: number) => ({
      refName: 'ctgA',
      assemblyName: 'volvox',
      index: 0,
      offset: coord,
      start: 0,
      end: 50001,
      coord,
      reversed: false,
    })
    view.setOffsets(bp(10000), bp(20000))

    // one entry, under the rubberband menu's "Launch" group: a view can have
    // several synteny datasets open and the choice between them is a field in
    // the dialog, not a submenu here
    // waited for, not read: opening the track resolves LGVSyntenyDisplay's
    // lazily loaded state model, so the display — and the menu entry it
    // contributes — arrive a tick after the click
    const launch = await waitFor(() => {
      const found = view
        .rubberBandMenuItems()
        .find(f => 'label' in f && f.label === 'Launch')
      if (!found || !('subMenu' in found)) {
        throw new Error('expected a Launch submenu')
      }
      return found
    }, delay)
    const item = launch.subMenu.find(
      f => 'label' in f && f.label === 'Linear synteny view',
    )
    if (!item || !('onClick' in item)) {
      throw new Error('expected the synteny launch entry')
    }
    item.onClick()

    // the one open dataset, so it is stated rather than offered as a select
    await findByText(`Synteny dataset: ${ALL_VS_ALL_TRACK_NAME}`, ...opts)

    // every assembly the region aligns to arrives checked, so the payoff is one
    // click away rather than opt-in per panel
    await findByText('volvox_ins', ...opts)
    await findByText('volvox_del', ...opts)
    fireEvent.click(await findByText('Open in new view'))

    await waitFor(() => {
      const v = session.views[1] as LinearSyntenyViewModel | undefined
      expect(v?.views.map(f => f.assemblyNames[0])).toEqual([
        'volvox',
        'volvox_ins',
        'volvox_del',
      ])
    }, delay)

    // Wait for the new panels' synteny fetches to settle: otherwise the test
    // ends while they're still in flight, and their resolution after teardown
    // throws "require a file after the Jest environment has been torn down"
    // from the synteny RPC's dynamic import.
    await findDisplayPainted('synteny_canvas', delay)
  })
}, 60000)
