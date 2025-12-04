import React from 'react'

// must import first to create window.require as side effect

import PluginManager from '@jbrowse/core/PluginManager'
import { fireEvent, render } from '@testing-library/react'

// locals
import JBrowse from './JBrowse'
import { ipcMain, ipcRenderer } from '../../../../packages/__mocks__/electron'
import configSnapshot from '../../test_data/volvox/config.json'
import corePlugins from '../corePlugins'
import JBrowseRootModelFactory from '../rootModel/rootModel'
import sessionModelFactory from '../sessionModel/sessionModel'

import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

jest.mock('../makeWorkerInstance', () => () => {})

type JBrowseRootModel = ReturnType<typeof JBrowseRootModelFactory>

function getPluginManager(initialState?: SnapshotIn<JBrowseRootModel>) {
  const pluginManager = new PluginManager(
    corePlugins.map(P => new P()),
  ).createPluggableElements()

  const rootModel = JBrowseRootModelFactory({
    pluginManager,
    sessionModelFactory,
  }).create(
    {
      jbrowse: initialState || {
        ...configSnapshot,
        configuration: {
          rpc: {
            defaultDriver: 'MainThreadRpcDriver',
          },
        },
      },
    },
    { pluginManager },
  )
  return pluginManager.setRootModel(rootModel).configure()
}

test('basic test of electron-mock-ipc', () => {
  const testMessage = 'test'
  ipcMain.once('test-event', (_ev: unknown, obj: string) => {
    expect(obj).toEqual(testMessage)
  })

  ipcRenderer.send('test-event', testMessage)
})

xit('renders start screen', async () => {
  ipcMain.handle('listSessions', () => ({}))

  const { findByText } = render(<JBrowse pluginManager={getPluginManager()} />)
  fireEvent.click(await findByText('Empty'))
  await findByText('Help')
})
