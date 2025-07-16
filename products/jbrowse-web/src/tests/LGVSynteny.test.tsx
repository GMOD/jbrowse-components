import { getEnv } from '@jbrowse/core/util'
import { fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  hts,
  mockConsoleWarn,
  setup,
} from './util'

import type { LinearSyntenyViewModel } from '@jbrowse/plugin-linear-comparative-view/src/LinearSyntenyView/model'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 50000 }
const opts = [{}, delay]

test('nav to synteny from right click', async () => {
  await mockConsoleWarn(async () => {
    const user = userEvent.setup()
    const { session, view, findByTestId, findByText, findAllByTestId } =
      await createView()

    await view.navToLocString('ctgA:30,222..33,669')
    await user.click(await findByTestId(hts('volvox_ins.paf'), ...opts))

    const track = await findAllByTestId('pileup-overlay-strand', ...opts)
    fireEvent.mouseMove(track[0]!, { clientX: 200, clientY: 5 })
    fireEvent.contextMenu(track[0]!, { clientX: 200, clientY: 5 })
    fireEvent.click(await findByText('Launch synteny view for this position'))
    fireEvent.click(await findByText('Submit'))
    await waitFor(() => {
      const v = session.views[1] as LinearSyntenyViewModel | undefined
      expect(v?.initialized).toBe(true)
      expect(v?.views[0]?.coarseVisibleLocStrings).toBe('ctgA:29,221..34,669')
    }, delay)
    expectCanvasMatch(await findByTestId('synteny_canvas', ...opts))
  })
}, 60000)

test('nav to synteny from feature details', async () => {
  await mockConsoleWarn(async () => {
    const user = userEvent.setup()
    const { session, view, findByTestId, findByText, findAllByTestId } =
      await createView()

    await view.navToLocString('ctgA:30,222..33,669')
    await user.click(await findByTestId(hts('volvox_ins.paf'), ...opts))

    const track = await findAllByTestId('pileup-overlay-strand', ...opts)
    fireEvent.mouseMove(track[0]!, { clientX: 200, clientY: 5 })
    fireEvent.click(track[0]!, { clientX: 200, clientY: 5 })
    fireEvent.click(
      await findByText('Launch new linear synteny view on this feature'),
    )
    fireEvent.click(await findByText('Submit'))
    await waitFor(() => {
      const v = session.views[1] as LinearSyntenyViewModel | undefined
      expect(v?.initialized).toBe(true)
      expect(v?.views[0]?.coarseVisibleLocStrings).toBe('ctgA:1..50,001')
    }, delay)
    expectCanvasMatch(await findByTestId('synteny_canvas', ...opts))
  })
}, 60000)

test('nav to synteny from right click, with launch connection plugin', async () => {
  await mockConsoleWarn(async () => {
    const user = userEvent.setup()
    const { session, view, findByTestId, findByText, findAllByTestId } =
      await createView()

    getEnv(session).pluginManager.addToExtensionPoint(
      'Core-handleUnrecognizedAssembly',
      (
        _defaultResult: any,
        { assemblyName, session }: { assemblyName: string; session: any },
      ) => {
        const jb2asm = `jb2hub-${assemblyName}`
        if (
          assemblyName &&
          !session.connections.some(f => f.connectionId === jb2asm)
        ) {
          const conf = {
            type: 'JB2TrackHubConnection',
            uri: 'http://localhost:3000/test_data/volvox/config2.json',
            name: `my conn${jb2asm}`,
            assemblyNames: [assemblyName],
            connectionId: jb2asm,
          }
          session.addConnectionConf(conf)
          session.makeConnection(conf)
        }
      },
    )

    await view.navToLocString('ctgA:30,222..33,669')
    await user.click(await findByTestId(hts('volvox_del2.paf'), ...opts))

    const track = await findAllByTestId('pileup-overlay-strand', ...opts)
    fireEvent.mouseMove(track[0]!, { clientX: 200, clientY: 5 })
    fireEvent.contextMenu(track[0]!, { clientX: 200, clientY: 5 })
    fireEvent.click(await findByText('Launch synteny view for this position'))
    fireEvent.click(await findByText('Submit'))
    await waitFor(() => {
      const v = session.views[1] as LinearSyntenyViewModel | undefined
      expect(v?.initialized).toBe(true)
      expect(v?.views[0]?.coarseVisibleLocStrings).toBe('ctgA:29,221..34,669')
      expect(v?.views[1]?.coarseVisibleLocStrings).toBe('ctgA:27,499..29,810')
    }, delay)
    expectCanvasMatch(await findByTestId('synteny_canvas', ...opts))
  })
}, 60000)
