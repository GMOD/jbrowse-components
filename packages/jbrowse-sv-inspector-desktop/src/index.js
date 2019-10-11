import React from 'react'
import ReactDOM from 'react-dom'
import JBrowse from './JBrowse'

const { BrowserWindow, getCurrentWindow } = window.electron.remote

window.onbeforeunload = () => {
  const thisWindowId = getCurrentWindow().id
  BrowserWindow.getAllWindows().forEach(win => {
    if (win.id !== thisWindowId) win.close()
  })
}

const app = <JBrowse config={{ uri: 'test_data/config.json' }} />

ReactDOM.render(app, document.getElementById('root'))
