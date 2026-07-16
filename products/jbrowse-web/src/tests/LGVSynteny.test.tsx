import { getEnv } from '@jbrowse/core/util'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findCanvasIn,
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
const opts = [{}, delay]

test('nav to synteny from right click', async () => {
  await mockConsoleWarn(async () => {
    const user = userEvent.setup()
    const { session, view, findByTestId, findByText } = await createView()

    await view.navToLocString('ctgA:30,222..33,669')
    await user.click(await findByTestId(hts('volvox_ins.paf'), ...opts))

    const display = await findByTestId('pileup-display-done', ...opts)
    const canvas = findCanvasIn(display)
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 3 })
    fireEvent.contextMenu(canvas, { clientX: 200, clientY: 3 })
    fireEvent.click(await findByText('Launch synteny view for this position'))
    fireEvent.click(await findByText('Submit'))
    await waitFor(() => {
      const v = session.views[1] as LinearSyntenyViewModel | undefined
      expect(v?.initialized).toBe(true)
      expect(v?.views[0]?.coarseVisibleLocStrings).toBe('ctgA:29,222..34,670')
    }, delay)
    expectCanvasMatch(await findByTestId('synteny_canvas_done', ...opts))
  })
}, 60000)

test('nav to synteny from feature details', async () => {
  await mockConsoleWarn(async () => {
    const user = userEvent.setup()
    const { session, view, findByTestId, findByText } = await createView()

    await view.navToLocString('ctgA:30,222..33,669')
    await user.click(await findByTestId(hts('volvox_ins.paf'), ...opts))

    const display = await findByTestId('pileup-display-done', ...opts)
    const canvas = findCanvasIn(display)
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 3 })
    fireEvent.click(canvas, { clientX: 200, clientY: 3 })
    fireEvent.click(
      await findByText('Launch new linear synteny view on this feature'),
    )
    fireEvent.click(await findByText('Submit'))
    await waitFor(() => {
      const v = session.views[1] as LinearSyntenyViewModel | undefined
      expect(v?.initialized).toBe(true)
      expect(v?.views[0]?.coarseVisibleLocStrings).toBe('ctgA:1..50,001')
    }, delay)
    expectCanvasMatch(await findByTestId('synteny_canvas_done', ...opts))
  })
}, 60000)

test('nav to synteny from right click, with launch connection plugin', async () => {
  await mockConsoleWarn(async () => {
    const user = userEvent.setup()
    const { session, view, findByTestId, findByText } = await createView()

    getEnv(session).pluginManager.addToExtensionPoint(
      'Core-handleUnrecognizedAssembly',
      (_defaultResult, { assemblyName, session }) => {
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
          // @ts-expect-error
          s.addConnectionConf(conf)
          // @ts-expect-error
          s.makeConnection(conf)
        }
      },
    )

    await view.navToLocString('ctgA:30,222..33,669')
    await user.click(await findByTestId(hts('volvox_del2.paf'), ...opts))

    const display = await findByTestId('pileup-display-done', ...opts)
    const canvas = findCanvasIn(display)
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 3 })
    fireEvent.contextMenu(canvas, { clientX: 200, clientY: 3 })
    fireEvent.click(await findByText('Launch synteny view for this position'))
    fireEvent.click(await findByText('Submit'))
    await waitFor(() => {
      const v = session.views[1] as LinearSyntenyViewModel | undefined
      expect(v?.initialized).toBe(true)
      expect(v?.views[0]?.coarseVisibleLocStrings).toBe('ctgA:29,222..34,670')
      expect(v?.views[1]?.coarseVisibleLocStrings).toBe('ctgA:27,499..29,810')
    }, delay)
    expectCanvasMatch(await findByTestId('synteny_canvas_done', ...opts))
  })
}, 60000)

// The track menu is all submenus, so every setting costs one hover past the
// first click. These drive the two that used to be bare top-level checkboxes,
// through the real menu, and assert the display state they land on.
test('group by mate assembly from the Group by submenu', async () => {
  await mockConsoleWarn(async () => {
    const user = userEvent.setup()
    const { view } = await createView()

    await view.navToLocString('ctgA:30,222..33,669')
    await user.click(await screen.findByTestId(hts('volvox_ins.paf'), ...opts))
    await screen.findByTestId('pileup-display-done', ...opts)

    await user.click(await screen.findByTestId('track_menu_icon', ...opts))
    await user.click(await screen.findByText('Group by...'))
    await user.click(await screen.findByText('Mate assembly'))

    const display = view.tracks[0]!.displays[0]!
    await waitFor(() => {
      expect(display.groupBy).toEqual({ type: 'mateAssembly' })
    }, delay)
  })
}, 60000)

test('sort by longest features first from the Sort by submenu', async () => {
  await mockConsoleWarn(async () => {
    const user = userEvent.setup()
    const { view } = await createView()

    await view.navToLocString('ctgA:30,222..33,669')
    await user.click(await screen.findByTestId(hts('volvox_ins.paf'), ...opts))
    await screen.findByTestId('pileup-display-done', ...opts)

    const display = view.tracks[0]!.displays[0]!
    // largeFeaturesFirst is the synteny config default, so flip it off through
    // "Start location" first and prove the radio brings it back.
    await user.click(await screen.findByTestId('track_menu_icon', ...opts))
    await user.click(await screen.findByText('Sort by...'))
    await user.click(await screen.findByText('Start location'))
    await waitFor(() => {
      expect(display.largeFeaturesFirst).toBe(false)
    }, delay)

    await user.click(await screen.findByTestId('track_menu_icon', ...opts))
    await user.click(await screen.findByText('Sort by...'))
    await user.click(await screen.findByText('Longest features first'))
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
    const user = userEvent.setup()
    const { view } = await createView()

    await view.navToLocString('ctgA:30,222..33,669')
    await user.click(await screen.findByTestId(hts('volvox_ins.paf'), ...opts))
    await screen.findByTestId('pileup-display-done', ...opts)
    const display = view.tracks[0]!.displays[0]!

    const pixels = async () =>
      findCanvasIn(
        await screen.findByTestId('pileup-display-done', ...opts),
      ).toDataURL()

    const before = await pixels()
    expect(display.showMismatches).toBe(true)

    await user.click(await screen.findByTestId('track_menu_icon', ...opts))
    await user.click(await screen.findByText('Show...'))
    await user.click(await screen.findByText('Show mismatches'))
    await waitFor(() => {
      expect(display.showMismatches).toBe(false)
    }, delay)
    await waitFor(async () => {
      expect(await pixels()).not.toBe(before)
    }, delay)
  })
}, 60000)
