import React from 'react'
import ReactDOM from 'react-dom'
import './bootstrap'
import JBrowse from './JBrowse'
import * as serviceWorker from './serviceWorker'

// this is the main process, so start and register our service worker and web workers
serviceWorker.register()

const configs = [
  { uri: 'test_data/config_human.json' },
  { uri: 'test_data/config_volvox.json' },
  { uri: 'test_data/alignments_test.json' },
  { uri: 'test_data/config_volvox_connection.json' },
  { uri: 'test_data/config_volvox_mainthread.json' },
]

ReactDOM.render(<JBrowse configs={configs} />, document.getElementById('root'))
