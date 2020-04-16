import { FatalErrorDialog } from '@gmod/jbrowse-core/ui'
import 'core-js/stable'
import { TextDecoder, TextEncoder } from 'fastestsmallesttextencoderdecoder'
import React from 'react'
import ReactDOM from 'react-dom'
import ErrorBoundary from 'react-error-boundary'
import 'requestidlecallback-polyfill'
import 'typeface-roboto'
import Loader from './Loader'
import * as serviceWorker from './serviceWorker'

if (!window.TextEncoder) window.TextEncoder = TextEncoder
if (!window.TextDecoder) window.TextDecoder = TextDecoder

// this is the main process, so start and register our service worker and web workers
serviceWorker.register()

async function factoryReset() {
  localStorage.removeItem('jbrowse-web-data')
  localStorage.removeItem('jbrowse-web-session')
  window.location.reload()
}

const PlatformSpecificFatalErrorDialog = props => {
  return <FatalErrorDialog onFactoryReset={factoryReset} {...props} />
}

ReactDOM.render(
  <ErrorBoundary FallbackComponent={PlatformSpecificFatalErrorDialog}>
    <Loader />
  </ErrorBoundary>,
  document.getElementById('root'),
)
