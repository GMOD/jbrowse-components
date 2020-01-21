import React from 'react'
import ReactDOM from 'react-dom'
import { useQueryParam, StringParam } from 'use-query-params'
import { TextDecoder, TextEncoder } from 'fastestsmallesttextencoderdecoder'
import JBrowse from './JBrowse'
import * as serviceWorker from './serviceWorker'
import 'requestidlecallback-polyfill'
import 'core-js/stable'

if (!window.TextEncoder) window.TextEncoder = TextEncoder
if (!window.TextDecoder) window.TextDecoder = TextDecoder

const App = () => {
  const [config] = useQueryParam('config', StringParam)
  return <JBrowse config={{ uri: config || 'test_data/config.json' }} />
}

// this is the main process, so start and register our service worker and web workers
serviceWorker.register()

ReactDOM.render(<App />, document.getElementById('root'))
