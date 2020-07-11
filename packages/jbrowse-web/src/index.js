import { FatalErrorDialog } from '@gmod/jbrowse-core/ui'
import 'core-js/stable'
import { TextDecoder, TextEncoder } from 'fastestsmallesttextencoderdecoder'
import 'mobx-react/batchingForReactDom'
import React from 'react'
import ReactDOM from 'react-dom'
import ErrorBoundary from 'react-error-boundary'
import 'requestidlecallback-polyfill'
import 'typeface-roboto'
import { QueryParamProvider } from 'use-query-params'
import Loader from './Loader'
import * as serviceWorker from './serviceWorker'

if (!window.TextEncoder) window.TextEncoder = TextEncoder
if (!window.TextDecoder) window.TextDecoder = TextDecoder

// this is the main process, so start and register our service worker and web workers
serviceWorker.register()

function factoryReset() {
  localStorage.removeItem('jbrowse-web-data')
  localStorage.removeItem('jbrowse-web-session')
  window.location = window.location.pathname
}

const PlatformSpecificFatalErrorDialog = props => {
  return <FatalErrorDialog onFactoryReset={factoryReset} {...props} />
}

ReactDOM.render(
  <ErrorBoundary FallbackComponent={PlatformSpecificFatalErrorDialog}>
    <QueryParamProvider>
      <Loader />
    </QueryParamProvider>
  </ErrorBoundary>,
  document.getElementById('root'),
)
