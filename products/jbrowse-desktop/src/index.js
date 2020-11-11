import { FatalErrorDialog } from '@jbrowse/core/ui'
import React from 'react'
import ReactDOM from 'react-dom'
import ErrorBoundary from 'react-error-boundary'
import 'fontsource-roboto'
import factoryReset from './factoryReset'
import Loader from './Loader'

const { electron } = window
const { ipcRenderer, remote } = electron
const { BrowserWindow, getCurrentWindow } = remote
const initialTimestamp = Date.now()

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

const PlatformSpecificFatalErrorDialog = props => {
  return <FatalErrorDialog onFactoryReset={factoryReset} {...props} />
}

ReactDOM.render(
  <ErrorBoundary FallbackComponent={PlatformSpecificFatalErrorDialog}>
    <Loader initialTimestamp={initialTimestamp} />
  </ErrorBoundary>,
  document.getElementById('root'),
)
