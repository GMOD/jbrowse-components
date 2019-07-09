import React from 'react'
import ReactDOM from 'react-dom'
import JBrowse from './JBrowse'
import model from './jbrowseModel'
import * as serviceWorker from './serviceWorker'

// this is the main process, so start and register our service worker and web workers
serviceWorker.register()

const configs = [
  { uri: 'test_data/config_volvox.json' },
  { uri: 'test_data/config_integration_test.json' },
  { uri: 'test_data/config_human.json' },
  { uri: 'test_data/config_volvox_connection.json' },
]

const jbrowseState = model.create()

configs.forEach(config => jbrowseState.addSession(config))

ReactDOM.render(
  <JBrowse state={jbrowseState} />,
  document.getElementById('root'),
)
