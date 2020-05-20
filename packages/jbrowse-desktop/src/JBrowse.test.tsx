/* eslint-disable @typescript-eslint/no-explicit-any */

import PluginManager from '@gmod/jbrowse-core/PluginManager'
import fs from 'fs'
import { ipcMain, ipcRenderer } from 'electron'
import { render, waitForElement } from '@testing-library/react'
import { SnapshotIn } from 'mobx-state-tree'
import React from 'react'
import corePlugins from './corePlugins'
import JBrowse from './JBrowse'
import JBrowseRootModelFactory from './rootModel'

type JBrowseRootModel = ReturnType<typeof JBrowseRootModelFactory>

declare global {
  interface Window {
    electronBetterIpc: {
      ipcRenderer?: import('electron-better-ipc-extra').RendererProcessIpc
    }
    electron?: import('electron').AllElectron
  }
}

window.electronBetterIpc = {
  // @ts-ignore
  ipcRenderer: Object.assign(ipcRenderer, {
    callMain: () => {},
    answerMain: () => {},
    callRenderer: () => {},
    answerRenderer: () => {},
  }),
}

window.electron = {
  ipcRenderer,
  ipcMain,
  desktopCapturer: {
    getSources: () => [] as any,
  },
} as any

function getPluginManager(initialState?: SnapshotIn<JBrowseRootModel>) {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()

  const JBrowseRootModel = JBrowseRootModelFactory(pluginManager)
  const rootModel = JBrowseRootModel.create({
    jbrowse: initialState || {},
    assemblyManager: {},
  })
  pluginManager.setRootModel(rootModel)

  pluginManager.configure()
  return pluginManager
}

test('basic test of electron-mock-ipc', () => {
  const testMessage = 'test'
  ipcMain.once('test-event', (ev: Event, obj: string) => {
    expect(obj).toEqual(testMessage)
  })

  ipcRenderer.send('test-event', testMessage)
})

describe('main jbrowse app render', () => {
  it('renders empty', async () => {
    // we use preload script to load onto the window global
    ipcMain.handle('loadConfig', (ev: Event, obj: string) => {
      const config = fs.readFileSync('test_data/volvox/config.json', 'utf8')
      return JSON.parse(config)
    })
    ipcMain.handle('listSessions', (ev: Event, obj: string) => {
      return {}
    })

    const { getByText } = render(<JBrowse pluginManager={getPluginManager()} />)
    expect(
      await waitForElement(() => getByText('Start a new session')),
    ).toBeTruthy()
  })
})
