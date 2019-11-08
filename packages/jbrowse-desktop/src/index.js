import React from 'react'
import ReactDOM from 'react-dom'
import JBrowse from './JBrowse'

const { electron } = window
const { ipcRenderer, remote } = electron
const { BrowserWindow, getCurrentWindow } = remote

window.onbeforeunload = () => {
  const thisWindowId = getCurrentWindow().id
  BrowserWindow.getAllWindows().forEach(win => {
    if (win.id !== thisWindowId) win.close()
  })
}

ipcRenderer.on('consoleLog', async (event, ...args) => {
  // eslint-disable-next-line no-console
  console.log(`windowWorker-${event.senderId}-log`, ...args)
})

ipcRenderer.on('consoleWarn', async (event, ...args) => {
  console.warn(`windowWorker-${event.senderId}-warn`, ...args)
})

ipcRenderer.on('consoleError', async (event, ...args) => {
  console.error(`windowWorker-${event.senderId}-error`, ...args)
})

const app = <JBrowse />

ReactDOM.render(app, document.getElementById('root'))
