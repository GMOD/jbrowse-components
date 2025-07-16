import { fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getEnv } from '@jbrowse/core/util'

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

test('nav to synteny from right click, with launchame connection plugin', async () => {
  await mockConsoleWarn(async () => {
    const user = userEvent.setup()
    const { session, view, findByTestId, findByText, findAllByTestId } =
      await createView()

    getEnv(session).pluginManager.addToExtensionPoint(
      'Core-getUnrecognizedAssembly',
      (
        _defaultResult: any,
        { assemblyName, rootModel }: { assemblyName: string; rootModel: any },
      ) => {
        const jb2asm = `jb2hub-${assemblyName}`
        console.log('WT', { assemblyName })
        if (
          assemblyName &&
          !rootModel.session.connections.find(f => f.connectionId === jb2asm)
        ) {
          console.log('IN HERE', { assemblyName })
          const conf = {
            type: 'JB2TrackHubConnection',
            uri: 'config2.json',
            name: 'my conn' + jb2asm,
            assemblyNames: [assemblyName],
            connectionId: jb2asm,
          }
          rootModel.session.addConnectionConf(conf)
          rootModel.session.makeConnection(conf)
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
      expect(v?.views[1]?.coarseVisibleLocStrings).toBeTruthy()
    }, delay)
    expectCanvasMatch(await findByTestId('synteny_canvas', ...opts))
  })
}, 20000)
