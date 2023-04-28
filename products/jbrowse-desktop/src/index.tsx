import React from 'react'
import ReactDOM from 'react-dom'
import { FatalErrorDialog } from '@jbrowse/core/ui'
import { ErrorBoundary } from 'react-error-boundary'
import { QueryParamProvider } from 'use-query-params'
import { WindowHistoryAdapter } from 'use-query-params/adapters/window'
import '@fontsource/roboto'

import factoryReset from './factoryReset'
import Loader from './Loader'

if (window?.name.startsWith('JBrowseAuthWindow')) {
  window.opener?.postMessage({
    name: window.name,
    redirectUri: window.location.href,
  })
  window.close()
}

const PlatformSpecificFatalErrorDialog = (props: { error?: unknown }) => {
  return <FatalErrorDialog {...props} onFactoryReset={factoryReset} />
}

ReactDOM.render(
  <ErrorBoundary FallbackComponent={PlatformSpecificFatalErrorDialog}>
    <QueryParamProvider adapter={WindowHistoryAdapter}>
      <Loader />
    </QueryParamProvider>
  </ErrorBoundary>,
  document.getElementById('root'),
)
