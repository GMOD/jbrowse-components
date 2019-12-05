/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs'
// eslint-disable-next-line import/no-extraneous-dependencies
import { ipcMain, ipcRenderer } from 'electron'
// eslint-disable-next-line import/no-extraneous-dependencies
import { render, waitForElement } from '@testing-library/react'
import React from 'react'
import JBrowse from './JBrowse'

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

test('basic test of electron-mock-ipc', async () => {
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
      const config = fs.readFileSync(
        'test_data/config_integration_test.json',
        'utf8',
      )
      return JSON.parse(config)
    })
    ipcMain.handle('listSessions', (ev: Event, obj: string) => {
      return {}
    })

    const { getByText } = render(<JBrowse />)
    expect(
      await waitForElement(() => getByText('Start a new session')),
    ).toBeTruthy()
  })
})
