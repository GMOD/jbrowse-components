import React from 'react'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { createRoot } from 'react-dom/client'
import { QueryParamProvider } from 'use-query-params'
import { WindowHistoryAdapter } from 'use-query-params/adapters/window'
import '@fontsource/roboto'

import Loader from './components/Loader'
import PlatformSpecificErrorDialog from './components/PlatformSpecificErrorDialog'

if (window.name.startsWith('JBrowseAuthWindow')) {
  window.opener?.postMessage({
    name: window.name,
    redirectUri: window.location.href,
  })
  window.close()
}

const root = createRoot(document.getElementById('root')!)

root.render(
  <ErrorBoundary FallbackComponent={PlatformSpecificErrorDialog}>
    <QueryParamProvider adapter={WindowHistoryAdapter}>
      <Loader />
    </QueryParamProvider>
  </ErrorBoundary>,
)
