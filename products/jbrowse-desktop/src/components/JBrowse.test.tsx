import React from 'react'

// must import first to create window.require as side effect
import { ipcMain, ipcRenderer } from '../../../../packages/__mocks__/electron'

import PluginManager from '@jbrowse/core/PluginManager'
import { render, fireEvent } from '@testing-library/react'
import { SnapshotIn } from 'mobx-state-tree'

// locals
import JBrowse from './JBrowse'
import corePlugins from '../corePlugins'
import JBrowseRootModelFactory from '../rootModel'
import configSnapshot from '../../test_data/volvox/config.json'
import sessionModelFactory from '../sessionModel'

jest.mock('../makeWorkerInstance', () => () => {})

type JBrowseRootModel = ReturnType<typeof JBrowseRootModelFactory>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(configSnapshot as any).configuration = {
  rpc: {
    defaultDriver: 'MainThreadRpcDriver',
  },
}

function getPluginManager(initialState?: SnapshotIn<JBrowseRootModel>) {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()

  const rootModel = JBrowseRootModelFactory({
    pluginManager,
    sessionModelFactory,
  }).create({ jbrowse: initialState || configSnapshot }, { pluginManager })
  pluginManager.setRootModel(rootModel)
  pluginManager.configure()
  return pluginManager
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
