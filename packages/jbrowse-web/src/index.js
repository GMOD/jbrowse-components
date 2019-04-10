import React from 'react'
import ReactDOM from 'react-dom'
import JBrowse from './JBrowse'
import * as serviceWorker from './serviceWorker'
import * as webWorkers from './webWorkers'

// this is the main process, so start and register our service worker and web workers
serviceWorker.register()
const workerGroups = webWorkers.register()

const configs = [
  { uri: 'test_data/config_volvox.json' },
  { uri: 'test_data/config_volvox_connection.json' },
  { uri: 'test_data/config_volvox_mainthread.json' },
  { uri: 'test_data/config_human.json' },
]

ReactDOM.render(
  <JBrowse configs={configs} workerGroups={workerGroups} />,
  document.getElementById('root'),
)
