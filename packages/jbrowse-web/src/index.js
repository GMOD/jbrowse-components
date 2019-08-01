import 'raf/polyfill'
import React from 'react'
import ReactDOM from 'react-dom'
import JBrowse from './JBrowse'
import * as serviceWorker from './serviceWorker'

// this is the main process, so start and register our service worker and web workers
serviceWorker.register()

ReactDOM.render(
  <JBrowse config={{ uri: 'test_data/config.json' }} />,
  document.getElementById('root'),
)
