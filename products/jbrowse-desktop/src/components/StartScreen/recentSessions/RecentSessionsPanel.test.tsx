import { fireEvent, render, screen } from '@testing-library/react'

import { invokeIpc } from '../../../ipc.ts'
import { NotifyContext } from '../../NotifyContext.ts'
import { loadPluginManager } from '../util.tsx'
import RecentSessionPanel from './RecentSessionsPanel.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('../../../ipc.ts', () => ({ invokeIpc: jest.fn() }))
jest.mock('../util.tsx', () => ({
  loadPluginManager: jest.fn(),
  openSpecLink: jest.fn(),
}))

const session = {
  path: '/home/u/Documents/JBrowse/volvox.jbrowse',
  name: 'Volvox',
  updated: Date.now(),
  isAutosave: false,
}

beforeEach(() => {
  jest
    .mocked(invokeIpc)
    .mockImplementation(async channel =>
      channel === 'listSessions' ? [session] : undefined,
    )
})

// Loading a session builds its plugin manager, which takes seconds; the panel
// used to show nothing meanwhile, and a second click started a second load.
test('a launch replaces the panel with a loading screen until it lands', async () => {
  let land: (pm: PluginManager) => void = () => {}
  jest.mocked(loadPluginManager).mockReturnValue(
    new Promise(resolve => {
      land = resolve
    }),
  )
  const setPluginManager = jest.fn()
  render(
    <NotifyContext value={jest.fn()}>
      <RecentSessionPanel setPluginManager={setPluginManager} />
    </NotifyContext>,
  )

  fireEvent.click(await screen.findByText('Volvox'))

  expect(await screen.findByText(/Loading session/)).toBeTruthy()
  expect(screen.queryByText('Volvox')).toBeNull()
  expect(loadPluginManager).toHaveBeenCalledTimes(1)

  const pluginManager = {} as PluginManager
  land(pluginManager)
  await screen.findByText('Volvox')
  expect(setPluginManager).toHaveBeenCalledWith(pluginManager)
})
