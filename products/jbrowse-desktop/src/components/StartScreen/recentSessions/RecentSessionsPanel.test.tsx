import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { invokeIpc } from '../../../ipc.ts'
import { NotifyContext } from '../../NotifyContext.ts'
import { StartScreenLaunchContext } from '../startScreenLaunch.ts'
import { loadPluginManager } from '../util.tsx'
import RecentSessionPanel from './RecentSessionsPanel.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('../../../ipc.ts', () => ({ invokeIpc: jest.fn() }))
jest.mock('../util.tsx', () => ({
  loadPluginManager: jest.fn(),
  launchSnapshot: jest.fn(),
  fetchConfig: jest.fn(),
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
    .mockImplementation(async (...args) =>
      args[0] === 'listSessions' ? [session] : undefined,
    )
})

function renderPanel(launch = jest.fn()) {
  render(
    <NotifyContext value={jest.fn()}>
      <StartScreenLaunchContext value={{ launch, openDialog: jest.fn() }}>
        <RecentSessionPanel />
      </StartScreenLaunchContext>
    </NotifyContext>,
  )
  return launch
}

test('clicking a session launches it through the start screen', async () => {
  const pluginManager = {} as PluginManager
  jest.mocked(loadPluginManager).mockResolvedValue(pluginManager)
  const launch = renderPanel(
    jest.fn(async (load: () => Promise<PluginManager>) => {
      await load()
    }),
  )

  fireEvent.click(await screen.findByText('Volvox'))

  await waitFor(() => {
    expect(loadPluginManager).toHaveBeenCalledWith(session.path)
  })
  expect(launch).toHaveBeenCalledTimes(1)
})

test('the More actions menu brings the session path column back', async () => {
  localStorage.clear()
  renderPanel()
  await screen.findByText('Volvox')
  expect(screen.queryByText('Session path')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
  fireEvent.click(await screen.findByText('Show session path'))

  expect(await screen.findByText('Session path')).toBeTruthy()
})

test('the bulk delete and quickstart icons appear only once a row is ticked', async () => {
  renderPanel()
  await screen.findByText('Volvox')
  expect(screen.queryByRole('button', { name: 'Delete sessions' })).toBeNull()

  fireEvent.click(screen.getByRole('checkbox', { name: 'Select row' }))

  expect(
    await screen.findByRole('button', { name: 'Delete sessions' }),
  ).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'Add sessions to quickstart list' }),
  ).toBeTruthy()
})

test('with no sessions the list toolbar is hidden', async () => {
  jest
    .mocked(invokeIpc)
    .mockImplementation(async (...args) =>
      args[0] === 'listSessions' ? [] : undefined,
    )
  renderPanel()
  expect(await screen.findByText('No sessions available')).toBeTruthy()
  expect(screen.queryByText('Show autosaves')).toBeNull()
  expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
})
