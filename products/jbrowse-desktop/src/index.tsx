import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { createRoot } from 'react-dom/client'
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
    <Loader />
  </ErrorBoundary>,
)
