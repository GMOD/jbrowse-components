import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { invokeIpc } from '../../ipc.ts'
import { NotifyContext } from '../NotifyContext.ts'
import factoryReset from '../factoryReset.ts'
import StartScreen from './StartScreen.tsx'
import { loadPluginManager } from './util.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type React from 'react'

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
  default: ({
    initialFiles = [],
    onClose,
  }: {
    initialFiles?: { localPath: string }[]
    onClose: () => void
  }) =>
    jest.requireActual<typeof React>('react').createElement(
      'button',
      {
        onClick: () => {
          onClose()
        },
      },
      ['open genome dialog', ...initialFiles.map(f => f.localPath)].join(' '),
    ),
}))
jest.mock('../factoryReset.ts', () => ({
  __esModule: true,
  default: jest.fn(async () => {}),
}))
jest.mock('@jbrowse/core/util/electron', () => ({
  electronRenderer: () => ({
    webUtils: {
      getPathForFile: (file: File) =>
        file.name ? `/dropped/${file.name}` : '',
    },
  }),
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
  jest.clearAllMocks()
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
  expect(await screen.findByText('Human hg38 (GRCh38)')).toBeTruthy()

  fireEvent.click(await screen.findByText('Volvox'))

  expect(await screen.findByText(/Loading session/)).toBeTruthy()
  expect(screen.queryByText('Volvox')).toBeNull()
  expect(screen.queryByText('Human hg38 (GRCh38)')).toBeNull()
  expect(screen.queryByText('Open your own genome')).toBeNull()
  openFileMenu()
  expect(
    screen
      .getByRole('menuitem', { name: 'Open config.json or .jbrowse file...' })
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

test('File > Open config.json or .jbrowse file... loads the picked file', async () => {
  jest.mocked(loadPluginManager).mockResolvedValue({} as PluginManager)
  renderStartScreen()
  openFileMenu()
  fireEvent.click(
    screen.getByRole('menuitem', {
      name: 'Open config.json or .jbrowse file...',
    }),
  )
  await waitFor(() => {
    expect(loadPluginManager).toHaveBeenCalledWith('/home/u/picked.jbrowse')
  })
})

test('File > Exit quits the app', async () => {
  renderStartScreen()
  openFileMenu()
  fireEvent.click(screen.getByRole('menuitem', { name: 'Exit' }))
  await waitFor(() => {
    expect(invokeIpc).toHaveBeenCalledWith('quit')
  })
})

function openHelpMenu() {
  fireEvent.click(screen.getByRole('button', { name: /Help/ }))
}

test.each([
  ['Check for updates...', 'checkForUpdates'],
  ['Connect an AI agent...', 'showConnectAgent'],
])('Help > %s asks the main process', async (label, channel) => {
  renderStartScreen()
  openHelpMenu()
  fireEvent.click(screen.getByRole('menuitem', { name: label }))
  await waitFor(() => {
    expect(invokeIpc).toHaveBeenCalledWith(channel)
  })
})

test.each([
  ['Documentation', 'https://jbrowse.org/jb2/docs/'],
  [
    'Report an issue',
    'https://github.com/GMOD/jbrowse-components/issues/new/choose',
  ],
])('Help > %s opens the page externally', (label, url) => {
  const open = jest.spyOn(window, 'open').mockReturnValue(null)
  renderStartScreen()
  openHelpMenu()
  fireEvent.click(screen.getByRole('menuitem', { name: label }))
  expect(open).toHaveBeenCalledWith(url, '_blank')
  open.mockRestore()
})

function dropFiles(
  names: string[],
  target = screen.getByText('Launch new session'),
) {
  fireEvent.drop(target, {
    dataTransfer: {
      types: ['Files'],
      files: names.map(name => new File([''], name)),
    },
  })
}

test('dropping a .jbrowse file opens it', async () => {
  jest.mocked(loadPluginManager).mockResolvedValue({} as PluginManager)
  renderStartScreen()
  dropFiles(['volvox.jbrowse'])
  await waitFor(() => {
    expect(loadPluginManager).toHaveBeenCalledWith('/dropped/volvox.jbrowse')
  })
})

test('two dropped .jbrowse files open the first', async () => {
  jest.mocked(loadPluginManager).mockResolvedValue({} as PluginManager)
  renderStartScreen()
  dropFiles(['a.jbrowse', 'b.jbrowse'])
  await waitFor(() => {
    expect(loadPluginManager).toHaveBeenCalledWith('/dropped/a.jbrowse')
  })
  expect(screen.queryByText(/open genome dialog/)).toBeNull()
})

test('a drop with no file on disk behind it does nothing', () => {
  renderStartScreen()
  dropFiles([''])
  expect(screen.queryByText(/open genome dialog/)).toBeNull()
  expect(loadPluginManager).not.toHaveBeenCalled()
})

test('a drop on a menu, which renders in a portal, is not the screen’s', async () => {
  jest.mocked(loadPluginManager).mockResolvedValue({} as PluginManager)
  renderStartScreen()
  openFileMenu()
  dropFiles(['menu.jbrowse'], screen.getByRole('menuitem', { name: 'Exit' }))
  dropFiles(['screen.jbrowse'])
  await waitFor(() => {
    expect(loadPluginManager).toHaveBeenCalledWith('/dropped/screen.jbrowse')
  })
  expect(loadPluginManager).not.toHaveBeenCalledWith('/dropped/menu.jbrowse')
})

test('dropped files stay with that one dialog, not the next one opened', async () => {
  renderStartScreen()
  dropFiles(['hg19.fa'])
  fireEvent.click(
    await screen.findByText('open genome dialog /dropped/hg19.fa'),
  )
  openFileMenu()
  fireEvent.click(
    screen.getByRole('menuitem', { name: 'Open your own genome...' }),
  )
  expect(await screen.findByText('open genome dialog')).toBeTruthy()
})

test('dropping genome files opens the genome dialog with them staged', async () => {
  renderStartScreen()
  dropFiles(['hg19.fa', 'hg19.fa.fai'])
  expect(
    await screen.findByText(
      'open genome dialog /dropped/hg19.fa /dropped/hg19.fa.fai',
    ),
  ).toBeTruthy()
  expect(loadPluginManager).not.toHaveBeenCalled()
})

test('Tools > Factory reset... resets only once confirmed', async () => {
  renderStartScreen()
  const openReset = () => {
    fireEvent.click(screen.getByRole('button', { name: /Tools/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Factory reset...' }))
  }
  openReset()
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
  expect(factoryReset).not.toHaveBeenCalled()
  openReset()
  fireEvent.click(await screen.findByRole('button', { name: 'Reset' }))
  await waitFor(() => {
    expect(factoryReset).toHaveBeenCalledTimes(1)
  })
})
