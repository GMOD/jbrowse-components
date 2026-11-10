import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { invokeIpc } from '../../ipc.ts'
import { NotifyContext } from '../NotifyContext.ts'
import StartScreen from './StartScreen.tsx'
import { loadPluginManager } from './util.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('../../ipc.ts', () => ({ invokeIpc: jest.fn() }))
jest.mock('./util.tsx', () => ({
  createStartScreenPluginManager: () => new Promise(() => {}),
  loadPluginManager: jest.fn(),
  launchSnapshot: jest.fn(),
  fetchConfig: jest.fn(),
  openSpecLink: jest.fn(),
}))
jest.mock('../OpenSequenceDialog.tsx', () => ({
  __esModule: true,
  default: () => 'open genome dialog',
}))
jest.mock('./availableGenomes/AvailableGenomesDialog.tsx', () => ({
  __esModule: true,
  default: () => 'hosted genomes dialog',
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
      args[0] === 'listSessions'
        ? [session]
        : args[0] === 'listQuickstarts'
          ? []
          : args[0] === 'promptOpenFile'
            ? '/home/u/picked.jbrowse'
            : undefined,
    )
})

function renderStartScreen(setPluginManager = jest.fn()) {
  render(
    <NotifyContext value={jest.fn()}>
      <StartScreen setPluginManager={setPluginManager} />
    </NotifyContext>,
  )
}

function openFileMenu() {
  fireEvent.click(screen.getByRole('button', { name: /File/ }))
}

test('a launch from one panel leaves nothing in either panel to start a second', async () => {
  let land: (pm: PluginManager) => void = () => {}
  jest.mocked(loadPluginManager).mockReturnValue(
    new Promise(resolve => {
      land = resolve
    }),
  )
  const setPluginManager = jest.fn()
  renderStartScreen(setPluginManager)
  expect(await screen.findByText(/^hg38 - /)).toBeTruthy()

  fireEvent.click(await screen.findByText('Volvox'))

  expect(await screen.findByText(/Loading session/)).toBeTruthy()
  expect(screen.queryByText('Volvox')).toBeNull()
  expect(screen.queryByText(/^hg38 - /)).toBeNull()
  expect(screen.queryByText('Open your own genome')).toBeNull()
  openFileMenu()
  expect(
    screen
      .getByRole('menuitem', { name: 'Open session file...' })
      .getAttribute('aria-disabled'),
  ).toBe('true')

  const pluginManager = {} as PluginManager
  land(pluginManager)
  await waitFor(() => {
    expect(setPluginManager).toHaveBeenCalledWith(pluginManager)
  })
  expect(loadPluginManager).toHaveBeenCalledTimes(1)
})

test.each([
  ['Open your own genome...', 'open genome dialog'],
  ['Browse hosted genomes...', 'hosted genomes dialog'],
  ['Open JBrowse Web link...', 'Open JBrowse Web link'],
])('File > %s opens its dialog', async (label, dialogText) => {
  renderStartScreen()
  openFileMenu()
  fireEvent.click(screen.getByRole('menuitem', { name: label }))
  expect(await screen.findByText(dialogText)).toBeTruthy()
})

test.each([
  ['Open your own genome', 'open genome dialog'],
  ['Browse hosted genomes', 'hosted genomes dialog'],
])(
  'the launch panel button %s opens the same dialog',
  async (label, dialogText) => {
    renderStartScreen()
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(await screen.findByText(dialogText)).toBeTruthy()
  },
)

test('File > Open session file... loads the picked file', async () => {
  jest.mocked(loadPluginManager).mockResolvedValue({} as PluginManager)
  renderStartScreen()
  openFileMenu()
  fireEvent.click(
    screen.getByRole('menuitem', { name: 'Open session file...' }),
  )
  await waitFor(() => {
    expect(loadPluginManager).toHaveBeenCalledWith('/home/u/picked.jbrowse')
  })
})
