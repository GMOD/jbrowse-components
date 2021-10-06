import React from 'react'
import ReactDOM from 'react-dom'
import { FatalErrorDialog } from '@jbrowse/core/ui'
import { ErrorBoundary } from 'react-error-boundary'
import { QueryParamProvider } from 'use-query-params'

import 'fontsource-roboto'

import factoryReset from './factoryReset'
import Loader from './Loader'

const initialTimestamp = Date.now()

if (window && window.name.startsWith('JBrowseAuthWindow')) {
  const parent = window.opener
  if (parent) {
    parent.postMessage({
      name: window.name,
      redirectUri: window.location.href,
    })
  }
  window.close()
}

const PlatformSpecificFatalErrorDialog = props => {
  return <FatalErrorDialog onFactoryReset={factoryReset} {...props} />
}

ReactDOM.render(
  <ErrorBoundary FallbackComponent={PlatformSpecificFatalErrorDialog}>
    <QueryParamProvider>
      <Loader initialTimestamp={initialTimestamp} />
    </QueryParamProvider>
  </ErrorBoundary>,
  document.getElementById('root'),
)
