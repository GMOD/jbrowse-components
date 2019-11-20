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

ipcRenderer.invoke = async arg => {
  if (arg === 'loadConfig') {
    const config = fs.readFileSync(
      'test_data/config_integration_test.json',
      'utf8',
    )
    return JSON.parse(config)
  }
  console.warn(
    `electron.ipcRenderer.invoke received unknown call for ${arg}, returning undefined`,
  )
  return undefined
}
window.electronBetterIpc = {
  ipcRenderer: {
    ...Object.create(ipcRenderer),
    callMain: () => {},
    answerMain: () => {},
    callRenderer: () => {},
    answerRenderer: () => {},
  },
}

// @ts-ignore
window.electronBetterIpc.ipcRenderer.invoke = async arg => {
  if (arg === 'listSessions') {
    return {}
  }
  console.warn(
    `electronBetterIpc.ipcRenderer.invoke received unknown ${arg}, returning undefined`,
  )
  return undefined
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
    // ipcMain.handle('loadConfig', (ev: Event, obj: string) => {
    //   return {}
    // })

    const { getByText } = render(<JBrowse />)
    expect(
      await waitForElement(() => getByText('Start a new session')),
    ).toBeTruthy()
  })
})
